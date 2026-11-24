"""One safe release path for www.septlion.com on Hostinger (FTPS).

Commands (run by .github/workflows/deploy-hostinger.yml, see docs/DEPLOY.md):

  plan     Download the live copy of every file in the package, compare, and
           print the plan: which files are new, which live files would be
           replaced, and a PLAN ID. Nothing on the server changes.
           With --full it downloads all of public_html instead (slow; it also
           lists the live files the package leaves untouched).
  publish  Needs the PLAN ID from a plan run. Re-checks that the live files that
           would be replaced are still exactly the ones that were approved,
           stores a backup of every file it will touch on the server and as a
           workflow artifact (all of public_html with --full),
           uploads only new or changed files, reads every one back, checks the
           public site, and restores the backup automatically if anything fails.
  release  plan and publish in one run: the same checks, backup, read-back,
           public check and automatic restore as publish, without waiting for a
           second run to approve the plan id. For everyday changes.
  rollback Restores a server-side backup made by an earlier publish.

Speed: live files are downloaded and new files uploaded over several FTPS
connections at once (SEPTLION_FTP_WORKERS, default 4), and the platform build
uses a fixed build id, so only files that really changed are replaced.

Safety rules that hold for every command:
  * Nothing is ever deleted on the server (no DELE, no RMD). Files that a
    rollback must take out of service are renamed, so they can be recovered.
  * A backup of every live file the release replaces exists, on the server
    and as an artifact, before the first byte is uploaded. Files outside the
    package are never written, so they need no backup.
  * The FTPS connection verifies the CA chain and hostname before login.
"""

import argparse
import ftplib
import hashlib
import io
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import ssl
import sys
import tarfile
import threading
import time
import urllib.error
import urllib.request

REMOTE_ROOT = "/domains/septlion.com/public_html"
REMOTE_BACKUPS = "/domains/septlion.com/septlion-release-backups"
MANIFEST = REMOTE_BACKUPS + "/live-manifest.json"
ORIGIN = "https://www.septlion.com"
SECRET_NAMES = ("HOSTINGER_FTP_SERVER", "HOSTINGER_FTP_USERNAME", "HOSTINGER_FTP_PASSWORD")
WORKERS = max(1, min(8, int(os.environ.get("SEPTLION_FTP_WORKERS", "4") or 4)))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def log(message):
    print(message, flush=True)


def summary(text):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as stream:
            stream.write(text + "\n")


def safe_relative(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise RuntimeError("Unsafe path in release: " + name)
    return str(path)


# --------------------------------------------------------------------------- FTP


def connect():
    if any(not os.environ.get(name) for name in SECRET_NAMES):
        raise RuntimeError("Hostinger FTPS secrets are missing")
    server = os.environ[SECRET_NAMES[0]].strip()
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=90)
    ftp.connect(server, 21)
    try:
        ipaddress.ip_address(server)
        # Same rule as the proven approved-client release: the account server
        # IP presents Hostinger's shared certificate for `hstgr.io`. CA and
        # hostname verification stay on for control and data sockets.
        ftp.host = "hstgr.io"
    except ValueError:
        pass
    ftp.login(os.environ[SECRET_NAMES[1]], os.environ[SECRET_NAMES[2]])
    ftp.prot_p()
    return ftp


def is_missing(error):
    return str(error).startswith("550")


def walk(ftp, root):
    """Return every regular file under root as relative POSIX paths."""
    found = []
    pending = [""]
    while pending:
        relative = pending.pop()
        directory = root + ("/" + relative if relative else "")
        for name, facts in ftp.mlsd(directory, facts=["type"]):
            kind = facts.get("type", "")
            if name in (".", "..") or kind in ("cdir", "pdir"):
                continue
            child = relative + "/" + name if relative else name
            if kind == "dir":
                pending.append(child)
            elif kind == "file":
                found.append(child)
    return sorted(found)


def fetch(ftp, path):
    chunks = []
    ftp.retrbinary("RETR " + path, chunks.append)
    return b"".join(chunks)


def try_fetch(ftp, path):
    try:
        return fetch(ftp, path)
    except ftplib.error_perm as error:
        if is_missing(error):
            return None
        raise


def ensure_directory(ftp, root, relative_dir):
    current = root
    for part in PurePosixPath(relative_dir).parts:
        current = current + "/" + part
        try:
            ftp.mkd(current)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise


def in_parallel(items, job, workers=None):
    """Run job(ftp, item) for every item over up to `workers` FTPS connections.

    Each worker owns its own connection (ftplib connections are not shared
    between threads). Returns {item: result}. The first error stops the others
    and is raised once they have finished.
    """
    items = list(items)
    if not items:
        return {}
    count = min(workers or WORKERS, len(items))
    results, errors, refused, lock = {}, [], [], threading.Lock()
    pending = iter(items)

    def worker():
        try:
            ftp = connect()
        except Exception as error:  # noqa: BLE001 - a host may cap connections; the others carry on
            with lock:
                refused.append(error)
            return
        try:
            while True:
                with lock:
                    if errors:
                        return
                    item = next(pending, None)
                if item is None:
                    return
                try:
                    value = job(ftp, item)
                except Exception as error:  # noqa: BLE001 - reported below
                    with lock:
                        errors.append(error)
                    return
                with lock:
                    results[item] = value
        finally:
            try:
                ftp.close()
            except Exception:  # noqa: BLE001
                pass

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    if errors:
        raise errors[0]
    if len(refused) == count:
        raise refused[0]
    if refused:
        log("Note: %d of %d FTPS connections were refused; the rest finished the work." % (len(refused), count))
    if len(results) != len(items):
        raise RuntimeError("Transfer incomplete: %d of %d files" % (len(results), len(items)))
    return results


def fresh(ftp):
    """A new control connection: the old one may have been closed by the server
    while the parallel workers were busy (idle timeout shows up as EOFError)."""
    try:
        ftp.close()
    except Exception:  # noqa: BLE001
        pass
    return connect()


def store(ftp, root, relative, data, tag):
    """Upload to a temporary name, then rename over the target (atomic swap)."""
    parent = str(PurePosixPath(relative).parent)
    if parent != ".":
        ensure_directory(ftp, root, parent)
    target = root + "/" + relative
    temporary = root + "/" + (parent + "/" if parent != "." else "") + ".septlion-upload-" + tag + "-" + digest(relative.encode())[:10] + ".tmp"
    ftp.storbinary("STOR " + temporary, io.BytesIO(data))
    ftp.rename(temporary, target)


def list_facts(paths):
    """{relative: modification time} from MDTM, for the paths that exist on the server.

    MDTM is a control-channel command (no data connection per file), so it is
    fast; it runs over the parallel connections. A path the server reports as
    missing, or a server that does not support MDTM, gives no entry, and the
    caller then downloads that file.
    """
    def mdtm(conn, path):
        try:
            reply = conn.sendcmd("MDTM " + REMOTE_ROOT + "/" + path)
        except ftplib.error_perm:
            return None
        return reply.split()[-1] if reply.startswith("213") else None

    return {path: value for path, value in in_parallel(sorted(paths), mdtm).items() if value}


def read_manifest(ftp):
    try:
        raw = try_fetch(ftp, MANIFEST)
        data = json.loads(raw) if raw else {}
        return data.get("files", {}) if data.get("v") == 1 else {}
    except (ValueError, AttributeError):
        return {}


def write_manifest(ftp, package, tag):
    """Record size, time and checksum of every package file as it is live now."""
    facts = list_facts(package)
    files = {path: {"modify": facts[path], "sha256": digest(data)} for path, data in package.items() if path in facts}
    ftp = fresh(ftp)  # the control connection sat idle while the workers asked for the times
    ensure_directory(ftp, "/domains/septlion.com", PurePosixPath(REMOTE_BACKUPS).name)
    store(ftp, REMOTE_BACKUPS, "live-manifest.json", json.dumps({"v": 1, "files": files}, sort_keys=True).encode(), tag + "-m")
    log("Live manifest updated for %d files." % len(files))


def quick_snapshot(ftp, package):
    """Like snapshot(ftp, package), but downloads only what may differ.

    A live file whose modification time still matches the manifest
    written by the last release, and whose recorded checksum equals the new
    file, is identical: it is taken from the package without downloading.
    Everything else (changed, unknown, hidden, or edited by hand on the server,
    which changes its time) is downloaded as before.
    """
    manifest = read_manifest(ftp)
    if not manifest:
        log("No live manifest yet: downloading every package file once.")
        return snapshot(ftp, package)
    facts = list_facts(package)
    same, fetch_list = {}, []
    for path, data in package.items():
        entry = manifest.get(path)
        known = path in facts and entry and entry.get("modify") == facts[path]
        if known and not PurePosixPath(path).name.startswith(".") and entry.get("sha256") == digest(data):
            same[path] = data
        else:
            # Changed, unknown, hidden or new: read it from the server (a missing file reads as new).
            fetch_list.append(path)
    live = snapshot(ftp, fetch_list)
    live.update(same)
    log("Compared %d files from the manifest; downloaded %d." % (len(same), len(fetch_list)))
    return live


def snapshot(ftp, probe=(), full=False):
    """Download live files: {relative path: bytes}.

    By default only the paths in `probe` (the package) are fetched, one by one,
    which is all a release can replace, so the plan id and the backup are the
    same as with a full scan. With full=True all of public_html is walked too.
    Fetching by path also finds dot files such as .htaccess that some FTP
    servers hide from listings; a hidden live file counts as replaced, never new.
    """
    listed = [r for r in (walk(ftp, REMOTE_ROOT) if full else ()) if not PurePosixPath(r).name.startswith(".septlion-upload-")]
    files = in_parallel(listed, lambda conn, relative: fetch(conn, REMOTE_ROOT + "/" + relative))
    probed = in_parallel([r for r in probe if r not in files], lambda conn, relative: try_fetch(conn, REMOTE_ROOT + "/" + relative))
    files.update({relative: data for relative, data in probed.items() if data is not None})
    return files


# ----------------------------------------------------------------------- package


def read_package(directory):
    directory = Path(directory)
    if not (directory / "index.html").is_file():
        raise RuntimeError("Package has no index.html: " + str(directory))
    files = {}
    for path in sorted(directory.rglob("*")):
        if path.is_file():
            files[safe_relative(path.relative_to(directory).as_posix())] = path.read_bytes()
    return files


def make_plan(live, package, full=True):
    added = sorted(path for path in package if path not in live)
    replaced = sorted(path for path in package if path in live and live[path] != package[path])
    unchanged = sorted(path for path in package if path in live and live[path] == package[path])
    kept = sorted(path for path in live if path not in package) if full else None
    # The plan id covers what would be lost: each live file that gets replaced
    # and its exact current content. Rebuilding the package does not change it,
    # but any change on the live site does.
    basis = "\n".join(path + " " + digest(live[path]) for path in replaced)
    plan_id = digest(("septlion-plan-v1\n" + basis).encode())[:16]
    return {"plan_id": plan_id, "added": added, "replaced": replaced, "unchanged": unchanged, "kept": kept}


def describe(plan, live, package):
    lines = [
        "## Release plan " + plan["plan_id"],
        "",
        "* New files: %d" % len(plan["added"]),
        "* Live files that will be **replaced** (backed up first): %d" % len(plan["replaced"]),
        "* Identical, not re-uploaded: %d" % len(plan["unchanged"]),
        ("* Live files not in this package, **kept untouched**: %d" % len(plan["kept"])) if plan["kept"] is not None
        else "* Live files not in this package: not scanned (fast plan); they are never written",
        "",
    ]
    if plan["replaced"]:
        lines += ["### Replaced live files", "", "| File | Live size | New size |", "|---|---|---|"]
        lines += ["| `%s` | %d | %d |" % (path, len(live[path]), len(package[path])) for path in plan["replaced"]]
        lines.append("")
    lines += [
        "To publish exactly this, run the workflow again with **mode = publish** and **plan_id = %s**." % plan["plan_id"],
        "If the live site changes before then, the id will no longer match and publish stops.",
    ]
    return "\n".join(lines)


# ------------------------------------------------------------------------ backup


def backup_archive(live):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for path in sorted(live):
            info = tarfile.TarInfo(path)
            info.size = len(live[path])
            info.mtime = 0
            archive.addfile(info, io.BytesIO(live[path]))
    return buffer.getvalue()


def read_archive(raw):
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        for member in archive.getmembers():
            if member.isfile():
                files[safe_relative(member.name)] = archive.extractfile(member).read()
    return files


# ----------------------------------------------------------------------- checks


def http_get(url):
    request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Septlion-Release-Check/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.status, response.read()


def smoke_targets(package):
    """Public pages to check: home plus every top-level route page in the package."""
    targets = []
    for path in sorted(package):
        if path == "index.html":
            targets.append(("/", path))
        elif path.endswith("/index.html") and path.count("/") == 1 and not path.startswith("_"):
            targets.append(("/" + path[: -len("index.html")], path))
    return targets


def smoke(package, attempts=6):
    targets = smoke_targets(package)
    last = None
    for attempt in range(attempts):
        failures = []
        for route, path in targets:
            try:
                status, body = http_get(ORIGIN + route)
                if status != 200:
                    failures.append("%s returned %d" % (route, status))
                elif path == "index.html" and digest(body) != digest(package[path]):
                    failures.append("/ does not serve the new index.html yet")
            except (urllib.error.URLError, OSError) as error:
                failures.append("%s: %s" % (route, error))
        if not failures:
            log("Public site check passed for %d pages." % len(targets))
            return
        last = failures
        log("Public site check attempt %d failed: %s" % (attempt + 1, "; ".join(failures[:5])))
        if attempt < attempts - 1:
            time.sleep(10)
    raise RuntimeError("Public site check failed: " + "; ".join(last[:10]))


# ------------------------------------------------------------------------ restore


def restore(ftp, backup_files, record, tag):
    """Put back every replaced file and take every added file out of service by renaming it."""
    for path in record["replaced"]:
        store(ftp, REMOTE_ROOT, path, backup_files[path], tag + "-r")
        if fetch(ftp, REMOTE_ROOT + "/" + path) != backup_files[path]:
            raise RuntimeError("Restore read-back mismatch: " + path)
    for path in record["added"]:
        try:
            ftp.rename(REMOTE_ROOT + "/" + path, REMOTE_ROOT + "/" + path + ".rolled-back-" + tag)
        except ftplib.error_perm as error:
            if not is_missing(error):
                raise
    log("Restored %d replaced files; set aside %d added files (renamed, not deleted)." % (len(record["replaced"]), len(record["added"])))


# ----------------------------------------------------------------------- commands


def run_id():
    return os.environ.get("GITHUB_RUN_ID", time.strftime("%Y%m%d%H%M%S"))


def cmd_plan(args):
    package = read_package(args.package)
    ftp = connect()
    try:
        live = snapshot(ftp, package, True) if args.full else quick_snapshot(ftp, package)
    finally:
        ftp.close()
    plan = make_plan(live, package, args.full)
    text = describe(plan, live, package)
    log(text)
    summary(text)
    Path(args.out).mkdir(parents=True, exist_ok=True)
    Path(args.out, "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    Path(args.out, "live-before.tar.gz").write_bytes(backup_archive(live))


def cmd_release(args):
    """Plan and publish in one run. The plan is printed and kept, then published at once."""
    cmd_publish(args, approve_current=True)


def cmd_publish(args, approve_current=False):
    if not args.plan_id and not approve_current:
        raise RuntimeError("publish needs plan_id from a plan run (see docs/DEPLOY.md)")
    package = read_package(args.package)
    tag = run_id()
    name = time.strftime("%Y%m%d-%H%M%S") + "-run" + tag
    ftp = connect()
    try:
        live = snapshot(ftp, package, True) if args.full else quick_snapshot(ftp, package)
        ftp = fresh(ftp)
        plan = make_plan(live, package, args.full)
        if approve_current:
            text = describe(plan, live, package)
            log(text)
            summary(text)
            if not plan["added"] and not plan["replaced"]:
                summary("## Nothing to publish\n\nThe live site already matches this build.")
                log("Nothing to publish: the live site already matches this build.")
                return
            args.plan_id = plan["plan_id"]
        if plan["plan_id"] != args.plan_id:
            text = describe(plan, live, package)
            summary("## SAFETY STOP\n\nThe live site no longer matches the approved plan %s. Nothing was changed.\n\n%s" % (args.plan_id, text))
            raise RuntimeError("Plan id mismatch: approved %s, current %s. Nothing was changed." % (args.plan_id, plan["plan_id"]))

        # 1. Backup of the live files this release touches (all of public_html with --full),
        #    saved locally (artifact) and on the server outside public_html.
        archive = backup_archive(live)
        record = {"name": name, "plan_id": plan["plan_id"], "commit": os.environ.get("GITHUB_SHA", ""),
                  "added": plan["added"], "replaced": plan["replaced"], "backup_sha256": digest(archive)}
        Path(args.out).mkdir(parents=True, exist_ok=True)
        Path(args.out, name + ".tar.gz").write_bytes(archive)
        Path(args.out, name + ".release.json").write_text(json.dumps(record, indent=2) + "\n")
        ensure_directory(ftp, "/domains/septlion.com", PurePosixPath(REMOTE_BACKUPS).name)
        store(ftp, REMOTE_BACKUPS, name + ".tar.gz", archive, tag + "-b")
        if digest(fetch(ftp, REMOTE_BACKUPS + "/" + name + ".tar.gz")) != record["backup_sha256"]:
            raise RuntimeError("Server backup read-back mismatch. Nothing was published.")
        store(ftp, REMOTE_BACKUPS, name + ".release.json", json.dumps(record, indent=2).encode(), tag + "-j")
        log("Backup of %d live files stored: %s" % (len(live), name))

        # 2. Upload new and changed files; index.html last so the old home stays up until assets exist.
        order = [p for p in plan["added"] + plan["replaced"] if p != "index.html"]
        last = [p for p in plan["added"] + plan["replaced"] if p == "index.html"]

        def upload(conn, path):
            store(conn, REMOTE_ROOT, path, package[path], tag)
            if fetch(conn, REMOTE_ROOT + "/" + path) != package[path]:
                raise RuntimeError("Read-back mismatch: " + path)

        try:
            # Directories first, from one connection, so parallel uploads never race to create them.
            for parent in sorted({str(PurePosixPath(p).parent) for p in order + last} - {"."}):
                ensure_directory(ftp, REMOTE_ROOT, parent)
            in_parallel(order, upload)
            ftp = fresh(ftp)
            for path in last:
                upload(ftp, path)
            log("Uploaded and verified %d files." % (len(order) + len(last)))
            order = order + last
            if not args.skip_smoke:
                smoke(package)
        except Exception as error:
            log("Release failed (%s). Restoring backup %s." % (error, name))
            ftp.close()
            ftp = connect()
            restore(ftp, live, record, tag)
            summary("## Release failed and was rolled back\n\nBackup `%s` restored. Cause: %s" % (name, error))
            raise
        try:
            ftp = fresh(ftp)
            write_manifest(ftp, package, tag)
        except Exception as error:  # noqa: BLE001 - the release itself is done
            log("Note: live manifest not updated (%s: %s); the next release downloads all files." % (type(error).__name__, error))
        summary("## Released\n\nPlan `%s`, backup `%s`. %d files uploaded. To undo: run mode = rollback, backup_name = `%s`." % (plan["plan_id"], name, len(order), name))
        log("Released. Backup name for rollback: " + name)
    finally:
        try:
            ftp.close()
        except Exception:
            pass


def cmd_rollback(args):
    tag = run_id()
    ftp = connect()
    try:
        try:
            names = sorted(n for n in walk(ftp, REMOTE_BACKUPS) if n.endswith(".release.json"))
        except ftplib.error_perm:
            names = []
        if not names:
            raise RuntimeError("No server backups found in " + REMOTE_BACKUPS)
        name = args.backup_name or names[-1][: -len(".release.json")]
        record = json.loads(fetch(ftp, REMOTE_BACKUPS + "/" + name + ".release.json"))
        archive = fetch(ftp, REMOTE_BACKUPS + "/" + name + ".tar.gz")
        if digest(archive) != record["backup_sha256"]:
            raise RuntimeError("Backup archive checksum mismatch: " + name)
        backup_files = read_archive(archive)
        # Keep a backup of the state we are rolling back from, too.
        current = snapshot(ftp, set(backup_files) | set(record["added"]), args.full)
        ftp = fresh(ftp)
        before = backup_archive(current)
        pre = name + "-before-rollback-run" + tag
        store(ftp, REMOTE_BACKUPS, pre + ".tar.gz", before, tag + "-b")
        Path(args.out).mkdir(parents=True, exist_ok=True)
        Path(args.out, pre + ".tar.gz").write_bytes(before)
        restore(ftp, backup_files, record, tag)
        summary("## Rolled back\n\nRestored backup `%s`. The state before this rollback is saved as `%s`." % (name, pre))
        log("Rolled back to backup " + name)
    finally:
        ftp.close()


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["plan", "publish", "release", "rollback"])
    parser.add_argument("--package", default="deploy")
    parser.add_argument("--plan-id", default="")
    parser.add_argument("--backup-name", default="")
    parser.add_argument("--out", default="release-backup")
    parser.add_argument("--skip-smoke", action="store_true")
    parser.add_argument("--full", action="store_true", help="scan and back up all of public_html (slow)")
    args = parser.parse_args(argv)
    {"plan": cmd_plan, "publish": cmd_publish, "release": cmd_release, "rollback": cmd_rollback}[args.command](args)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("ERROR: %s: %s" % (type(error).__name__, error), file=sys.stderr)
        sys.exit(1)
