import logging

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

SENDGRID_TIMEOUT_SECONDS = 10
SENDGRID_SEND_URL = "https://api.sendgrid.com/v3/mail/send"


def send_otp_email(to_email: str, otp: str, purpose: str) -> None:
    if not settings.SENDGRID_API_KEY or not settings.SENDGRID_FROM_EMAIL:
        logger.warning("SendGrid credentials not configured. Skipping email sending.")
        return

    subject = "Simplifix - OTP Verification"
    body = ""

    if purpose == "register":
        subject = "Welcome to Simplifix! Your Verification Code"
        body = f"<p>Hello,</p><p>Your verification code for registration is: <strong>{otp}</strong></p><p>This code will expire in 15 minutes.</p>"
    elif purpose == "forgot_password":
        subject = "Simplifix - Password Reset Request"
        body = f"<p>Hello,</p><p>Your verification code to reset your password is: <strong>{otp}</strong></p><p>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>"
    elif purpose == "change_password":
        subject = "Simplifix - Password Change Request"
        body = f"<p>Hello,</p><p>Your verification code to change your password is: <strong>{otp}</strong></p><p>This code will expire in 15 minutes.</p>"
    elif purpose == "change_email":
        subject = "Simplifix - Confirm Your New Email Address"
        body = f"<p>Hello,</p><p>Your verification code to confirm this address for your Simplifix account is: <strong>{otp}</strong></p><p>This code will expire in 15 minutes. If you did not request this change, please ignore this email.</p>"
    else:
        body = f"<p>Your OTP code is: <strong>{otp}</strong></p>"

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": settings.SENDGRID_FROM_EMAIL, "name": "Simplifix"},
        "subject": subject,
        "content": [{"type": "text/html", "value": body}],
    }

    try:
        response = requests.post(
            SENDGRID_SEND_URL,
            headers={
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=SENDGRID_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        logger.info(f"OTP email sent successfully to {to_email} for purpose {purpose}")
    except requests.RequestException as e:
        detail = e.response.text if e.response is not None else str(e)
        logger.error(f"Failed to send OTP email to {to_email}: {detail}")
