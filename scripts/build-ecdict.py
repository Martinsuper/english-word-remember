#!/usr/bin/env python3
"""Build the pinned full ECDICT database bundled by the mobile app."""

from __future__ import annotations

import csv
import hashlib
import sqlite3
import sys
import tempfile
import urllib.request
from pathlib import Path

SOURCE_COMMIT = "82c9872576b23118d7c42e920c11beb77f510ae2"
SOURCE_URL = f"https://raw.githubusercontent.com/skywind3000/ECDICT/{SOURCE_COMMIT}/ecdict.csv"
SOURCE_SHA256 = "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf"
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "dictionaries" / "ecdict-v20250102.db"
FIELDS = (
    "word", "phonetic", "definition", "translation", "pos", "collins",
    "oxford", "tag", "bnc", "frq", "exchange",
)


def download_csv(destination: Path) -> None:
    print(f"Downloading ECDICT {SOURCE_COMMIT[:8]}…")
    urllib.request.urlretrieve(SOURCE_URL, destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise RuntimeError(f"ECDICT checksum mismatch: {digest}")


def build_database(source: Path, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".tmp")
    temporary.unlink(missing_ok=True)
    database = sqlite3.connect(temporary)
    database.executescript("""
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      PRAGMA page_size = 4096;
      CREATE TABLE dictionary (
        word TEXT PRIMARY KEY COLLATE NOCASE,
        phonetic TEXT NOT NULL DEFAULT '',
        definition TEXT NOT NULL DEFAULT '',
        translation TEXT NOT NULL DEFAULT '',
        pos TEXT NOT NULL DEFAULT '',
        collins INTEGER,
        oxford INTEGER,
        tag TEXT NOT NULL DEFAULT '',
        bnc INTEGER,
        frq INTEGER,
        exchange TEXT NOT NULL DEFAULT ''
      ) WITHOUT ROWID;
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    """)
    count = 0
    batch: list[tuple[str, ...]] = []
    with source.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            if not row.get("word", "").strip():
                continue
            batch.append(tuple(row.get(field, "") for field in FIELDS))
            if len(batch) >= 5000:
                database.executemany(
                    "INSERT OR REPLACE INTO dictionary VALUES (?,?,?,?,?,?,?,?,?,?,?)", batch
                )
                count += len(batch)
                batch.clear()
    if batch:
        database.executemany(
            "INSERT OR REPLACE INTO dictionary VALUES (?,?,?,?,?,?,?,?,?,?,?)", batch
        )
        count += len(batch)
    database.executemany("INSERT INTO metadata VALUES (?,?)", (
        ("source", "skywind3000/ECDICT"),
        ("source_commit", SOURCE_COMMIT),
        ("source_sha256", SOURCE_SHA256),
        ("entry_count", str(count)),
        ("license", "MIT"),
    ))
    database.commit()
    database.execute("VACUUM")
    result = database.execute("PRAGMA integrity_check").fetchone()
    database.close()
    if not result or result[0] != "ok":
        temporary.unlink(missing_ok=True)
        raise RuntimeError("Generated ECDICT database failed integrity_check")
    temporary.replace(destination)
    return count


def main() -> int:
    if "--check" in sys.argv:
        if not OUTPUT.exists():
            raise RuntimeError(f"Missing bundled dictionary: {OUTPUT}")
        database = sqlite3.connect(f"file:{OUTPUT}?mode=ro", uri=True)
        integrity = database.execute("PRAGMA quick_check").fetchone()
        metadata = dict(database.execute("SELECT key, value FROM metadata"))
        entry_count = database.execute("SELECT count(*) FROM dictionary").fetchone()[0]
        samples = dict(database.execute(
            "SELECT word, translation FROM dictionary WHERE word IN ('oligarch','ubiquitous','perceived')"
        ))
        database.close()
        if integrity != ("ok",):
            raise RuntimeError("Bundled ECDICT database failed quick_check")
        if metadata.get("source_commit") != SOURCE_COMMIT or entry_count != 770611:
            raise RuntimeError("Bundled ECDICT metadata or entry count is invalid")
        if len(samples) != 3 or any(not meaning for meaning in samples.values()):
            raise RuntimeError("Bundled ECDICT sample lookups failed")
        print(f"ECDICT check passed ({entry_count:,} entries)")
        return 0
    with tempfile.TemporaryDirectory(prefix="ecdict-") as directory:
        source = Path(directory) / "ecdict.csv"
        download_csv(source)
        count = build_database(source, OUTPUT)
    print(f"Built {OUTPUT} ({count:,} entries, {OUTPUT.stat().st_size / 1048576:.1f} MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
