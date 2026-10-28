"""Send SMS (OTP codes, approval messages).

SMS_PROVIDER empty  -> nothing is sent, the text is printed in the server log (local / demo).
SMS_PROVIDER=msg91  -> MSG91 OTP API (India). Needs SMS_API_KEY and a DLT-approved SMS_TEMPLATE_ID.
"""
import json
import logging
import urllib.request

from app.config import settings

log = logging.getLogger("freshmart.sms")


def _msg91_otp(phone: str, code: str) -> None:
    url = (f"https://control.msg91.com/api/v5/otp?template_id={settings.SMS_TEMPLATE_ID}"
           f"&mobile=91{phone}&otp={code}")
    req = urllib.request.Request(url, method="POST", data=json.dumps({}).encode(),
                                 headers={"authkey": settings.SMS_API_KEY, "Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=10).read()


def send_otp(phone: str, code: str) -> None:
    if settings.SMS_PROVIDER == "msg91":
        _msg91_otp(phone, code)
        return
    print(f"[sms] OTP for {phone[:2]}******{phone[-2:]}: {code}  (SMS_PROVIDER not set, not sent)")


def send_text(phone: str, text: str) -> None:
    """Plain info message (approved / rejected). Only logged until a provider with free text is set up."""
    print(f"[sms] to {phone[:2]}******{phone[-2:]}: {text}")
