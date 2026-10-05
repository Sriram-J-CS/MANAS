"""
services/email_service.py - MANAS Community Email Service
──────────────────────────────────────────────────────────
Dispatches transactional & welcome community emails.
Supports real SMTP (Gmail, AWS SES, Brevo, SendGrid, etc.)
with graceful local logging and in-app notification backup.
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger("manas.email_service")

WELCOME_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to the MANAS Community</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0c0e14;
      color: #f1f5f9;
      margin: 0;
      padding: 24px;
    }}
    .container {{
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(180deg, #131722 0%, #0d1017 100%);
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }}
    .badge {{
      display: inline-block;
      padding: 4px 14px;
      border-radius: 9999px;
      background-color: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #c4b5fd;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 20px;
    }}
    h1 {{
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 16px 0;
      color: #ffffff;
    }}
    p {{
      font-size: 15px;
      line-height: 1.65;
      color: #cbd5e1;
      margin-bottom: 18px;
    }}
    .highlight-card {{
      background-color: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 20px;
      margin: 24px 0;
    }}
    .highlight-item {{
      margin-bottom: 12px;
      font-size: 14px;
      color: #e2e8f0;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      color: #ffffff !important;
      padding: 14px 28px;
      border-radius: 9999px;
      font-weight: 700;
      text-decoration: none;
      font-size: 14px;
      margin-top: 12px;
      box-shadow: 0 10px 20px rgba(139, 92, 246, 0.35);
    }}
    .footer {{
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">MANAS Community · Digital Mental Twin</div>
    <h1>Welcome to the MANAS Community, {name}! 🌿</h1>
    <p>
      Whatever you are feeling today, please know that <strong>you don't have to carry it alone</strong>.
      You have just taken a deeply compassionate step towards understanding and honoring your mental space.
    </p>
    <div class="highlight-card">
      <div class="highlight-item">✨ <strong>Attuned AI Twin:</strong> A personalized 3D avatar companion who listens unconditionally, without judgment.</div>
      <div class="highlight-item">🍃 <strong>Somatic Breathing & Grounding:</strong> Instant 4-7-8 pauses to ease anxiety whenever you need it.</div>
      <div class="highlight-item">🔒 <strong>Zero Plaintext Storage:</strong> Your conversations and identity are encrypted with client-side privacy.</div>
    </div>
    <p>
      Your personal space is always open. Check in whenever your mind needs a calm breath.
    </p>
    <a href="{app_url}" class="btn">Open Your MANAS Companion →</a>
    <div class="footer">
      <p>Tele-MANAS National 24/7 Helpline: <strong>14416</strong> (Toll-Free, India)</p>
      <p>© 2026 MANAS AI Mental Health Computing Lab. You received this email because you connected with the MANAS community.</p>
    </div>
  </div>
</body>
</html>
"""

def send_welcome_community_email(
    to_email: str,
    name: Optional[str] = "Friend",
    app_url: Optional[str] = None
) -> bool:
    """
    Sends 'Welcome to the MANAS Community' email.
    If SMTP server is configured in environment, dispatches via SMTP.
    Always logs and records for verification.
    """
    clean_email = (to_email or "").strip().lower()
    if not clean_email or "@" not in clean_email or clean_email.endswith("@manas.local"):
        logger.info("[EMAIL SERVICE] Skipping dummy/empty email address: %s", clean_email)
        return False

    display_name = (name or "Friend").strip()
    base_url = app_url or os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user or "welcome@manas.ai")

    subject = "Welcome to the MANAS Community - You are not alone 🌿"
    html_content = WELCOME_HTML_TEMPLATE.format(
        name=display_name,
        app_url=base_url
    )

    # Console dispatch notification
    try:
        print(f"\n======================================================\n"
              f"[MANAS COMMUNITY EMAIL DISPATCH]\n"
              f"To: {clean_email} ({display_name})\n"
              f"Subject: {subject}\n"
              f"From: {smtp_from}\n"
              f"Status: Welcome to the Community email generated successfully!\n"
              f"======================================================\n", flush=True)
    except Exception:
        logger.info("[MANAS COMMUNITY EMAIL DISPATCH] To: %s, Subject: Welcome to the MANAS Community", clean_email)

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"MANAS Community <{smtp_from}>"
            msg["To"] = clean_email
            
            # Plaintext fallback
            text_content = (
                f"Welcome to the MANAS Community, {display_name}!\n\n"
                f"Whatever you are carrying today, you don't have to carry it alone.\n"
                f"Access your personal companion: {base_url}\n\n"
                f"Tele-MANAS 24/7 Helpline: 14416"
            )
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()
                
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [clean_email], msg.as_string())
            server.quit()
            logger.info("[EMAIL SERVICE] Welcome email successfully sent to %s via SMTP %s", clean_email, smtp_host)
            return True
        except Exception as err:
            logger.warning("[EMAIL SERVICE] SMTP dispatch error: %s (Simulated delivery logged)", err)
            return False
    else:
        logger.info("[EMAIL SERVICE] Welcome email created for %s (SMTP not configured; simulated successfully)", clean_email)
        return True


OTP_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your MANAS Verification Code</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0c0e14;
      color: #f1f5f9;
      margin: 0;
      padding: 24px;
    }}
    .container {{
      max-width: 540px;
      margin: 0 auto;
      background: linear-gradient(180deg, #131722 0%, #0d1017 100%);
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }}
    .badge {{
      display: inline-block;
      padding: 4px 14px;
      border-radius: 9999px;
      background-color: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #c4b5fd;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 20px;
    }}
    h1 {{
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 12px 0;
      color: #ffffff;
    }}
    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 16px;
    }}
    .code-box {{
      background: rgba(139, 92, 246, 0.1);
      border: 2px dashed rgba(139, 92, 246, 0.5);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }}
    .otp-code {{
      font-family: 'SF Mono', Consolas, Monaco, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 0.35em;
      color: #c4b5fd;
      text-indent: 0.35em;
    }}
    .expiry {{
      font-size: 12px;
      color: #94a3b8;
      margin-top: 8px;
    }}
    .footer {{
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">MANAS Security · Verification</div>
    <h1>Your Verification Code</h1>
    <p>Hello {name}, enter this 6-digit verification code to securely access your EmotiCare AI / MANAS sanctuary:</p>
    <div class="code-box">
      <div class="otp-code">{otp_code}</div>
      <div class="expiry">Valid for 10 minutes · Single-use only</div>
    </div>
    <p style="font-size: 13px; color: #94a3b8;">
      If you did not request this verification code, please ignore this email. Never share this code with anyone.
    </p>
    <div class="footer">
      <p>Tele-MANAS National 24/7 Mental Health Helpline: <strong>14416</strong> (Toll-Free, India)</p>
      <p>© 2026 EmotiCare AI / MANAS Lab.</p>
    </div>
  </div>
</body>
</html>
"""

def send_otp_email(
    to_email: str,
    otp_code: str,
    name: Optional[str] = "Friend"
) -> dict:
    """
    Sends 6-digit OTP verification code via SMTP email or server console.
    Returns delivery status dictionary.
    """
    clean_email = (to_email or "").strip().lower()
    if not clean_email or "@" not in clean_email:
        return {"sent": False, "channel": "none", "error": "Invalid email format"}

    display_name = (name or "Friend").strip()
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user or "security@manas.ai")

    subject = f"Your MANAS Verification Code: {otp_code}"
    html_content = OTP_HTML_TEMPLATE.format(
        name=display_name,
        otp_code=otp_code
    )

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"MANAS Security <{smtp_from}>"
            msg["To"] = clean_email

            text_content = (
                f"Your MANAS Verification Code: {otp_code}\n\n"
                f"Valid for 10 minutes. Never share this code with anyone.\n\n"
                f"Tele-MANAS 24/7 Helpline: 14416"
            )
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()

            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [clean_email], msg.as_string())
            server.quit()
            logger.info("[EMAIL SERVICE] OTP successfully sent to %s via SMTP %s", clean_email, smtp_host)
            return {"sent": True, "channel": "smtp", "error": None}
        except Exception as err:
            logger.warning("[EMAIL SERVICE] SMTP dispatch error: %s (Falling back to console dispatch)", err)
            # Log to server console so developer/admin can verify in local testing
            print(f"\n======================================================\n[EMAIL OTP DISPATCH] To: {clean_email} | OTP: {otp_code} | Reason: SMTP error {err}\n======================================================\n", flush=True)
            return {"sent": True, "channel": "console_dev", "error": str(err)}
    else:
        # SMTP not configured: log to backend console truthfully
        logger.info("[EMAIL SERVICE] OTP generated for %s (SMTP not configured; console delivery)", clean_email)
        print(f"\n======================================================\n[EMAIL OTP DISPATCH] To: {clean_email} | OTP: {otp_code}\n[NOTE] Configure SMTP_HOST/SMTP_USER in .env for live email delivery.\n======================================================\n", flush=True)
        return {"sent": True, "channel": "console_dev", "error": None}

