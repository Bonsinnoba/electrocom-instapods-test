<?php
// api/cron_backup.php
// Automated backup script for cron job scheduling
// Run via: php /path/to/api/cron_backup.php

// Load configuration
$config = require_once __DIR__ . '/config.php';

// Database connection details
$host = $config['DB_HOST'];
$user = $config['DB_USER'];
$pass = $config['DB_PASS'];
$db   = $config['DB_NAME'];

// Backup directory
$backupDir = __DIR__ . '/backups';
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}

// Log file
$logFile = __DIR__ . '/logs/backup.log';
if (!is_dir(dirname($logFile))) {
    mkdir(dirname($logFile), 0755, true);
}

/**
 * Log backup activity
 */
function backupLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
    echo $logMessage;
}

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
    $deletedCount = 0;
    foreach ($backups as $filename => $timestamp) {
        if (!in_array($filename, $toKeep)) {
            $filepath = $backupDir . '/' . $filename;
            if (file_exists($filepath)) {
                unlink($filepath);
                // Also delete checksum file
                $checksumFile = $filepath . '.md5';
                if (file_exists($checksumFile)) {
                    unlink($checksumFile);
                }
                backupLog("Deleted old backup: $filename (retention policy)");
                $deletedCount++;
            }
        }
    }

    if ($deletedCount > 0) {
        backupLog("Retention policy: Deleted $deletedCount old backup(s)");
    }
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
        backupLog("Backup integrity check failed: checksum mismatch for $filepath");
        return false;
    }

    // Save new checksum
    file_put_contents($checksumFile, $checksum);

    // Verify file is not corrupted (basic check)
    if (filesize($filepath) < 1024) {
        backupLog("Backup file too small: $filepath");
        return false;
    }

    // If it's a gzip file, verify it can be opened
    if (strpos($filepath, '.gz') !== false) {
        $gz = @gzopen($filepath, 'rb');
        if (!$gz) {
            backupLog("Backup file is not valid gzip: $filepath");
            return false;
        }
        gzclose($gz);
    }

    return true;
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
 * Upload backup to off-site storage (FTP)
 */
function uploadToOffsite($localFile, $remotePath, $config) {
    $method = $config['OFFSITE_METHOD'] ?? 'none';

    if ($method === 'ftp') {
        return uploadToFTP($localFile, $remotePath, $config);
    }

    return false;
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
        backupLog("FTP credentials not configured");
        return false;
    }

    $conn = ftp_connect($ftpHost, $ftpPort, 30);
    if (!$conn) {
        backupLog("FTP connection failed to $ftpHost:$ftpPort");
        return false;
    }

    if (!ftp_login($conn, $ftpUser, $ftpPass)) {
        backupLog("FTP login failed for user $ftpUser");
        ftp_close($conn);
        return false;
    }

    // Enable passive mode
    ftp_pasv($conn, true);

    $result = ftp_put($conn, $remotePath, $localFile, FTP_BINARY);
    ftp_close($conn);

    if (!$result) {
        backupLog("FTP upload failed for $remotePath");
    }

    return $result;
}

/**
 * Send alert email on backup failure
 */
function sendBackupAlert($message) {
    global $config;
    
    $to = $config['ADMIN_EMAIL'] ?? 'admin@example.com';
    $subject = '⚠️ Database Backup Failed - ' . $config['APP_NAME'] ?? 'EssentialsHub';
    $body = "Database backup failed at " . date('Y-m-d H:i:s') . "\n\n";
    $body .= "Error: $message\n\n";
    $body .= "Please check the server and backup configuration.\n";
    $body .= "Log file: " . __DIR__ . '/logs/backup.log';

    $headers = 'From: ' . ($config['FROM_EMAIL'] ?? 'noreply@example.com') . "\r\n";
    $headers .= 'X-Mailer: PHP/' . phpversion();

    @mail($to, $subject, $body, $headers);
    backupLog("Alert email sent to: $to");
}

// Main backup process
backupLog("=== Starting automated backup ===");

try {
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

    backupLog("Executing: mysqldump -h*** -u*** $db | gzip > $filename");

    // Execute backup
    $output = [];
    $returnCode = 0;
    exec($command, $output, $returnCode);

    if ($returnCode === 0 && file_exists($filepath) && filesize($filepath) > 0) {
        $fileSize = formatFileSize(filesize($filepath));
        backupLog("✓ Backup created successfully: $filename (Size: $fileSize)");

        // Apply encryption if enabled
        $encryptionKey = $config['BACKUP_ENCRYPTION_KEY'] ?? null;
        if ($encryptionKey) {
            $encryptedFile = $backupDir . '/encrypted_' . $filename;
            if (encryptFile($filepath, $encryptedFile, $encryptionKey)) {
                unlink($filepath); // Remove unencrypted file
                $filepath = $encryptedFile;
                $filename = 'encrypted_' . $filename;
                backupLog("✓ Backup encrypted: $filename");
            } else {
                backupLog("✗ Encryption failed, keeping unencrypted backup");
            }
        }

        // Verify backup integrity
        $verified = verifyBackupIntegrity($filepath);
        if (!$verified) {
            backupLog("✗ Backup integrity check failed for $filename");
        } else {
            backupLog("✓ Backup integrity verified");
        }

        // Upload to off-site storage if configured
        $offsiteEnabled = $config['OFFSITE_ENABLED'] ?? false;
        if ($offsiteEnabled) {
            $remotePath = 'backups/' . $filename;
            if (uploadToOffsite($filepath, $remotePath, $config)) {
                backupLog("✓ Backup uploaded to off-site storage: $remotePath");
            } else {
                backupLog("✗ Off-site upload failed for $filename");
            }
        }

        // Apply retention policy
        applyRetentionPolicy($backupDir);

        backupLog("=== Backup completed successfully ===");
        exit(0);
    } else {
        $errorMsg = "Backup failed. mysqldump error: " . implode("\n", $output);
        backupLog("✗ $errorMsg");
        sendBackupAlert($errorMsg);
        backupLog("=== Backup failed ===");
        exit(1);
    }
} catch (Exception $e) {
    $errorMsg = "Backup exception: " . $e->getMessage();
    backupLog("✗ $errorMsg");
    sendBackupAlert($errorMsg);
    backupLog("=== Backup failed ===");
    exit(1);
}
