<?php
// backend/notifications.php
require_once 'security.php';
require_once __DIR__ . '/brand_settings.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/vendor/autoload.php';

/**
 * Centralized Notification Service
 */
class NotificationService
{
    public $config;

    public function __construct()
    {
        $this->config = require 'config.php';
    }

    public function queueNotification($type, $recipient, $message, $subject = null, $payload = [])
    {
        global $pdo;
        if (!isset($pdo)) {
            require_once 'db.php';
        }

        // If in development mode, we revert to synchronous sending for easier debugging.
        if (($this->config['APP_ENV'] ?? 'production') === 'development') {
            logger('info', 'NOTIF_SYNC', "Dev Mode: Sending $type immediately for $recipient");
            if ($type === 'email') {
                return $this->sendEmail($recipient, $subject, $message);
            } elseif ($type === 'sms') {
                return $this->sendSMS($recipient, $message);
            }
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO notification_queue (type, recipient, subject, message, payload) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $type, 
                $recipient, 
                $subject, 
                $message, 
                !empty($payload) ? json_encode($payload) : null
            ]);
            // Reduced logging: Only log errors, not successful queue operations
            return true;
        } catch (Exception $e) {
            logger('error', 'NOTIF_QUEUE', "Failed to queue notification: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send Email via PHPMailer with SMTP support
     */
    public function sendEmail($to, $subject, $message, $altBody = '')
    {
        $mail = new PHPMailer(true);

        try {
            // Check if we should use SMTP
            if (isset($this->config['SMTP_HOST']) && !empty($this->config['SMTP_HOST'])) {
                $mail->isSMTP();
                $mail->Host       = $this->config['SMTP_HOST'];
                $mail->SMTPAuth   = true;
                $mail->Username   = $this->config['SMTP_USER'] ?? '';
                $mail->Password   = $this->config['SMTP_PASS'] ?? '';
                $mail->SMTPSecure = $this->config['SMTP_ENCRYPTION'] ?? PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = $this->config['SMTP_PORT'] ?? 587;
                logger('info', 'EMAIL_SERVICE', "SMTP configured, attempting to send to {$to}");
            } else {
                // Fallback to native mail() function via PHPMailer
                $mail->isMail();
                logger('info', 'EMAIL_SERVICE', "SMTP not configured, falling back to native mail() for {$to}");
            }

            // Recipients
            $from = $this->config['MAIL_FROM'] ?? 'no-reply@example.com';
            $mail->setFrom($from, eh_brand_site_name());
            $mail->addAddress($to);

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $message;
            $mail->AltBody = $altBody ?: strip_tags($message);

            $mail->send();
            logger('info', 'EMAIL_SERVICE', "Successfully sent email to {$to}");
            return true;
        } catch (Exception $e) {
            logger('error', 'EMAIL_SERVICE', "Failed to send email to {$to}: " . $mail->ErrorInfo);
            
            // In development, we might want to log the simulated email even on failure
            if ($this->config['APP_ENV'] === 'development') {
                logger('info', 'EMAIL_SERVICE', "SIMULATED EMAIL (Fell back due to error) to {$to}: {$message}");
            }
            return false;
        }
    }

    /**
     * Send SMS via Hubtel API
     */
    public function sendSMS($to, $message)
    {
        $clientId = $this->config['SMS_CLIENT_ID'] ?? '';
        $clientSecret = $this->config['SMS_CLIENT_SECRET'] ?? '';
        $from = $this->config['SMS_FROM'] ?: eh_brand_site_name();

        if (!$clientId || !$clientSecret) {
            logger('warning', 'SMS_SERVICE', "Hubtel credentials missing in .env.php. Falling back to log.");
            logger('info', 'SMS_SERVICE', "SIMULATED SMS to {$to}: {$message}");
            return false;
        }

        $normalizedTo = preg_replace('/\s+/', '', (string)$to);
        $normalizedTo = preg_replace('/[^\d+]/', '', $normalizedTo);
        if (strpos($normalizedTo, '+233') === 0) {
            $normalizedTo = '233' . substr($normalizedTo, 4);
        } elseif (strpos($normalizedTo, '0') === 0 && strlen($normalizedTo) === 10) {
            $normalizedTo = '233' . substr($normalizedTo, 1);
        }

        if (!preg_match('/^233\d{9}$/', $normalizedTo)) {
            logger('error', 'SMS_SERVICE', "Invalid recipient phone format for Hubtel: {$to}");
            return false;
        }

        // Hubtel SMS API call (V1)
        $url = rtrim($this->config['SMS_API_URL'] ?: "https://smsc.hubtel.com/v1/messages/send", '?');
        $auth = base64_encode("$clientId:$clientSecret");

        $postData = [
            'From' => $from,
            'To' => $normalizedTo,
            'Content' => $message,
            'Type' => 0 // 0 for Quick Message
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Basic $auth",
            "Content-Type: application/json"
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            logger('error', 'SMS_SERVICE', "Hubtel transport error: " . ($curlError ?: 'Unknown cURL error'));
            return false;
        }

        $decoded = json_decode((string)$response, true);
        $providerCode = is_array($decoded) ? ($decoded['ResponseCode'] ?? $decoded['responseCode'] ?? null) : null;
        $providerMessage = is_array($decoded) ? ($decoded['Message'] ?? $decoded['message'] ?? '') : '';

        if ($httpCode >= 200 && $httpCode < 300) {
            // Hubtel can return HTTP 200 with an application-level failure code.
            if ($providerCode !== null && !in_array((string)$providerCode, ['0', '0000'], true)) {
                logger('error', 'SMS_SERVICE', "Hubtel rejected SMS to {$normalizedTo}. Code {$providerCode}. {$providerMessage}. Raw: {$response}");
                return false;
            }

            logger('info', 'SMS_SERVICE', "Successfully sent SMS to {$normalizedTo} via Hubtel");
            return true;
        } else {
            logger('error', 'SMS_SERVICE', "Hubtel API error (HTTP {$httpCode}) for {$normalizedTo}: " . $response);
            return false;
        }
    }

    /**
     * Log a notification for all administrators
     */
    public function logAdminNotification($title, $message, $type = 'info')
    {
        global $pdo;
        if (!isset($pdo)) {
            require_once 'db.php';
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) 
                                   SELECT id, ?, ?, ? FROM users WHERE role IN ('store_manager', 'super')");
            return $stmt->execute([$title, $message, $type]);
        } catch (Exception $e) {
            logger('error', 'SYSTEM', "Failed to log admin notification: " . $e->getMessage());
            return false;
        }
    }
}
