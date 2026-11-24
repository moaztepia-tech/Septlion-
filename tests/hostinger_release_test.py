"""Tests for scripts/hostinger-release.py against an in-memory fake FTPS server.

Run: python3 -m unittest discover -s tests -p 'hostinger_release_test.py'
"""

import ftplib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("release", Path(__file__).resolve().parents[1] / "scripts/hostinger-release.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
ROOT = release.REMOTE_ROOT


class FakeFTP:
    """Minimal FTP server state. Hides dot files from MLSD like some hosts do. Has no delete."""

    def __init__(self, files):
        self.files = dict(files)  # absolute path -> bytes
        self.dirs = {"/domains/septlion.com", ROOT}
        for path in self.files:
            self._add_parents(path)

    def _add_parents(self, path):
        parts = path.split("/")
        for i in range(2, len(parts)):
            self.dirs.add("/".join(parts[:i]))

    def mlsd(self, directory, facts=()):
        if directory not in self.dirs:
            raise ftplib.error_perm("550 no such directory")
        prefix = directory.rstrip("/") + "/"
        seen = set()
        for path in list(self.files) + list(self.dirs):
            if path.startswith(prefix) and path != directory:
                name = path[len(prefix):].split("/")[0]
                if name in seen or name.startswith("."):
                    continue
                seen.add(name)
                yield name, {"type": "dir" if (prefix + name) in self.dirs else "file"}

    def retrbinary(self, command, callback):
        path = command[5:]
        if path not in self.files:
            raise ftplib.error_perm("550 not found")
        callback(self.files[path])

    def storbinary(self, command, stream):
        path = command[5:]
        self.files[path] = stream.read()
        self._add_parents(path)

    def mkd(self, path):
        if path in self.dirs:
            raise ftplib.error_perm("550 exists")
        self.dirs.add(path)

    def rename(self, old, new):
        if old not in self.files:
            raise ftplib.error_perm("550 not found")
        self.files[new] = self.files.pop(old)

    def close(self):
        pass


def public(fake, name):
    return fake.files.get(ROOT + "/" + name)


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.pkg = self.dir / "deploy"
        (self.pkg / "discover").mkdir(parents=True)
        (self.pkg / "index.html").write_bytes(b"<html>new home</html>")
        (self.pkg / "discover/index.html").write_bytes(b"<html>discover</html>")
        (self.pkg / ".htaccess").write_bytes(b"RewriteEngine On\n")
        (self.pkg / "same.txt").write_bytes(b"same")
        self.fake = FakeFTP({
            ROOT + "/index.html": b"<html>live engine</html>",
            ROOT + "/intake.js": b"live intake engine",
            ROOT + "/.htaccess": b"live hidden rules",
            ROOT + "/same.txt": b"same",
        })
        self.served = {}
        patches = [
            mock.patch.object(release, "connect", lambda: self.fake),
            mock.patch.object(release, "http_get", self.http_get),
            mock.patch.object(release.time, "sleep", lambda s: None),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def http_get(self, url):
        route = url[len(release.ORIGIN):]
        if route in self.served:
            return self.served[route]
        name = "index.html" if route == "/" else route.strip("/") + "/index.html"
        data = public(self.fake, name)
        return (200, data) if data is not None else (404, b"")

    def run_cmd(self, *argv):
        release.main([*argv, "--package", str(self.pkg), "--out", str(self.dir / "out")])

    def plan_id(self, *extra):
        self.run_cmd("plan", *extra)
        return json.loads((self.dir / "out/plan.json").read_text())

    def test_plan_changes_nothing_and_finds_hidden_files(self):
        before = dict(self.fake.files)
        plan = self.plan_id("--full")
        self.assertEqual(self.fake.files, before)
        self.assertEqual(plan["replaced"], [".htaccess", "index.html"])
        self.assertEqual(plan["added"], ["discover/index.html"])
        self.assertEqual(plan["kept"], ["intake.js"])
        self.assertEqual(plan["unchanged"], ["same.txt"])

    def test_fast_plan_matches_full_plan_without_listing(self):
        full = self.plan_id("--full")
        self.fake.mlsd = lambda *a, **k: (_ for _ in ()).throw(AssertionError("fast plan must not list"))
        fast = self.plan_id()
        self.assertEqual(fast["plan_id"], full["plan_id"])
        self.assertEqual((fast["added"], fast["replaced"], fast["unchanged"]), (full["added"], full["replaced"], full["unchanged"]))
        self.assertIsNone(fast["kept"])

    def test_fast_publish_backs_up_touched_files_and_rolls_back(self):
        plan = self.plan_id()
        self.run_cmd("publish", "--plan-id", plan["plan_id"])
        self.assertEqual(public(self.fake, "index.html"), b"<html>new home</html>")
        self.assertEqual(public(self.fake, "intake.js"), b"live intake engine")
        backups = [p for p in self.fake.files if p.startswith(release.REMOTE_BACKUPS) and p.endswith(".tar.gz")]
        saved = release.read_archive(self.fake.files[backups[0]])
        self.assertEqual(set(saved), {".htaccess", "index.html", "same.txt"})
        self.run_cmd("rollback")
        self.assertEqual(public(self.fake, "index.html"), b"<html>live engine</html>")
        self.assertEqual(public(self.fake, ".htaccess"), b"live hidden rules")
        self.assertIsNone(public(self.fake, "discover/index.html"))

    def test_publish_requires_matching_plan_id(self):
        with self.assertRaises(RuntimeError):
            self.run_cmd("publish")
        with self.assertRaises(RuntimeError):
            self.run_cmd("publish", "--plan-id", "0000000000000000")
        self.assertEqual(public(self.fake, "index.html"), b"<html>live engine</html>")

    def test_live_change_after_plan_blocks_publish(self):
        plan = self.plan_id()
        self.fake.files[ROOT + "/index.html"] = b"<html>edited by hand</html>"
        with self.assertRaises(RuntimeError):
            self.run_cmd("publish", "--plan-id", plan["plan_id"])
        self.assertEqual(public(self.fake, "index.html"), b"<html>edited by hand</html>")

    def test_publish_backs_up_keeps_unlisted_files_and_rolls_back(self):
        plan = self.plan_id("--full")
        self.run_cmd("publish", "--plan-id", plan["plan_id"], "--full")
        self.assertEqual(public(self.fake, "index.html"), b"<html>new home</html>")
        self.assertEqual(public(self.fake, "intake.js"), b"live intake engine")
        backups = [p for p in self.fake.files if p.startswith(release.REMOTE_BACKUPS) and p.endswith(".tar.gz")]
        self.assertEqual(len(backups), 1)
        saved = release.read_archive(self.fake.files[backups[0]])
        self.assertEqual(saved[".htaccess"], b"live hidden rules")
        self.assertEqual(saved["index.html"], b"<html>live engine</html>")

        self.run_cmd("rollback")
        self.assertEqual(public(self.fake, "index.html"), b"<html>live engine</html>")
        self.assertEqual(public(self.fake, ".htaccess"), b"live hidden rules")
        self.assertIsNone(public(self.fake, "discover/index.html"))
        self.assertTrue(any(p.startswith(ROOT + "/discover/index.html.rolled-back-") for p in self.fake.files))

    def test_failed_public_check_restores_automatically(self):
        plan = self.plan_id()
        self.served["/discover/"] = (500, b"")
        with self.assertRaises(RuntimeError):
            self.run_cmd("publish", "--plan-id", plan["plan_id"])
        self.assertEqual(public(self.fake, "index.html"), b"<html>live engine</html>")
        self.assertEqual(public(self.fake, ".htaccess"), b"live hidden rules")
        self.assertIsNone(public(self.fake, "discover/index.html"))

    def test_fast_plan_fails_on_transient_read_error_instead_of_calling_it_new(self):
        original = self.fake.retrbinary
        def flaky(command, callback):
            if command.endswith("/index.html"):
                raise ftplib.error_temp("421 try again")
            return original(command, callback)
        self.fake.retrbinary = flaky
        with self.assertRaises(ftplib.error_temp):
            self.plan_id()
        self.fake.retrbinary = lambda c, cb: (_ for _ in ()).throw(ftplib.error_perm("530 denied"))
        with self.assertRaises(ftplib.error_perm):
            self.plan_id()

    def test_release_plans_and_publishes_in_one_run_with_backup(self):
        self.run_cmd("release")
        self.assertEqual(public(self.fake, "index.html"), b"<html>new home</html>")
        self.assertEqual(public(self.fake, "discover/index.html"), b"<html>discover</html>")
        self.assertEqual(public(self.fake, "intake.js"), b"live intake engine")
        backups = [p for p in self.fake.files if p.startswith(release.REMOTE_BACKUPS) and p.endswith(".tar.gz")]
        self.assertEqual(set(release.read_archive(self.fake.files[backups[0]])), {".htaccess", "index.html", "same.txt"})
        self.assertFalse(any(".septlion-upload-" in p for p in self.fake.files))
        self.run_cmd("rollback")
        self.assertEqual(public(self.fake, "index.html"), b"<html>live engine</html>")

    def test_release_with_nothing_changed_writes_nothing(self):
        self.run_cmd("release")
        before = dict(self.fake.files)
        self.run_cmd("release")
        self.assertEqual(self.fake.files, before)

    def test_release_restores_when_public_check_fails(self):
        self.served["/discover/"] = (500, b"")
        with self.assertRaises(RuntimeError):
            self.run_cmd("release")
        self.assertEqual(public(self.fake, "index.html"), b"<html>live engine</html>")
        self.assertIsNone(public(self.fake, "discover/index.html"))

    def test_parallel_uploads_many_files_in_one_folder_without_collisions(self):
        for i in range(40):
            (self.pkg / "discover" / ("p%02d.html" % i)).write_bytes(b"page %d" % i)
        with mock.patch.object(release, "WORKERS", 6):
            self.run_cmd("release")
        for i in range(40):
            self.assertEqual(public(self.fake, "discover/p%02d.html" % i), b"page %d" % i)

    def test_never_deletes(self):
        self.assertFalse(hasattr(FakeFTP, "delete"))
        source = (Path(__file__).resolve().parents[1] / "scripts/hostinger-release.py").read_text()
        for forbidden in (".delete(", ".rmd(", "DELE ", "RMD "):
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main()
