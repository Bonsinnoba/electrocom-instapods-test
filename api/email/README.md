# ElectrCom Email Engine Setup Guide

This document explains how to configure and use the email engine in `api/email/`.

The engine supports:
- SMTP (self-hosted or mailbox provider)
- Mailgun (paid API)
- SendGrid (paid API)

It supports provider switching via:
- environment variables (`.env`)

---

## 1) What is included

- Queue-based email delivery (`email_queue`)
- Delivery logs (`email_log`)
- Suppression list table (`email_suppressions`)
- Worker script: `api/cron_process_emails.php`
- Template renderer: `api/email/templates/*.php`
- Main service: `api/email/EmailEngine.php`

Integrated flows:
- Forgot password OTP
- Order confirmation

---

## 2) Database setup

Run migrations so `019_email_engine.sql` is applied.

Options:
- Enable auto-repair migration runner with `DB_AUTO_REPAIR=true`, or
- Run migrations manually through your existing migration process.

Required migration file:
- `api/migrations/019_email_engine.sql`

---

## 3) Environment setup (`api/.env`)

Use `api/.env.example` as the base.

### Core email settings

```env
EMAIL_PROVIDER=smtp
EMAIL_QUEUE_ENABLED=true
EMAIL_MAX_ATTEMPTS=5

EMAIL_SMTP_ENABLED=true
EMAIL_MAILGUN_ENABLED=false
EMAIL_SENDGRID_ENABLED=false

MAIL_FROM_NAME=ElectrCom
MAIL_FROM=no-reply@your-domain.com
```

### SMTP settings

```env
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_ENCRYPTION=tls
```

### Mailgun settings

```env
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.your-domain.com
MAILGUN_REGION=us
```

Use `MAILGUN_REGION=eu` for EU region accounts.

### SendGrid settings

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx
```

---

## 4) Provider resolution rules (important)

The engine resolves the active provider in this order:

1. `.env` `EMAIL_PROVIDER` if enabled in env toggle.
2. First enabled provider fallback: `smtp` -> `mailgun` -> `sendgrid`.
3. If all toggles are disabled, fallback to `smtp`.

This allows safe switching without code changes.

---

## 6) Start the queue worker (cron)

Add cron to run every minute:

```bash
* * * * * php /absolute/path/to/api/cron_process_emails.php
```

The worker:
- pulls pending/retrying jobs from `email_queue`
- renders templates
- sends through the resolved provider
- logs results in `email_log`
- retries failures with exponential backoff

Heartbeat file:
- `api/data/email_worker_heartbeat.txt`

---

## 7) How emails are queued

`EmailEngine` queues template jobs using:

- `queueTemplate($toEmail, $templateKey, $templateData, $meta)`

Current templates:
- `password_reset_otp`
- `order_confirmation`

Template files live in:
- `api/email/templates/`

---

## 8) Troubleshooting

### Emails not sending
- Check cron is running `cron_process_emails.php`.
- Check SMTP/API credentials in `.env`.
- Check provider toggles in `.env`.
- Check `email_queue.status` and `last_error`.
- Check `email_log.error_message`.

### Queue keeps retrying
- Verify DNS/auth settings (SPF/DKIM/DMARC).
- Confirm selected provider has valid credentials.
- Ensure sender address in `MAIL_FROM` is allowed/verified.

### Wrong provider used
- Check `.env` `EMAIL_PROVIDER` and provider toggles.
- Ensure at least one provider toggle is enabled.

---

## 9) Production recommendations

- Keep `EMAIL_QUEUE_ENABLED=true`.
- Use a real domain sender (`MAIL_FROM`) with SPF/DKIM.
- Keep SMTP enabled as fallback even when using paid API providers.
- Monitor `email_log` and create alerts on repeated failures.

---

## 10) Quick checklist

- [ ] `019_email_engine.sql` migrated
- [ ] `.env` has sender + provider credentials
- [ ] At least one provider toggle enabled
- [ ] Active provider selected in `.env`
- [ ] Cron worker running every minute
- [ ] Test forgot-password and order-confirmation emails

