"""Publish only the approved static client using the existing Hostinger FTPS account."""

import argparse
import ftplib
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import ssl
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "deploy/approved-client-manifest.json"
OUTPUT = ROOT / "release-output"
BACKUP = ROOT / "release-backup"
REMOTE_ROOT = "/domains/septlion.com/public_html"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def manifest():
    data = json.loads(MANIFEST.read_text())
    assert data["target_origin"] == "https://www.septlion.com"
    assert data["source_origin"] == "https://septlion-client-moaz-20261101.moaztepia.chatgpt.site"
    for item in data["files"]:
        path = PurePosixPath(item["path"])
        assert not path.is_absolute() and ".." not in path.parts
        assert len(item["sha256"]) == 64
    assert any(item["path"] == "index.html" for item in data["files"])
    return data


def check_files(directory, data):
    for item in data["files"]:
        raw = (directory / item["path"]).read_bytes()
        if digest(raw) != item["sha256"]:
            raise RuntimeError("Approved content checksum mismatch: " + item["path"])
    print("Approved static files verified: " + str(len(data["files"])))


def get_url(url):
    request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "SEPTLION-Release-Verification/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()


def prepare(data):
    for item in data["files"]:
        destination = OUTPUT / item["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        raw = get_url(data["source_origin"] + "/" + item["path"])
        if digest(raw) != item["sha256"]:
            raise RuntimeError("Published source differs from approved content: " + item["path"])
        destination.write_bytes(raw)
    check_files(OUTPUT, data)


def remote_directory(ftp, relative):
    ftp.cwd(REMOTE_ROOT)
    for part in PurePosixPath(relative).parts:
        try:
            ftp.mkd(part)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise
        ftp.cwd(part)


def publish(data):
    check_files(OUTPUT, data)
    names = ("HOSTINGER_FTP_SERVER", "HOSTINGER_FTP_USERNAME", "HOSTINGER_FTP_PASSWORD")
    if any(not os.environ.get(name) for name in names):
        raise RuntimeError("The existing Hostinger deployment secrets are incomplete")
    BACKUP.mkdir(exist_ok=True)
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=60)
    try:
        ftp.connect(os.environ[names[0]], 21)
        ftp.login(os.environ[names[1]], os.environ[names[2]])
        ftp.prot_p()
        ftp.cwd(REMOTE_ROOT)
        metadata = {"missing": [], "backed_up": []}
        for item in data["files"]:
            filename = item["path"]
            chunks = []
            try:
                ftp.retrbinary("RETR " + filename, chunks.append)
            except ftplib.error_perm as error:
                if str(error).startswith("550"):
                    metadata["missing"].append(filename)
                    continue
                raise
            destination = BACKUP / filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(b"".join(chunks))
            metadata["backed_up"].append(filename)
        (BACKUP / "backup-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
        print("Current target files backed up before publication")
        items = sorted(data["files"], key=lambda item: item["path"] == "index.html")
        for item in items:
            filename = item["path"]
            remote_directory(ftp, str(PurePosixPath(filename).parent))
            target = PurePosixPath(filename).name
            with (OUTPUT / filename).open("rb") as stream:
                if filename == "index.html":
                    temporary = ".septlion-approved-index-" + os.environ.get("GITHUB_RUN_ID", "release") + ".tmp"
                    ftp.storbinary("STOR " + temporary, stream)
                    ftp.rename(temporary, target)
                else:
                    ftp.storbinary("STOR " + target, stream)
            print("Published " + filename)
        ftp.cwd(REMOTE_ROOT)
        for item in data["files"]:
            chunks = []
            ftp.retrbinary("RETR " + item["path"], chunks.append)
            if digest(b"".join(chunks)) != item["sha256"]:
                raise RuntimeError("Remote file checksum mismatch: " + item["path"])
        print("All uploaded files match the approved checksums")
    finally:
        ftp.close()


def verify(data):
    last_error = None
    for attempt in range(6):
        try:
            for item in data["files"]:
                path = "/" if item["path"] == "index.html" else "/" + item["path"]
                raw = get_url(data["target_origin"] + path)
                if digest(raw) != item["sha256"]:
                    raise RuntimeError("The public domain has not served the approved content: " + item["path"])
            print("Verified public deployment: " + data["target_origin"])
            summary = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary:
                with open(summary, "a") as stream:
                    stream.write("## Approved SEPTLION client published\n\nURL: " + data["target_origin"] + "\n\nAll " + str(len(data["files"])) + " public files match their approved SHA-256 checksums. The client remains a local-storage prototype.\n")
            return
        except Exception as error:
            last_error = error
            if attempt < 5:
                time.sleep(10)
    raise RuntimeError("Public-domain verification failed") from last_error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["validate", "prepare", "publish", "verify"])
    parser.add_argument("--directory", type=Path)
    args = parser.parse_args()
    data = manifest()
    if args.action == "validate":
        if not args.directory:
            parser.error("validate requires --directory")
        check_files(args.directory, data)
    elif args.action == "prepare":
        prepare(data)
    elif args.action == "publish":
        publish(data)
    else:
        verify(data)


if __name__ == "__main__":
    main()
