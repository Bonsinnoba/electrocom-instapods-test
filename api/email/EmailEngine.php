<?php

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../brand_settings.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../vendor/autoload.php';

class EmailEngine
{
    private $pdo;
    private $config;
    private $superSettings;

    public function __construct($pdo, array $config = [])
    {
        $this->pdo = $pdo;
        $this->config = !empty($config) ? $config : (require __DIR__ . '/../config.php');
        $this->superSettings = function_exists('eh_merged_super_settings') ? eh_merged_super_settings() : [];
    }

    public function queueTemplate($toEmail, $templateKey, array $templateData = [], array $meta = [])
    {
        $toEmail = trim((string)$toEmail);
        if ($toEmail === '') {
            return false;
        }

        if (($this->config['EMAIL_QUEUE_ENABLED'] ?? true) === false || ($this->config['APP_ENV'] ?? 'production') === 'development') {
            $rendered = $this->renderTemplate($templateKey, $templateData);
            if (!$rendered['success']) {
                return false;
            }
            return $this->sendNow($toEmail, $rendered['subject'], $rendered['html'], $rendered['text'], $meta);
        }

        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO email_queue (
                    recipient_email, template_key, subject, payload_json, status, attempts, max_attempts, scheduled_at
                ) VALUES (?, ?, ?, ?, 'pending', 0, ?, UTC_TIMESTAMP())
            ");
            $stmt->execute([
                $toEmail,
                $templateKey,
                $meta['subject'] ?? null,
                json_encode($templateData),
                max(1, (int)($this->config['EMAIL_MAX_ATTEMPTS'] ?? 5)),
            ]);
            return true;
        } catch (\Throwable $e) {
            logger('error', 'EMAIL_ENGINE', 'Failed to queue email: ' . $e->getMessage());
            return false;
        }
    }

    public function processQueue($limit = 50)
    {
        $stmt = $this->pdo->prepare("
            SELECT * FROM email_queue
            WHERE status IN ('pending', 'retrying') AND scheduled_at <= UTC_TIMESTAMP()
            ORDER BY id ASC
            LIMIT ?
        ");
        $stmt->bindValue(1, (int)$limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            $payload = json_decode((string)($row['payload_json'] ?? '{}'), true);
            if (!is_array($payload)) {
                $payload = [];
            }

            $rendered = $this->renderTemplate((string)$row['template_key'], $payload);
            if (!$rendered['success']) {
                $this->markFailed((int)$row['id'], (int)$row['attempts'], (int)$row['max_attempts'], $rendered['error']);
                continue;
            }

            $subject = !empty($row['subject']) ? $row['subject'] : $rendered['subject'];
            $ok = $this->sendNow(
                (string)$row['recipient_email'],
                $subject,
                $rendered['html'],
                $rendered['text']
            );

            if ($ok) {
                $upd = $this->pdo->prepare("UPDATE email_queue SET status = 'sent', sent_at = UTC_TIMESTAMP(), processed_at = UTC_TIMESTAMP(), last_error = NULL WHERE id = ?");
                $upd->execute([(int)$row['id']]);
            } else {
                $this->markFailed((int)$row['id'], (int)$row['attempts'], (int)$row['max_attempts'], 'Provider send failed');
            }
        }
    }

    private function renderTemplate($templateKey, array $templateData)
    {
        $templateFile = __DIR__ . '/templates/' . $templateKey . '.php';
        if (!file_exists($templateFile)) {
            return ['success' => false, 'error' => "Template not found: {$templateKey}"];
        }

        try {
            $brandName = eh_brand_site_name();
            $data = $templateData;
            $result = require $templateFile;
            if (!is_array($result)) {
                return ['success' => false, 'error' => "Invalid template structure: {$templateKey}"];
            }
            return [
                'success' => true,
                'subject' => (string)($result['subject'] ?? ''),
                'html' => (string)($result['html'] ?? ''),
                'text' => (string)($result['text'] ?? ''),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function sendNow($toEmail, $subject, $htmlBody, $textBody = '', array $meta = [])
    {
        $provider = $this->resolveProvider();
        $messageId = null;
        $error = '';

        try {
            $result = null;
            if ($provider === 'smtp') {
                $result = $this->sendViaSmtp($toEmail, $subject, $htmlBody, $textBody);
            } elseif ($provider === 'mailgun') {
                $result = $this->sendViaMailgun($toEmail, $subject, $htmlBody, $textBody);
            } elseif ($provider === 'sendgrid') {
                $result = $this->sendViaSendGrid($toEmail, $subject, $htmlBody, $textBody);
            } else {
                throw new \RuntimeException('Unsupported email provider: ' . $provider);
            }

            if (!is_array($result) || empty($result['success'])) {
                $error = (string)($result['error'] ?? 'Unknown provider error');
                $messageId = $result['message_id'] ?? null;
                $this->insertLog($toEmail, $subject, $provider, $messageId, 'failed', $error, $meta);
                logger('error', 'EMAIL_ENGINE', 'Email send failed: ' . $error);
                return false;
            }

            $messageId = $result['message_id'] ?? null;
            if (!empty($result['meta']) && is_array($result['meta'])) {
                $meta = array_merge($meta, $result['meta']);
            }
            $this->insertLog($toEmail, $subject, $provider, $messageId, 'sent', null, $meta);
            return true;
        } catch (\Throwable $e) {
            $error = $e->getMessage();
            $this->insertLog($toEmail, $subject, $provider, $messageId, 'failed', $error, $meta);
            logger('error', 'EMAIL_ENGINE', 'Email send failed: ' . $error);
            return false;
        }
    }

    private function resolveProvider()
    {
        $envSelected = strtolower(trim((string)($this->config['EMAIL_PROVIDER'] ?? 'smtp')));
        $adminSelected = strtolower(trim((string)($this->superSettings['emailProvider'] ?? '')));

        $enabled = [
            'smtp' => $this->resolveEnabledFlag('smtp'),
            'mailgun' => $this->resolveEnabledFlag('mailgun'),
            'sendgrid' => $this->resolveEnabledFlag('sendgrid'),
        ];

        if ($adminSelected !== '' && isset($enabled[$adminSelected]) && $enabled[$adminSelected]) {
            return $adminSelected;
        }

        if ($envSelected !== '' && isset($enabled[$envSelected]) && $enabled[$envSelected]) {
            return $envSelected;
        }

        foreach (['smtp', 'mailgun', 'sendgrid'] as $candidate) {
            if (!empty($enabled[$candidate])) {
                return $candidate;
            }
        }

        // Keep system operational if all toggles are false.
        return 'smtp';
    }

    private function resolveEnabledFlag($provider)
    {
        $provider = strtolower(trim((string)$provider));
        $envMap = [
            'smtp' => 'EMAIL_SMTP_ENABLED',
            'mailgun' => 'EMAIL_MAILGUN_ENABLED',
            'sendgrid' => 'EMAIL_SENDGRID_ENABLED',
        ];
        $settingsMap = [
            'smtp' => 'emailProviderSmtpEnabled',
            'mailgun' => 'emailProviderMailgunEnabled',
            'sendgrid' => 'emailProviderSendgridEnabled',
        ];

        $envEnabled = (bool)($this->config[$envMap[$provider]] ?? false);
        if (array_key_exists($settingsMap[$provider], $this->superSettings)) {
            return (bool)$this->superSettings[$settingsMap[$provider]];
        }

        return $envEnabled;
    }

    private function sendViaSmtp($toEmail, $subject, $htmlBody, $textBody = '')
    {
        $mail = new PHPMailer(true);

        try {
            if (empty($this->config['SMTP_HOST'])) {
                throw new \RuntimeException('SMTP_HOST is missing');
            }

            $mail->isSMTP();
            $mail->Host = $this->config['SMTP_HOST'];
            $mail->SMTPAuth = true;
            $mail->Username = $this->config['SMTP_USER'] ?? '';
            $mail->Password = $this->config['SMTP_PASS'] ?? '';

            $enc = strtolower((string)($this->config['SMTP_ENCRYPTION'] ?? 'tls'));
            if ($enc === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } elseif ($enc === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }

            $mail->Port = (int)($this->config['SMTP_PORT'] ?? 587);
            $mail->setFrom(
                (string)($this->config['MAIL_FROM'] ?? 'no-reply@example.com'),
                (string)($this->config['MAIL_FROM_NAME'] ?? eh_brand_site_name())
            );
            $mail->addAddress($toEmail);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            $mail->AltBody = $textBody !== '' ? $textBody : strip_tags($htmlBody);
            $mail->send();

            return [
                'success' => true,
                'message_id' => method_exists($mail, 'getLastMessageID') ? $mail->getLastMessageID() : null,
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $mail->ErrorInfo ?: $e->getMessage(),
            ];
        }
    }

    private function sendViaMailgun($toEmail, $subject, $htmlBody, $textBody = '')
    {
        $apiKey = trim((string)($this->config['MAILGUN_API_KEY'] ?? ''));
        $domain = trim((string)($this->config['MAILGUN_DOMAIN'] ?? ''));
        $region = strtolower(trim((string)($this->config['MAILGUN_REGION'] ?? 'us')));

        if ($apiKey === '' || $domain === '') {
            return ['success' => false, 'error' => 'MAILGUN_API_KEY or MAILGUN_DOMAIN is missing'];
        }

        $baseUrl = $region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
        $url = $baseUrl . '/v3/' . rawurlencode($domain) . '/messages';
        $from = sprintf(
            '%s <%s>',
            (string)($this->config['MAIL_FROM_NAME'] ?? eh_brand_site_name()),
            (string)($this->config['MAIL_FROM'] ?? 'no-reply@example.com')
        );
        $body = [
            'from' => $from,
            'to' => $toEmail,
            'subject' => $subject,
            'html' => $htmlBody,
            'text' => $textBody !== '' ? $textBody : strip_tags($htmlBody),
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_USERPWD, 'api:' . $apiKey);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($body));
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            return ['success' => false, 'error' => $curlError ?: 'Mailgun transport error'];
        }

        $decoded = json_decode((string)$response, true);
        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'message_id' => $decoded['id'] ?? null,
                'meta' => ['mailgun_response' => $decoded],
            ];
        }

        return [
            'success' => false,
            'error' => 'Mailgun HTTP ' . $httpCode . ': ' . (string)$response,
        ];
    }

    private function sendViaSendGrid($toEmail, $subject, $htmlBody, $textBody = '')
    {
        $apiKey = trim((string)($this->config['SENDGRID_API_KEY'] ?? ''));
        if ($apiKey === '') {
            return ['success' => false, 'error' => 'SENDGRID_API_KEY is missing'];
        }

        $fromEmail = (string)($this->config['MAIL_FROM'] ?? 'no-reply@example.com');
        $fromName = (string)($this->config['MAIL_FROM_NAME'] ?? eh_brand_site_name());
        $payload = [
            'personalizations' => [
                [
                    'to' => [
                        ['email' => $toEmail],
                    ],
                    'subject' => $subject,
                ],
            ],
            'from' => [
                'email' => $fromEmail,
                'name' => $fromName,
            ],
            'content' => [
                ['type' => 'text/plain', 'value' => $textBody !== '' ? $textBody : strip_tags($htmlBody)],
                ['type' => 'text/html', 'value' => $htmlBody],
            ],
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.sendgrid.com/v3/mail/send');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            return ['success' => false, 'error' => $curlError ?: 'SendGrid transport error'];
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'message_id' => null,
                'meta' => ['sendgrid_http_code' => $httpCode],
            ];
        }

        return [
            'success' => false,
            'error' => 'SendGrid HTTP ' . $httpCode . ': ' . (string)$response,
        ];
    }

    private function insertLog($recipient, $subject, $provider, $messageId, $status, $errorMessage = null, array $meta = [])
    {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO email_log (
                    recipient_email, subject, provider, provider_message_id, status, error_message, meta_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $recipient,
                $subject,
                $provider,
                $messageId,
                $status,
                $errorMessage,
                !empty($meta) ? json_encode($meta) : null,
            ]);
        } catch (\Throwable $e) {
            logger('error', 'EMAIL_ENGINE', 'Failed to insert email log: ' . $e->getMessage());
        }
    }

    private function markFailed($id, $attempts, $maxAttempts, $reason)
    {
        $nextAttempt = $attempts + 1;
        $isFailed = $nextAttempt >= $maxAttempts;
        $status = $isFailed ? 'failed' : 'retrying';
        $backoffMinutes = min(60, max(1, (int)pow(2, $nextAttempt)));

        $stmt = $this->pdo->prepare("
            UPDATE email_queue
            SET
                attempts = ?,
                status = ?,
                last_error = ?,
                processed_at = UTC_TIMESTAMP(),
                scheduled_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
            WHERE id = ?
        ");
        $stmt->execute([$nextAttempt, $status, $reason, $backoffMinutes, $id]);
    }
}
