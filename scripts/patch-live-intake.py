from pathlib import Path
import hashlib, sys
if len(sys.argv)!=4:
    raise SystemExit("usage: patch-live-intake.py original.html handler.js patched.html")
original=Path(sys.argv[1]).read_bytes()
approved="7cae91d2f051aa0656fce02ef0cfea44423b1099235761418a67c72ceec39bc9"
if hashlib.sha256(original).hexdigest()!=approved:
    raise SystemExit("Live page changed. No update allowed.")
source=original.decode("utf-8")
begin="function send(text){"
end="input.maxLength=2000;"
if source.count(begin)!=1 or source.count(end)!=1:
    raise SystemExit("Original composer not found.")
a=source.index(begin)
b=source.index(end,a)
handler=source[a:b]
if hashlib.sha256(handler.encode()).hexdigest()!="f3ae891b4e0df08d13a9aee44da875b0828fdd18b76c5be8b585addaabe3b3f1":
    raise SystemExit("Original handler changed.")
replacement=Path(sys.argv[2]).read_text("utf-8").rstrip("\n")+"\n"
if replacement.count(begin)!=1 or "Intake.consume(needDraft,t,PRODUCTS)" not in replacement:
    raise SystemExit("New handler incompatible with current site.")
updated=source[:a]+replacement+source[b:]
Path(sys.argv[3]).write_bytes(updated.encode("utf-8"))
print("Verified: the original interface is preserved; only send() was changed.")
