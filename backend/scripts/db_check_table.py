from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)
eng = create_engine(os.getenv("DATABASE_URL")) # type: ignore
with eng.connect() as c:
    exists = c.execute(text("SELECT to_regclass('stock_reservation')")).scalar()
    print("stock_reservation =", exists)
