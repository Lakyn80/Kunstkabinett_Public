#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple, Optional, NoReturn

import configparser
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

# -------------------------
# Helpers
# -------------------------
ROOT = Path(__file__).resolve().parents[1]  # .../backend
ALEMBIC_INI = ROOT / "alembic.ini"
ENV_FILE = ROOT / ".env"

def echo(status: str, msg: str):
    # status in {"OK", "WARN", "FAIL"}
    print(f"[{status}] {msg}")

def die(msg: str, code: int = 1) -> NoReturn:
    echo("FAIL", msg)
    sys.exit(code)

def find_all_versions_dirs(start: Path) -> List[Path]:
    found: List[Path] = []
    for p in start.rglob("alembic"):
        versions = p / "versions"
        if versions.is_dir():
            found.append(versions)
    return found

def parse_alembic_header(p: Path) -> Tuple[Optional[str], Optional[str]]:
    # returns (revision_id, down_revision)
    rev_id = None
    down_rev = None
    try:
        content = p.read_text(encoding="utf-8", errors="ignore")
        # Old-style headers in comments
        m1 = re.search(r"Revision ID:\s*([0-9a-fA-F]+)", content)
        m2 = re.search(r"Revises:\s*([0-9a-fA-F]+|None)", content)
        if m1:
            rev_id = m1.group(1)
        if m2:
            raw = m2.group(1).strip()
            down_rev = None if raw.lower() == "none" else raw

        # New Alembic style: revision = '...', down_revision = '...'
        if rev_id is None:
            m3 = re.search(r"^\s*revision\s*=\s*['\"]([0-9a-fA-F]+)['\"]", content, re.MULTILINE)
            if m3:
                rev_id = m3.group(1)
        if down_rev is None:
            m4 = re.search(r"^\s*down_revision\s*=\s*(['\"])([^'\"]*?)\1", content, re.MULTILINE)
            if m4:
                raw = (m4.group(2) or "").strip()
                down_rev = None if raw.lower() in {"", "none"} else raw
    except Exception:
        pass
    return rev_id, down_rev

def load_db_engine() -> Engine:
    if ENV_FILE.exists():
        load_dotenv(dotenv_path=str(ENV_FILE), override=True)
        echo("OK", f"Načteno .env: {ENV_FILE}")
    else:
        echo("WARN", f".env nenalezen: {ENV_FILE}")

    url = os.getenv("DATABASE_URL", "")
    if not url:
        die("DATABASE_URL není nastavené (v .env nebo prostředí).")
    echo("OK", f"DATABASE_URL = {url.split('@')[0]}@***")

    try:
        eng = create_engine(url, future=True)
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
        echo("OK", "DB připojení v pořádku (SELECT 1).")
        return eng
    except SQLAlchemyError as e:
        die(f"DB připojení selhalo: {e}")

# -------------------------
# Checks
# -------------------------
def check_alembic_layout() -> Tuple[Path, Path]:
    if not ALEMBIC_INI.exists():
        die(f"alembic.ini nenalezen: {ALEMBIC_INI}")

    # DŮLEŽITÉ: vypnout interpolaci a číst raw hodnotu
    cfg = configparser.ConfigParser(interpolation=None)
    cfg.read(ALEMBIC_INI, encoding="utf-8")

    if "alembic" not in cfg or "script_location" not in cfg["alembic"]:
        die("V alembic.ini chybí [alembic] / script_location.")

    # vezmi raw řetězec a nahraď %(here)s absolutní cestou k alembic.ini
    script_loc_raw = cfg.get("alembic", "script_location", raw=True).strip()
    script_loc_raw = script_loc_raw.replace("%(here)s", str(ALEMBIC_INI.parent))

    script_loc = Path(script_loc_raw).resolve()
    if not script_loc.is_dir():
        die(f"script_location neexistuje: {script_loc}")

    versions_dir = script_loc / "versions"
    if not versions_dir.is_dir():
        die(f"Chybí složka s migracemi: {versions_dir}")

    echo("OK", f"Alembic script_location: {script_loc}")
    echo("OK", f"Alembic versions: {versions_dir}")

    # …zbytek funkce nech tak, jak je (kontrola duplicit atd.)

    # najdi duplicitní versions adresáře napříč projektem
    all_versions = find_all_versions_dirs(ROOT)
    dupes = [d for d in all_versions if d.resolve() != versions_dir.resolve()]
    if dupes:
        echo("FAIL", "Nalezeny duplicitní složky s migracemi:")
        for d in dupes:
            print("    -", d)
        die("Odstraň duplicitní 'alembic/versions' mimo hlavní cestu.")
    else:
        echo("OK", "Žádné duplicitní 'alembic/versions' složky v projektu.")

    return script_loc, versions_dir

def check_migrations_uniqueness(versions_dir: Path):
    py_files = list(versions_dir.glob("*.py"))
    if not py_files:
        die(f"Ve {versions_dir} nejsou žádné migrace.")

    rev_to_files = {}
    for f in py_files:
        rev, _ = parse_alembic_header(f)
        if not rev:
            echo("WARN", f"Nelze přečíst Revision ID v {f.name}")
            continue
        rev_to_files.setdefault(rev, []).append(f)

    dups = {rev: files for rev, files in rev_to_files.items() if len(files) > 1}
    if dups:
        echo("FAIL", "Duplicitní Revision ID v migračních souborech:")
        for rev, files in dups.items():
            print(f"  {rev}:")
            for f in files:
                print(f"    - {f}")
        die("Odstraň duplicity migrací.")
    else:
        echo("OK", "Revision ID migrací jsou unikátní.")

def check_alembic_head_matches_db(engine: Engine, versions_dir: Path):
    # přečti DB head
    db_head = None
    try:
        with engine.connect() as c:
            db_head = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception as e:
        die(f"Nelze přečíst alembic_version z DB: {e}")

    if not db_head:
        die("Tabulka alembic_version je prázdná (žádná migrace neaplikována?).")

    # ověř, že soubor s tímto Revision ID existuje
    file_exists = any(
        (parse_alembic_header(p)[0] == db_head) for p in versions_dir.glob("*.py")
    )
    if not file_exists:
        die(f"DB head '{db_head}' nemá odpovídající soubor v {versions_dir}")
    echo("OK", f"Alembic head v DB: {db_head} (soubor nalezen)")

def check_token_tables(engine: Engine):
    # Postgres: to_regclass vrátí None pokud tabulka neexistuje
    names = ("email_verification_token", "password_reset_token")
    missing = []
    with engine.connect() as c:
        for name in names:
            try:
                exists = c.execute(text("SELECT to_regclass(:n)"), {"n": name}).scalar()
                if not exists:
                    missing.append(name)
            except Exception:
                # fallback (kdyby jiná DB), zkus SELECT 1 LIMIT 0
                try:
                    c.execute(text(f"SELECT 1 FROM {name} LIMIT 0"))
                except Exception:
                    missing.append(name)

    if missing:
        die(f"Chybí tabulky: {', '.join(missing)}")
    else:
        echo("OK", "Token tabulky existují (email_verification_token, password_reset_token).")

def http_checks(base_url: str, email: Optional[str], password: Optional[str]):
    try:
        import requests
    except Exception:
        echo("WARN", "requests není nainstalován; HTTP testy přeskočeny.")
        return

    # /health
    try:
        r = requests.get(f"{base_url}/health", timeout=5)
        if r.ok and r.json().get("status") == "ok":
            echo("OK", f"/health: {r.json()}")
        else:
            echo("FAIL", f"/health: HTTP {r.status_code} {r.text}")
    except Exception as e:
        echo("FAIL", f"/health: {e}")

    # /auth/login + /auth/me (jen pokud máme přihlašovací údaje)
    if email and password:
        try:
            r = requests.post(
                f"{base_url}/auth/login",
                json={"email": email, "password": password},
                timeout=5,
            )
            if not r.ok:
                echo("FAIL", f"/auth/login: HTTP {r.status_code} {r.text}")
                return
            token = r.json().get("access_token")
            if not token:
                echo("FAIL", f"/auth/login: chybí access_token v odpovědi: {r.text}")
                return
            echo("OK", "/auth/login v pořádku (token získán)")

            r2 = requests.get(
                f"{base_url}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            if r2.ok:
                echo("OK", f"/auth/me: {json.dumps(r2.json(), ensure_ascii=False)}")
            else:
                echo("FAIL", f"/auth/me: HTTP {r2.status_code} {r2.text}")
        except Exception as e:
            echo("FAIL", f"HTTP test /auth*: {e}")
    else:
        echo("WARN", "Přihlašovací údaje nejsou zadány; přeskočeno /auth/login a /auth/me.")

# -------------------------
# Main
# -------------------------
def main():
    parser = argparse.ArgumentParser(description="Projektový self-check (env, DB, Alembic, duplicity, API).")
    parser.add_argument("--base-url", default=None, help="Např. http://127.0.0.1:8000 (volitelné)")
    parser.add_argument("--login-email", default=None, help="E-mail pro otestování /auth/login (volitelné)")
    parser.add_argument("--login-password", default=None, help="Heslo pro otestování /auth/login (volitelné)")
    args = parser.parse_args()

    print(f"== Self-check: {ROOT} ==")

    if not ROOT.exists():
        die(f"ROOT složka neexistuje: {ROOT}")

    # 1) Alembic rozložení + duplicity
    script_loc, versions = check_alembic_layout()
    check_migrations_uniqueness(versions)

    # 2) DB připojení
    eng = load_db_engine()

    # 3) Alembic head vs DB
    check_alembic_head_matches_db(eng, versions)

    # 4) Token tabulky
    check_token_tables(eng)

    # 5) Volitelně HTTP testy
    if args.base_url:
        http_checks(args.base_url, args.login_email, args.login_password)

    echo("OK", "Self-check dokončen bez kritických chyb.")

if __name__ == "__main__":
    main()
