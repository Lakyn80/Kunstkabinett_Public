from app.core.mailer import _smtp_client
with _smtp_client() as c:
    print("EHLO:", c.ehlo())
    print("NOOP:", c.noop())
print("OK")
