"""
HTTP API Email Backends.

Enables transactional email delivery over HTTPS (port 443), completely bypassing
firewall blocks on standard SMTP ports (25, 465, 587) on hosting platforms like Render.
"""
import json
import logging
import urllib.error
import urllib.request
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger('unipact.email')


class ResendEmailBackend(BaseEmailBackend):
    """
    Sends transactional emails via Resend's REST API over HTTPS (Port 443).
    Requires settings.RESEND_API_KEY.
    """

    API_URL = 'https://api.resend.com/emails'

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, 'RESEND_API_KEY', '')

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        if not self.api_key:
            err_msg = "ResendEmailBackend requires RESEND_API_KEY to be set in environment variables."
            logger.error(err_msg)
            if self.fail_silently:
                return 0
            raise ValueError(err_msg)

        sent_count = 0
        for message in email_messages:
            try:
                # Extract HTML body if present in alternatives
                html_body = None
                for content, mime in getattr(message, 'alternatives', []):
                    if mime == 'text/html':
                        html_body = content
                        break

                recipients = list(message.to)
                if not recipients:
                    continue

                payload = {
                    'from': message.from_email or settings.DEFAULT_FROM_EMAIL,
                    'to': recipients,
                    'subject': message.subject,
                    'text': message.body,
                }
                if html_body:
                    payload['html'] = html_body
                if message.bcc:
                    payload['bcc'] = list(message.bcc)
                if message.reply_to:
                    payload['reply_to'] = list(message.reply_to)

                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(
                    self.API_URL,
                    data=data,
                    headers={
                        'Authorization': f'Bearer {self.api_key}',
                        'Content-Type': 'application/json',
                        'User-Agent': 'UniPact/3.0 (Python/urllib)',
                    },
                    method='POST',
                )

                timeout = getattr(settings, 'EMAIL_TIMEOUT', 10)
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    resp_body = response.read().decode('utf-8')
                    if response.status in (200, 201):
                        logger.info("Email delivered via Resend API to %s: %s", recipients, resp_body)
                        sent_count += 1
                    else:
                        logger.warning("Resend API returned status %s: %s", response.status, resp_body)

            except urllib.error.HTTPError as exc:
                err_resp = exc.read().decode('utf-8', errors='replace')
                logger.error("Resend API HTTPError %s: %s", exc.code, err_resp)
                if not self.fail_silently:
                    raise
            except Exception as exc:
                logger.error("Resend API unexpected error sending email to %s: %s", getattr(message, 'to', []), exc)
                if not self.fail_silently:
                    raise

        return sent_count
