from sqlalchemy import create_engine, text
import os

e = create_engine(os.environ["DATABASE_URL"])
with e.begin() as c:
    c.execute(text("ALTER TABLE order_status_audit ALTER COLUMN created_at SET DEFAULT now()"))
    c.execute(text("ALTER TABLE order_status_audit ALTER COLUMN new_status DROP NOT NULL"))
    c.execute(text("UPDATE order_status_audit SET new_status = to_status WHERE new_status IS NULL"))
print("OK")
