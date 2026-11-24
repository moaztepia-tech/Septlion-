"""Copy the archived live client (sites/approved-client) into deploy/ after checking every file hash."""

import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "sites/approved-client"


def main(out="deploy"):
    manifest = json.loads((SITE / "manifest.json").read_text())
    expected = {item["path"]: item["sha256"] for item in manifest["files"]}
    actual = {p.relative_to(SITE / "public").as_posix() for p in (SITE / "public").rglob("*") if p.is_file()}
    if actual != set(expected):
        raise SystemExit("Archived client files differ from the manifest: %s" % sorted(actual ^ set(expected)))
    for path, sha in expected.items():
        if hashlib.sha256((SITE / "public" / path).read_bytes()).hexdigest() != sha:
            raise SystemExit("Checksum mismatch: " + path)
    dest = ROOT / out
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(SITE / "public", dest)
    print("Packaged the approved client: %d files, all checksums match." % len(expected))


if __name__ == "__main__":
    main(*sys.argv[1:])
