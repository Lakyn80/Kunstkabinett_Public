#!/usr/bin/env python
"""
Hromadný import umělců (jen name + slug) do tabulky artist.

Použití:
  - Bez argumentu: použije vestavěný seznam DEFAULT_ARTIST_NAMES.
  - S argumentem: cesta k textovému souboru s 1 jménem na řádek.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

# Přidej backend root do path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    from dotenv import load_dotenv

    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=False)
except Exception:
    pass

from app.db import models
from app.db.session import SessionLocal


DEFAULT_ARTIST_NAMES = [
    "A.R.Penck",
    "Adolf Benca",
    "Adolf Born",
    "Albín Brunovský",
    "Aleš Krejča",
    "Alfons Mucha",
    "Aloise Janák",
    "Andres Nemes",
    "Armando Maria Guerín",
    "Bohumil Kafka",
    "Bohumil Ullrych",
    "Bohuslav Matal",
    "Bohuslav Valenta",
    "Dušan Polakovič",
    "Eduard Ovčáček",
    "Emil Filla",
    "Emílie Tomanová",
    "Ernst Fuchs",
    "Ernst Steiner",
    "Eva Bednářová",
    "Eva Nauš-Šalamounová",
    "Eva Vlasáková",
    "Franta Emler",
    "František Burant",
    "František Kupka",
    "František Vobecký",
    "Friedrich Huderwasser",
    "Friedrich Sonnenberger",
    "Gottfried Salzmann",
    "Hasegawa",
    "Igor Piačka",
    "Ivan Komáčik",
    "Jan Balet",
    "Jan Knap",
    "Jan Krejčí",
    "Jan Zrzavý",
    "Jaroslav Kovář",
    "Jaroslava Solovjevová",
    "Jim Dine",
    "Jindra Husáriková",
    "Jitka Svobodová",
    "Jiří Anderle",
    "Jiří Chadima",
    "Jiří John",
    "Jiří Mocek",
    "Jiří Načeradský",
    "Jiří Sozanský",
    "Jiří Šlitr",
    "Johnny Friedlaender",
    "Josef Hlinomaz",
    "Josef Istler",
    "Josef Lehoučka",
    "Josef Paleček",
    "Josef Šíma",
    "Jíří ,,REMO” Jelínek",
    "Karel Demel",
    "Kristián Kodet",
    "Květa Válová",
    "Ladislav Kuklík",
    "Ladislav MARIA Wagner",
    "Leroy Niemann",
    "Lisoletta Hohs",
    "Mac Zimmermann",
    "Marcela Vrzalová",
    "Mari Hlavinková",
    "Miloslav Netík",
    "Miloš Kužela",
    "Miloš Vrbata",
    "Miroslav Přichystal",
    "Moise Kissling",
    "Olbram Zoubek",
    "Oldřich Hamera",
    "Oldřich Kulhánek",
    "Otakar Kubín",
    "Otakar Číla",
    "Paolo Scheggi",
    "Patrik Hábl",
    "Paul Wunderlich",
    "Pavel Roučka",
    "Petr Sís",
    "Pravoslav Sovák",
    "Richard Taubenek",
    "Robert Brun",
    "Roy Lichtenstain",
    "Sabine Hettner",
    "Stanislav Kolíbal",
    "TOYEN",
    "Tomáš Bím",
    "Tomáš Stryhal",
    "Vasilij Kandinsky",
    "Vendula Halounová císařovská",
    "Vladimír Boudník",
    "Vladimír Gažovič",
    "Vladimír Suchánek",
    "Vlastimil Beneš",
    "Zdenek Janda",
    "Zdenek TARGUS Červinka",
]


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", str(name or "").strip()).lower()


def slugify(name: str) -> str:
    text = unicodedata.normalize("NFKD", str(name or ""))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    return text or "artist"


def unique_slug(db, base_slug: str) -> str:
    candidate = base_slug
    i = 2
    while db.query(models.Artist).filter(models.Artist.slug == candidate).first():
        candidate = f"{base_slug}-{i}"
        i += 1
    return candidate


def load_names_from_file(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    names: list[str] = []
    for line in lines:
        clean = line.strip()
        if not clean:
            continue
        if clean.startswith("#"):
            continue
        names.append(clean)
    return names


def main() -> int:
    if len(sys.argv) > 1:
        names_file = Path(sys.argv[1]).expanduser().resolve()
        if not names_file.exists():
            print(f"ERROR: Soubor neexistuje: {names_file}")
            return 1
        names = load_names_from_file(names_file)
    else:
        names = list(DEFAULT_ARTIST_NAMES)

    seen = set()
    deduped: list[str] = []
    for n in names:
        key = normalize_name(n)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(n.strip())

    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        existing = db.query(models.Artist.id, models.Artist.name).all()
        existing_norm = {normalize_name(name): aid for aid, name in existing}

        for name in deduped:
            nkey = normalize_name(name)
            if nkey in existing_norm:
                skipped += 1
                continue

            base_slug = slugify(name)
            slug = unique_slug(db, base_slug)
            artist = models.Artist(name=name, slug=slug)
            db.add(artist)
            db.flush()
            existing_norm[nkey] = artist.id
            inserted += 1

        db.commit()
        print(f"Hotovo. Inserted: {inserted}, skipped(existing): {skipped}, total_input: {len(deduped)}")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

