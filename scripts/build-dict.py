#!/usr/bin/env python3
"""Build the offline dictionary the extension downloads on first run.

Input : a Jitendex SQLite built by himotoki-web-ts (`packages/builders`, table `term` + `meta`).
Output: <out>/jitendex-lite.sqlite      (FTS tables and stats dropped, vacuumed, rollback journal)
        <out>/jitendex-lite.sqlite.gz   (what the extension fetches; ~60 MB)
        <out>/jitendex-lite.json        (manifest: revision, sizes, sha256)

Usage: python3 scripts/build-dict.py /path/to/jitendex.sqlite [out_dir]
"""
import gzip
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "dist-dict"
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

    manifest = {
        "name": "jitendex-lite",
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
