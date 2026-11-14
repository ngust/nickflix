#!/usr/bin/env python3
"""Start nfproxy.py detached with the settings from nfproxy.env (CRLF and inline comments tolerated; values never printed)."""
import os, subprocess, sys
from pathlib import Path
here = Path(__file__).resolve().parent
env = os.environ.copy()
envf = here / "nfproxy.env"
if envf.exists():
    for line in envf.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s: continue
        k, v = s.split("=", 1); k, v = k.strip(), v.strip()
        if " #" in v: v = v.split(" #", 1)[0].strip()
        if k: env[k] = v
env["PYTHONUNBUFFERED"] = "1"
logf = open(here / "nfproxy.log", "ab", buffering=0)
p = subprocess.Popen([sys.executable, "-u", str(here / "nfproxy.py")], cwd=str(here), env=env, stdout=logf, stderr=subprocess.STDOUT,
                     stdin=subprocess.DEVNULL, start_new_session=True)
(here / "nfproxy.pid").write_text(str(p.pid), encoding="ascii")
print("started pid %d" % p.pid)
