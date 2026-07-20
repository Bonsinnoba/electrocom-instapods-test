<?php
// api/super_backup.php
require 'db.php';
require 'security.php';
require_once __DIR__ . '/brand_settings.php';

header('Content-Type: application/json');

/**
 * Format file size for human readability
 */
function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, 2) . ' ' . $units[$pow];
}

/**
 * Apply retention policy to clean old backups
 * Keeps: 7 daily, 4 weekly, 12 monthly backups
 */
function applyRetentionPolicy($backupDir) {
    $files = glob($backupDir . '/*.sql.gz');
    if (empty($files)) return;

    $backups = [];
    foreach ($files as $file) {
        $backups[basename($file)] = filemtime($file);
    }

    arsort($backups); // Sort by date, newest first

    $now = time();
    $daily = [];
    $weekly = [];
    $monthly = [];

    foreach ($backups as $filename => $timestamp) {
        $ageDays = ($now - $timestamp) / 86400;

        if ($ageDays < 1) {
            $daily[] = $filename;
        } elseif ($ageDays < 7) {
            $weekly[] = $filename;
        } elseif ($ageDays < 30) {
            $monthly[] = $filename;
        }
    }

    // Keep last 7 daily, 4 weekly, 12 monthly
    $toKeep = array_merge(
        array_slice($daily, 0, 7),
        array_slice($weekly, 0, 4),
        array_slice($monthly, 0, 12)
    );

    $toKeep = array_unique($toKeep);

    // Delete old backups
    foreach ($backups as $filename => $timestamp) {
        if (!in_array($filename, $toKeep)) {
            $filepath = $backupDir . '/' . $filename;
            if (file_exists($filepath)) {
                unlink($filepath);
                error_log("Deleted old backup: $filename (retention policy)");
            }
        }
    }
}

/**
 * Encrypt file using OpenSSL AES-256-CBC
 */
function encryptFile($sourceFile, $destFile, $key) {
    $iv = openssl_random_pseudo_bytes(16);
    $data = file_get_contents($sourceFile);
    
    $encrypted = openssl_encrypt($data, 'AES-256-CBC', $key, 0, $iv);
    
    // Combine IV and encrypted data
    $encryptedData = $iv . $encrypted;
    
    return file_put_contents($destFile, $encryptedData) !== false;
}

/**
 * Decrypt file using OpenSSL AES-256-CBC
 */
function decryptFile($sourceFile, $destFile, $key) {
    $encryptedData = file_get_contents($sourceFile);
    
    // Extract IV (first 16 bytes)
    $iv = substr($encryptedData, 0, 16);
    $encrypted = substr($encryptedData, 16);
    
    $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, 0, $iv);
    
    if ($decrypted === false) {
        return false;
    }
    
    return file_put_contents($destFile, $decrypted) !== false;
}

/**
 * Upload backup to off-site storage (S3 or FTP)
 */
function uploadToOffsite($localFile, $remotePath, $config) {
    $method = $config['OFFSITE_METHOD'] ?? 'none';
    
    if ($method === 's3') {
        return uploadToS3($localFile, $remotePath, $config);
    } elseif ($method === 'ftp') {
        return uploadToFTP($localFile, $remotePath, $config);
    }
    
    return false;
}

/**
 * Upload to AWS S3
 */
function uploadToS3($localFile, $remotePath, $config) {
    if (!class_exists('Aws\S3\S3Client')) {
        error_log("AWS SDK not installed for S3 backup");
        return false;
    }
    
    try {
        $s3 = new Aws\S3\S3Client([
            'region' => $config['S3_REGION'] ?? 'us-east-1',
            'version' => 'latest',
            'credentials' => [
                'key' => $config['S3_ACCESS_KEY'],
                'secret' => $config['S3_SECRET_KEY']
            ]
        ]);
        
        $result = $s3->putObject([
            'Bucket' => $config['S3_BUCKET'],
            'Key' => $remotePath,
            'SourceFile' => $localFile
        ]);
        
        return $result['@metadata']['statusCode'] === 200;
    } catch (Exception $e) {
        error_log("S3 upload failed: " . $e->getMessage());
        return false;
    }
}

/**
 * Upload to FTP server
 */
function uploadToFTP($localFile, $remotePath, $config) {
    $ftpHost = $config['FTP_HOST'] ?? '';
    $ftpUser = $config['FTP_USER'] ?? '';
    $ftpPass = $config['FTP_PASS'] ?? '';
    $ftpPort = $config['FTP_PORT'] ?? 21;
    
    if (empty($ftpHost) || empty($ftpUser)) {
        error_log("FTP credentials not configured");
        return false;
    }
    
    $conn = ftp_connect($ftpHost, $ftpPort, 30);
    if (!$conn) {
        error_log("FTP connection failed to $ftpHost:$ftpPort");
        return false;
    }
    
    if (!ftp_login($conn, $ftpUser, $ftpPass)) {
        error_log("FTP login failed for user $ftpUser");
        ftp_close($conn);
        return false;
    }
    
    // Enable passive mode
    ftp_pasv($conn, true);
    
    $result = ftp_put($conn, $remotePath, $localFile, FTP_BINARY);
    ftp_close($conn);
    
    if (!$result) {
        error_log("FTP upload failed for $remotePath");
    }
    
    return $result;
}

/**
 * Verify backup integrity using checksum
 */
function verifyBackupIntegrity($filepath) {
    if (!file_exists($filepath)) {
        return false;
    }

    // Calculate MD5 checksum
    $checksum = md5_file($filepath);

    // Store checksum in separate file
    $checksumFile = $filepath . '.md5';
    $existingChecksum = file_exists($checksumFile) ? trim(file_get_contents($checksumFile)) : null;

    // If checksum file exists, verify it matches
    if ($existingChecksum && $existingChecksum !== $checksum) {
        error_log("Backup integrity check failed: checksum mismatch for $filepath");
        return false;
    }

    // Save new checksum
    file_put_contents($checksumFile, $checksum);

    // Verify file is not corrupted (basic check)
    if (filesize($filepath) < 1024) {
        error_log("Backup file too small: $filepath");
        return false;
    }

    // If it's a gzip file, verify it can be opened
    if (strpos($filepath, '.gz') !== false) {
        $gz = @gzopen($filepath, 'rb');
        if (!$gz) {
            error_log("Backup file is not valid gzip: $filepath");
            return false;
        }
        gzclose($gz);
    }

    return true;
}

/**
 * Send backup alert email
 */
function sendBackupAlert($subject, $message, $config) {
    $to = $config['ADMIN_EMAIL'] ?? 'admin@example.com';
    $from = $config['FROM_EMAIL'] ?? 'noreply@example.com';
    $appName = $config['APP_NAME'] ?? 'EssentialsHub';

    $body = "Backup Alert - $appName\n";
    $body .= "========================\n\n";
    $body .= "Time: " . date('Y-m-d H:i:s') . "\n\n";
    $body .= "$message\n\n";
    $body .= "Please check the server and backup configuration.\n";
    $body .= "Log file: " . __DIR__ . '/logs/backup.log';

    $headers = "From: $from\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    @mail($to, "[$appName] $subject", $body, $headers);
    error_log("Backup alert sent to: $to - $subject");
}

try {
    // 1. Authenticate Super User
    $userId = requireRole('super', $pdo);
    $userName = getUserName($userId, $pdo);

    $method = $_SERVER['REQUEST_METHOD'];

    // Ensure backups directory exists
    $backupDir = __DIR__ . '/backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }

    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'list';

        if ($action === 'list') {
            $files = glob($backupDir . '/*.sql.gz');
            $backups = [];
            foreach ($files as $file) {
                $backups[] = [
                    'name' => basename($file),
                    'size' => filesize($file),
                    'date' => date('Y-m-d H:i:s', filemtime($file))
                ];
            }
            usort($backups, function ($a, $b) {
                return strtotime($b['date']) - strtotime($a['date']);
            });
            echo json_encode(['success' => true, 'backups' => $backups]);
        } elseif ($action === 'download') {
            $filename = $_GET['file'] ?? '';
            $filepath = $backupDir . '/' . basename($filename);

            if ($filename && file_exists($filepath)) {
                header('Content-Description: File Transfer');
                header('Content-Type: application/gzip');
                header('Content-Disposition: attachment; filename="' . basename($filepath) . '"');
                header('Expires: 0');
                header('Cache-Control: must-revalidate');
                header('Pragma: public');
                header('Content-Length: ' . filesize($filepath));
                readfile($filepath);
                exit;
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'File not found.']);
            }
        }
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $action = $data['action'] ?? '';

        if ($action === 'create') {
            // Use native mysqldump with gzip compression
            $host = $config['DB_HOST'];
            $user = $config['DB_USER'];
            $pass = $config['DB_PASS'];
            $db   = $config['DB_NAME'];

            $filename = 'backup_' . date('Ymd_His') . '.sql.gz';
            $filepath = $backupDir . '/' . $filename;

            // Build mysqldump command
            $command = sprintf(
                'mysqldump -h%s -u%s -p%s %s 2>&1 | gzip > %s',
                escapeshellarg($host),
                escapeshellarg($user),
                escapeshellarg($pass),
                escapeshellarg($db),
                escapeshellarg($filepath)
            );

            // Execute backup
            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);

            if ($returnCode === 0 && file_exists($filepath) && filesize($filepath) > 0) {
                // Apply encryption if enabled
                $encrypt = $data['encrypt'] ?? false;
                $encryptionKey = $config['BACKUP_ENCRYPTION_KEY'] ?? null;

                if ($encrypt && $encryptionKey) {
                    $encryptedFile = $backupDir . '/encrypted_' . $filename;
                    if (encryptFile($filepath, $encryptedFile, $encryptionKey)) {
                        unlink($filepath); // Remove unencrypted file
                        $filepath = $encryptedFile;
                        $filename = 'encrypted_' . $filename;
                        logger('success', 'SYSTEM', "Database backup encrypted: {$filename}");
                    } else {
                        logger('warn', 'SYSTEM', "Encryption failed, keeping unencrypted backup");
                    }
                }

                // Apply retention policy
                applyRetentionPolicy($backupDir);

                // Upload to off-site storage if configured
                $offsiteEnabled = $config['OFFSITE_ENABLED'] ?? false;
                if ($offsiteEnabled) {
                    $remotePath = 'backups/' . $filename;
                    if (uploadToOffsite($filepath, $remotePath, $config)) {
                        logger('success', 'SYSTEM', "Backup uploaded to off-site storage: $remotePath");
                    } else {
                        logger('warn', 'SYSTEM', "Off-site upload failed for $filename");
                    }
                }

                // Verify backup integrity
                $verified = verifyBackupIntegrity($filepath);
                if (!$verified) {
                    logger('warn', 'SYSTEM', "Backup integrity check failed for $filename");
                }

                logger('success', 'SYSTEM', "Database backup created: {$filename} by {$userName} (Size: " . formatFileSize(filesize($filepath)) . ", Verified: " . ($verified ? 'Yes' : 'No') . ")");
                echo json_encode(['success' => true, 'message' => "Backup '$filename' created successfully.", 'file' => $filename, 'size' => filesize($filepath), 'encrypted' => $encrypt, 'verified' => $verified]);
            } else {
                $errorMsg = "Backup failed. mysqldump error: " . implode("\n", $output);
                logger('error', 'SYSTEM', $errorMsg);
                sendBackupAlert('Backup Failed', $errorMsg, $config);
                throw new Exception($errorMsg);
            }
        } elseif ($action === 'delete') {
            $filename = $data['file'] ?? '';
            $filepath = $backupDir . '/' . basename($filename);

            if ($filename && file_exists($filepath)) {
                unlink($filepath);
                // Also delete checksum file if exists
                $checksumFile = $filepath . '.md5';
                if (file_exists($checksumFile)) {
                    unlink($checksumFile);
                }
                logger('warn', 'SYSTEM', "Database backup deleted: $filename by $userName");
                echo json_encode(['success' => true, 'message' => "Backup deleted."]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'File not found.']);
            }
        } elseif ($action === 'restore') {
            $filename = $data['file'] ?? '';
            $filepath = $backupDir . '/' . basename($filename);
            $decrypt = $data['decrypt'] ?? false;
            $encryptionKey = $config['BACKUP_ENCRYPTION_KEY'] ?? null;

            if (!$filename || !file_exists($filepath)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Backup file not found.']);
                exit;
            }

            // Decrypt if needed
            $restoreFile = $filepath;
            if ($decrypt && $encryptionKey && strpos($filename, 'encrypted_') === 0) {
                $tempFile = $backupDir . '/temp_restore_' . time() . '.sql.gz';
                if (!decryptFile($filepath, $tempFile, $encryptionKey)) {
                    throw new Exception("Decryption failed for backup file.");
                }
                $restoreFile = $tempFile;
            }

            // Verify integrity before restore
            if (!verifyBackupIntegrity($restoreFile)) {
                throw new Exception("Backup integrity check failed. Cannot restore from potentially corrupted file.");
            }

            // Perform restore
            $host = $config['DB_HOST'];
            $user = $config['DB_USER'];
            $pass = $config['DB_PASS'];
            $db   = $config['DB_NAME'];

            // Build restore command
            if (strpos($restoreFile, '.gz') !== false) {
                $command = sprintf(
                    'gunzip -c %s | mysql -h%s -u%s -p%s %s 2>&1',
                    escapeshellarg($restoreFile),
                    escapeshellarg($host),
                    escapeshellarg($user),
                    escapeshellarg($pass),
                    escapeshellarg($db)
                );
            } else {
                $command = sprintf(
                    'mysql -h%s -u%s -p%s %s < %s 2>&1',
                    escapeshellarg($host),
                    escapeshellarg($user),
                    escapeshellarg($pass),
                    escapeshellarg($db),
                    escapeshellarg($restoreFile)
                );
            }

            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);

            // Clean up temp file if it was decrypted
            if ($decrypt && isset($tempFile) && file_exists($tempFile)) {
                unlink($tempFile);
            }

            if ($returnCode === 0) {
                logger('success', 'SYSTEM', "Database restored from: $filename by $userName");
                echo json_encode(['success' => true, 'message' => "Database restored successfully from $filename."]);
            } else {
                $errorMsg = "Restore failed. MySQL error: " . implode("\n", $output);
                logger('error', 'SYSTEM', $errorMsg);
                sendBackupAlert('Restore Failed', $errorMsg, $config);
                throw new Exception($errorMsg);
            }
        } elseif ($action === 'status') {
            // Monitoring endpoint to check backup status
            $files = glob($backupDir . '/*.sql.gz');
            $latestBackup = null;
            $latestTime = 0;

            foreach ($files as $file) {
                $mtime = filemtime($file);
                if ($mtime > $latestTime) {
                    $latestTime = $mtime;
                    $latestBackup = [
                        'name' => basename($file),
                        'size' => filesize($file),
                        'date' => date('Y-m-d H:i:s', $mtime),
                        'age_hours' => round((time() - $mtime) / 3600, 1)
                    ];
                }
            }

            $status = [
                'success' => true,
                'total_backups' => count($files),
                'latest_backup' => $latestBackup,
                'backup_dir_exists' => is_dir($backupDir),
                'backup_dir_writable' => is_writable($backupDir),
                'disk_space' => [
                    'free' => disk_free_space($backupDir),
                    'total' => disk_total_space($backupDir)
                ]
            ];

            // Check if backup is too old (> 48 hours)
            if ($latestBackup && $latestBackup['age_hours'] > 48) {
                $status['warning'] = 'Latest backup is older than 48 hours';
                sendBackupAlert('Backup Warning', "Latest backup is {$latestBackup['age_hours']} hours old. Please check backup system.", $config);
            }

            echo json_encode($status);
        }
    }
} catch (Exception $e) {
    logger('error', 'SYSTEM', 'Backup system error: ' . $e->getMessage());
    sendBackupAlert('Backup System Error', $e->getMessage(), $config);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Backup error: ' . $e->getMessage()]);
}
