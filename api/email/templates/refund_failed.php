<?php
/**
 * Email template: refund_failed
 *
 * Sent when a Paystack refund bounces (e.g. prepaid card closed/expired).
 * Lets the customer know their money is safe and asks them to provide
 * an alternative way to receive it.
 *
 * Expected $data keys:
 *   customer_name  – customer's display name
 *   order_id       – numeric order ID (shown as ORD-xxx)
 *   amount         – formatted amount string, e.g. "80.00"
 *   original_method– how they originally paid, e.g. "Visa card" / "MoMo"
 *   support_email  – store support email address
 *   store_url      – storefront base URL
 */

$name          = trim((string)($data['customer_name']   ?? 'Valued Customer'));
$orderId       = trim((string)($data['order_id']        ?? ''));
$amount        = trim((string)($data['amount']          ?? '0.00'));
$origMethod    = trim((string)($data['original_method'] ?? 'your original payment method'));
$supportEmail  = trim((string)($data['support_email']   ?? ''));
$storeUrl      = rtrim((string)($data['store_url']      ?? ''), '/');

$orderLabel  = $orderId ? "ORD-{$orderId}" : 'your recent order';
$brandName   = trim((string)($data['brand_name'] ?? 'ElectrCom'));
$supportLine = $supportEmail
    ? "Reply to this email or reach us at <a href=\"mailto:{$supportEmail}\" style=\"color:#4f46e5;\">{$supportEmail}</a>"
    : 'Reply to this email';

$html = <<<HTML
<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a2e;max-width:560px;margin:auto;">

  <div style="background:#4f46e5;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
      Action Required: Refund Update
    </h1>
  </div>

  <div style="background:#ffffff;padding:40px;border:1px solid #e5e7eb;border-radius:0 0 16px 16px;">

    <p style="margin-top:0;">Hi <strong>{$name}</strong>,</p>

    <p>
      We processed a refund of <strong>GH₵ {$amount}</strong> for <strong>{$orderLabel}</strong>,
      but unfortunately it could not be delivered back to <em>{$origMethod}</em>.
      This can happen when a prepaid card has expired or been closed after the original purchase.
    </p>

    <div style="background:#fef9c3;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:8px;margin:24px 0;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#92400e;">
        ⚠ Your money is safe with us
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#78350f;">
        The GH₵ {$amount} has been held securely by {$brandName}. We just need a working
        payment destination to send it to you.
      </p>
    </div>

    <p style="font-weight:700;margin-bottom:8px;">To receive your refund, please reply with one of the following:</p>
    <ul style="padding-left:20px;font-size:14px;color:#374151;line-height:2;">
      <li>📱 <strong>Mobile Money (MoMo)</strong> — Your registered MoMo number and network (MTN / Vodafone / AirtelTigo)</li>
      <li>🏦 <strong>Bank Transfer</strong> — Bank name, account number, and account name</li>
      <li>💵 <strong>Cash at Store</strong> — Let us know and we'll arrange an in-store pickup</li>
    </ul>

    <p style="margin-top:24px;">
      {$supportLine} and we will process your refund within <strong>1–2 business days</strong>
      of receiving your details.
    </p>

    <p style="color:#6b7280;font-size:13px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
      Reference: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">{$orderLabel}</code> &nbsp;·&nbsp;
      Refund amount: <strong>GH₵ {$amount}</strong>
    </p>

    <p style="color:#6b7280;font-size:12px;margin-top:8px;">
      © {$brandName}. This email was sent because a refund on your account requires your attention.
    </p>
  </div>

</div>
HTML;

$text = <<<TEXT
Hi {$name},

We tried to refund GH₵ {$amount} for {$orderLabel} back to {$origMethod}, but the refund could not be delivered — this often happens with prepaid or expired cards.

YOUR MONEY IS SAFE. We are holding GH₵ {$amount} for you.

To receive your refund, please reply with:
  - Mobile Money: your MoMo number + network (MTN / Vodafone / AirtelTigo)
  - Bank Transfer: bank name, account number, account name
  - Cash at Store: let us know and we'll arrange pickup

{$supportLine}
We will process your refund within 1–2 business days of hearing from you.

Reference: {$orderLabel}  |  Amount: GH₵ {$amount}

— {$brandName} Support Team
TEXT;

return [
    'subject' => "Action Required: Your Refund for {$orderLabel} Needs an Alternative",
    'html'    => $html,
    'text'    => $text,
];
