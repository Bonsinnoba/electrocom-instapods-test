<?php

$name = trim((string)($data['name'] ?? 'there'));
$otp = trim((string)($data['otp'] ?? ''));
$minutes = (int)($data['expires_minutes'] ?? 10);

return [
    'subject' => "Your {$brandName} Password Reset Code",
    'html' => "
        <div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#111;\">
            <p>Hello {$name},</p>
            <p>We received a request to reset your password. Use this code to continue:</p>
            <p style=\"font-size:24px;font-weight:700;letter-spacing:2px;\">{$otp}</p>
            <p>This code expires in {$minutes} minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
        </div>
    ",
    'text' => "Hello {$name},\n\nYour {$brandName} password reset code is: {$otp}\nThis code expires in {$minutes} minutes.\n\nIf you did not request this, ignore this email.",
];
