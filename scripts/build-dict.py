#!/usr/bin/env python3
"""Build the offline dictionary the extension downloads on first run.

Input : a Jitendex SQLite built by himotoki-web-ts (`packages/builders`, table `term` + `meta`).
Output: <out>/jitendex-lite.sqlite      (FTS tables and stats dropped, vacuumed, rollback journal)
        <out>/jitendex-lite.sqlite.gz   (what the extension fetches; ~60 MB)
        <out>/jitendex-lite.json        (manifest: revision, sizes, sha256)

Usage: python3 scripts/build-dict.py /path/to/jitendex.sqlite [out_dir] \
         [--pitch pitch-kanjium.sqlite] [--freq freq-jpdb-v2.sqlite] [--jlpt jlpt.sqlite]

Pitch (accent number), frequency rank and JLPT level are folded into the term table as columns
(pitch TEXT, freq INTEGER, jlpt TEXT) when the corresponding source DBs are given.
"""
import gzip
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile


def _has_column(conn, table, col):
    return any(r[1] == col for r in conn.execute(f"PRAGMA table_info('{table}')"))


def _attach_extras(conn, opts):
    """Fold pitch / frequency / JLPT into the term table (matched by expression+reading, or seq for JLPT)."""
    for col in ("pitch", "freq", "jlpt"):
        if not _has_column(conn, "term", col):
            conn.execute(f"ALTER TABLE term ADD COLUMN {col} {'INTEGER' if col == 'freq' else 'TEXT'}")

    if opts["--pitch"]:
        conn.execute("ATTACH DATABASE ? AS pitchdb", (opts["--pitch"],))
        # One pattern per (expression, reading); take the first.
        conn.execute(
            """
            UPDATE term SET pitch = (
              SELECT patterns FROM pitchdb.pitch p
              WHERE p.expression = term.expression AND p.reading = term.reading LIMIT 1
            ) WHERE pitch IS NULL
            """
        )
        conn.commit()
        conn.execute("DETACH DATABASE pitchdb")

    if opts["--freq"]:
        conn.execute("ATTACH DATABASE ? AS freqdb", (opts["--freq"],))
        # Smallest rank (most frequent) per (expression, reading).
        conn.execute(
            """
            UPDATE term SET freq = (
              SELECT CAST(MIN(f.value) AS INTEGER) FROM freqdb.freq f
              WHERE f.expression = term.expression AND f.reading = term.reading
            ) WHERE freq IS NULL
            """
        )
        conn.commit()
        conn.execute("DETACH DATABASE freqdb")

    if opts["--jlpt"]:
        conn.execute("ATTACH DATABASE ? AS jlptdb", (opts["--jlpt"],))
        conn.execute(
            """
            UPDATE term SET jlpt = (
              SELECT j.level FROM jlptdb.jlpt_word j WHERE j.seq = term.sequence LIMIT 1
            ) WHERE jlpt IS NULL
            """
        )
        conn.commit()
        conn.execute("DETACH DATABASE jlptdb")

    # Mark the build as extras-enhanced so clients on a plain build are offered the update once.
    if any(opts.values()):
        conn.execute(
            "UPDATE meta SET value = value || '+pf' WHERE key = 'revision' AND value NOT LIKE '%+pf'"
        )


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    args = sys.argv[1:]
    opts = {"--pitch": None, "--freq": None, "--jlpt": None}
    positional = []
    i = 0
    while i < len(args):
        if args[i] in opts:
            opts[args[i]] = args[i + 1]
            i += 2
        else:
            positional.append(args[i])
            i += 1
    src = positional[0]
    out_dir = positional[1] if len(positional) > 1 else "dist-dict"
    os.makedirs(out_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        work = os.path.join(tmp, "work.sqlite")
        shutil.copyfile(src, work)
        conn = sqlite3.connect(work)
        conn.execute("PRAGMA journal_mode=DELETE")
        names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        for name in names:
            if name.startswith("terms_fts") or name.startswith("sqlite_stat"):
                conn.execute(f'DROP TABLE IF EXISTS "{name}"')
        conn.execute("CREATE INDEX IF NOT EXISTS idx_term_expression ON term(expression)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_term_reading ON term(reading)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_term_sequence ON term(sequence)")
        _attach_extras(conn, opts)
        conn.commit()
        meta = dict(conn.execute("SELECT key, value FROM meta").fetchall())
        rows = conn.execute("SELECT COUNT(*) FROM term").fetchone()[0]

        lite = os.path.join(out_dir, "jitendex-lite.sqlite")
        if os.path.exists(lite):
            os.remove(lite)
        conn.execute("VACUUM INTO ?", (lite,))
        conn.close()

    # Make sure the output is a plain rollback-journal DB (OPFS import rejects WAL headers).
    with sqlite3.connect(lite) as out:
        out.execute("PRAGMA journal_mode=DELETE")

    gz = lite + ".gz"
    sha = hashlib.sha256()
    with open(lite, "rb") as f_in, gzip.open(gz, "wb", compresslevel=6) as f_out:
        while True:
            chunk = f_in.read(1 << 20)
            if not chunk:
                break
            sha.update(chunk)
            f_out.write(chunk)

    with sqlite3.connect(f"file:{lite}?mode=ro", uri=True) as stat:
        pitch_rows = stat.execute("SELECT COUNT(*) FROM term WHERE pitch IS NOT NULL").fetchone()[0]
        freq_rows = stat.execute("SELECT COUNT(*) FROM term WHERE freq IS NOT NULL").fetchone()[0]
        jlpt_rows = stat.execute("SELECT COUNT(*) FROM term WHERE jlpt IS NOT NULL").fetchone()[0]

    manifest = {
        "name": "jitendex-lite",
        "pitchRows": pitch_rows,
        "freqRows": freq_rows,
        "jlptRows": jlpt_rows,
        "title": meta.get("title", "Jitendex"),
        "revision": meta.get("revision", ""),
        "attribution": meta.get("attribution", ""),
        "terms": rows,
        "bytes": os.path.getsize(lite),
        "gzipBytes": os.path.getsize(gz),
        "sha256": sha.hexdigest(),
    }
    with open(os.path.join(out_dir, "jitendex-lite.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
