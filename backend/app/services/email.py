import logging
import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


class _IPv4SMTP(smtplib.SMTP):
    """smtplib.SMTP, but the TCP connection is forced over IPv4.

    Some hosts (Render's outbound network, notably) hand back an IPv6 address
    for smtp.gmail.com with no working IPv6 route, which fails with
    "[Errno 101] Network is unreachable" before STARTTLS/login ever run.
    Overriding just the socket connect (not the hostname used for TLS SNI/cert
    checks in starttls()) sidesteps that without weakening TLS verification.
    """

    def _get_socket(self, host, port, timeout):
        exc = None
        for family, socktype, proto, _, sockaddr in socket.getaddrinfo(
            host, port, socket.AF_INET, socket.SOCK_STREAM
        ):
            sock = socket.socket(family, socktype, proto)
            try:
                if timeout is not None:
                    sock.settimeout(timeout)
                sock.connect(sockaddr)
                return sock
            except OSError as e:
                exc = e
                sock.close()
        raise exc or OSError(f"No IPv4 address found for {host}")


def send_otp_email(to_email: str, otp: str, purpose: str) -> None:
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD:
        logger.warning("SMTP credentials not configured. Skipping email sending.")
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
    else:
        body = f"<p>Your OTP code is: <strong>{otp}</strong></p>"

    msg = MIMEMultipart()
    msg['From'] = settings.SMTP_EMAIL
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        with _IPv4SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(settings.SMTP_EMAIL, settings.SMTP_APP_PASSWORD)
            server.send_message(msg)
            logger.info(f"OTP email sent successfully to {to_email} for purpose {purpose}")
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
