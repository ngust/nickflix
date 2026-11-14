#!/usr/bin/env python3
"""Open a local login window, SSH to the QNAP once, and start nfproxy.
Password stays in memory on this PC, is never printed, and is wiped on exit.
"""
from __future__ import annotations

import os
import socket
import sys
import time
import traceback
from pathlib import Path

DIR = Path(__file__).resolve().parent
RESULT = DIR / "result.txt"
HOST = os.environ.get("NF_NAS_HOST", "192.168.1.50")   # your NAS address
USER = os.environ.get("NF_NAS_USER", "admin")          # your NAS SSH user
REMOTE = r"""
set +e
log() { printf 'NF:%s\n' "$1"; }
log "id=$(id | tr -s ' ')"
log "uname=$(uname -a)"
log "arch=$(uname -m)"
PY=""
for c in python3 python /usr/bin/python3 /usr/local/bin/python3 /opt/bin/python3 \
  /opt/bin/python3.12 /opt/bin/python3.11 /opt/bin/python3.10 /opt/bin/python3.9 /opt/bin/python3.8 \
  /share/CACHEDEV1_DATA/.qpkg/Python3/usr/bin/python3 \
  /share/CACHEDEV1_DATA/.qpkg/Python3/bin/python3 \
  /share/CACHEDEV1_DATA/.qpkg/Entware/bin/python3 \
  /opt/Entware/bin/python3 /usr/local/Python/bin/python3
 do
  if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then
    ver=$("$c" -c 'import sys; print("%d.%d"%sys.version_info[:2])' 2>/dev/null) || continue
    major=${ver%%.*}; minor=${ver#*.}
    if [ -n "$major" ] && [ "$major" -ge 3 ] && [ "$minor" -ge 7 ]; then PY=$c; log "python=$c $ver"; break; fi
  fi
done
if [ -z "$PY" ]; then
  log "NO_PYTHON"
  log "qpkg=$(ls /share/CACHEDEV1_DATA/.qpkg 2>/dev/null | tr '\n' ' ')"
  log "docker=$(command -v docker 2>/dev/null)"
  log "which_py=$(command -v python3 python 2>/dev/null | tr '\n' ' ')"
fi
DIR=""
for d in /share/General/nfproxy /share/CACHEDEV1_DATA/General/nfproxy /share/*/General/nfproxy; do
  if [ -f "$d/nfproxy.py" ]; then DIR=$d; break; fi
done
if [ -z "$DIR" ]; then
  found=$(find /share -name nfproxy.py \( -path '*/@Recycle/*' -o -path '*/@Recently-Snapshot/*' \) -prune -o -name nfproxy.py -print 2>/dev/null | head -1)
  if [ -n "$found" ]; then DIR=$(dirname "$found"); fi
fi
log "dir=${DIR:-MISSING}"
log "docker=$(command -v docker 2>/dev/null || echo none)"
if [ -z "$DIR" ]; then log "FAIL no nfproxy dir"; exit 3; fi

# Portable Python dropped on the share (aarch64, glibc 2.17+)
if [ -z "$PY" ]; then
  if [ ! -x "$DIR/runtime/bin/python3.12" ] && [ ! -x "$DIR/runtime/bin/python3" ]; then
    TB=""
    [ -f "$DIR/runtime-python.tar.gz" ] && TB="$DIR/runtime-python.tar.gz"
    if [ -n "$TB" ]; then
      log "extracting_runtime"
      rm -rf "$DIR/runtime.tmp"
      mkdir -p "$DIR/runtime.tmp"
      if tar -xzf "$TB" -C "$DIR/runtime.tmp"; then
        if [ -d "$DIR/runtime.tmp/python/bin" ]; then
          rm -rf "$DIR/runtime"
          mv "$DIR/runtime.tmp/python" "$DIR/runtime"
          log "extracted_runtime"
        else
          log "extract_unexpected_layout=$(ls -A "$DIR/runtime.tmp" 2>/dev/null | tr '\n' ' ')"
        fi
      else
        log "extract_failed"
      fi
      rm -rf "$DIR/runtime.tmp"
      chmod -R u+rx "$DIR/runtime/bin" "$DIR/runtime/lib" 2>/dev/null
    else
      log "no_runtime_tarball"
    fi
  fi
  for c in "$DIR/runtime/bin/python3.12" "$DIR/runtime/bin/python3"; do
    if [ -e "$c" ]; then
      chmod u+rx "$c" 2>/dev/null
      ver=$("$c" -c 'import sys; print("%d.%d"%sys.version_info[:2])' 2>/dev/null) || ver=""
      if [ -z "$ver" ]; then
        err=$("$c" -V 2>&1 | tr '\n' ' ' | head -c 200)
        log "runtime_py_err=$err"
        continue
      fi
      major=${ver%%.*}; minor=${ver#*.}
      if [ -n "$major" ] && [ "$major" -ge 3 ] && [ "$minor" -ge 7 ]; then
        PY=$c
        log "python=$c $ver"
        break
      fi
    fi
  done
fi
if [ -z "$PY" ]; then log "FAIL no python3.7+"; exit 2; fi
cd "$DIR" || { log "FAIL cd"; exit 4; }

# If already healthy, do not restart (would drop a live stream if one existed)
if [ -f nfproxy.pid ]; then
  old=$(tr -dc '0-9' < nfproxy.pid)
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
    hl=$(wget -qO- --timeout=3 http://127.0.0.1:8765/health 2>/dev/null || curl -s --max-time 3 http://127.0.0.1:8765/health 2>/dev/null)
    log "existing_pid=$old health=${hl:-none}"
    if [ "$hl" = "ok" ]; then log "ALREADY_RUNNING"; exit 0; fi
    kill "$old" 2>/dev/null; sleep 1
  fi
fi

# Start via a tiny launcher so CRLF in nfproxy.env is harmless; do not print env values
"$PY" - << 'LAUNCH'
import os, sys, subprocess, time
from pathlib import Path
here = Path(os.environ.get("PWD") or ".").resolve()
# PWD may be wrong; use script cwd
here = Path(".").resolve()
env = os.environ.copy()
for line in (here / "nfproxy.env").read_text(encoding="utf-8", errors="replace").splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    k, v = k.strip(), v.strip()
    if " #" in v:
        v = v.split(" #", 1)[0].strip()
    if k:
        env[k] = v
env["PYTHONUNBUFFERED"] = "1"
logf = open(here / "nfproxy.log", "ab", buffering=0)
proc = subprocess.Popen(
    [sys.executable, "-u", str(here / "nfproxy.py")],
    cwd=str(here), env=env, stdout=logf, stderr=subprocess.STDOUT,
    start_new_session=True,
)
(here / "nfproxy.pid").write_text(str(proc.pid), encoding="ascii")
print("NF:started_pid=%d" % proc.pid)
LAUNCH

sleep 2
health_py() { "$PY" -c 'import urllib.request,sys
u=sys.argv[1]
try:
    print(urllib.request.urlopen(u,timeout=3).read().decode("utf-8","replace"))
except Exception:
    pass' "$1" 2>/dev/null; }
hl=$(health_py http://127.0.0.1:8765/health)
st=$(health_py http://127.0.0.1:8765/status)
log "health=${hl:-none}"
# status is JSON without credentials; truncate in case
log "status=$(printf '%s' "$st" | head -c 400)"
if [ "$hl" = "ok" ]; then log "SUCCESS"; exit 0; fi
# last log lines, redacting possible URLs
if [ -f nfproxy.log ]; then
  log "tail=$(tail -n 8 nfproxy.log | tr '\n' '|' | sed -E 's#https?://[^[:space:]/|]+#http://REDACTED#g')"
fi
log "FAIL not healthy"
exit 5
"""


def write_result(text: str) -> None:
    RESULT.write_text(text.rstrip() + "\n", encoding="utf-8")


def ssh_and_start(password: str) -> tuple[int, str]:
    import subprocess
    import tempfile

    work = DIR / "_tmp"
    work.mkdir(exist_ok=True)
    pwfile = work / "p.dat"
    askcmd = work / "ask.cmd"
    python = sys.executable.replace("pythonw.exe", "python.exe").replace("pythonw", "python")
    ssh = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "OpenSSH" / "ssh.exe"
    try:
        pwfile.write_bytes(password.encode("utf-8"))
        try:
            user = os.getlogin()
        except Exception:
            user = os.environ.get("USERNAME", "")
        subprocess.run(
            ["icacls", str(pwfile), "/inheritance:r", "/grant:r", f"{user}:F"],
            capture_output=True, timeout=10, creationflags=0x08000000,
        )
        askcmd.write_text(
            "@echo off\r\n"
            + f"\"{python}\" -c \"import pathlib,sys; sys.stdout.buffer.write(pathlib.Path(r'{pwfile}').read_bytes())\"\r\n",
            encoding="ascii",
        )
        env = os.environ.copy()
        env["SSH_ASKPASS"] = str(askcmd)
        env["SSH_ASKPASS_REQUIRE"] = "force"
        env["DISPLAY"] = "needed"
        env.pop("SSH_AUTH_SOCK", None)
        cmd = [
            str(ssh),
            "-o", "PreferredAuthentications=keyboard-interactive,password",
            "-o", "PubkeyAuthentication=no",
            "-o", "KbdInteractiveAuthentication=yes",
            "-o", "PasswordAuthentication=yes",
            "-o", "NumberOfPasswordPrompts=1",
            "-o", "ConnectTimeout=15",
            "-o", "StrictHostKeyChecking=yes",
            "-o", "IPQoS=none",
            "-o", "MACs=hmac-sha2-256",
            "-o", "Ciphers=aes128-ctr",
            "-o", "LogLevel=ERROR",
            "-o", "IdentitiesOnly=yes",
            f"{USER}@{HOST}",
            "bash -s",
        ]
        r = subprocess.run(
            cmd,
            input=REMOTE.encode("utf-8"),
            env=env,
            capture_output=True,
            timeout=90,
            creationflags=0x08000000,  # CREATE_NO_WINDOW
            stdin=None,  # replaced by input=
        )
        out = (r.stdout or b"").decode("utf-8", "replace")
        err = (r.stderr or b"").decode("utf-8", "replace")
        combined = (out + ("\n" + err if err else "")).strip()
        # Classify auth failure without echoing any secret
        low = combined.lower()
        if r.returncode != 0 and ("permission denied" in low or "authentication" in low and "fail" in low):
            return 1, "AUTH_FAILED"
        return r.returncode, combined
    except subprocess.TimeoutExpired:
        return 1, "CONNECT_FAILED TimeoutExpired"
    except Exception:
        return 1, "CONNECT_FAILED %s" % type(sys.exc_info()[1]).__name__
    finally:
        try:
            if pwfile.exists():
                pwfile.write_bytes(b"\0" * 256)
                pwfile.unlink()
            if askcmd.exists():
                askcmd.unlink()
        except Exception:
            pass


def ask_password() -> str | None:
    import tkinter as tk
    from tkinter import ttk

    result = {"pw": None}

    root = tk.Tk()
    root.title("Start NickFlix home buffering proxy")
    root.resizable(False, False)
    root.attributes("-topmost", True)
    try:
        root.attributes("-toolwindow", False)
    except tk.TclError:
        pass
    root.geometry("+{}+{}".format(
        max(80, root.winfo_screenwidth() // 2 - 250),
        max(80, root.winfo_screenheight() // 2 - 120),
    ))

    frm = ttk.Frame(root, padding=18)
    frm.grid(row=0, column=0, sticky="nsew")
    msg = (
        f"Enter the QNAP password for user  {USER}  on {HOST}.\n"
        "This is the same account as the file share.\n"
        "The password stays on this PC and is not sent to the chat."
    )
    ttk.Label(frm, text=msg, justify="left").grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 12))
    ttk.Label(frm, text="Password:").grid(row=1, column=0, sticky="e", padx=(0, 8))
    pw = ttk.Entry(frm, show="•", width=36)
    pw.grid(row=1, column=1, sticky="w")
    pw.focus_set()

    def accept(_event=None):
        val = pw.get()
        if not val:
            return
        result["pw"] = val
        pw.delete(0, "end")
        root.destroy()

    def cancel(_event=None):
        result["pw"] = None
        pw.delete(0, "end")
        root.destroy()

    btns = ttk.Frame(frm)
    btns.grid(row=2, column=0, columnspan=2, sticky="e", pady=(16, 0))
    ttk.Button(btns, text="Cancel", command=cancel).grid(row=0, column=0, padx=(0, 8))
    ok = ttk.Button(btns, text="Start the proxy", command=accept)
    ok.grid(row=0, column=1)
    root.bind("<Return>", accept)
    root.bind("<Escape>", cancel)
    root.protocol("WM_DELETE_WINDOW", cancel)

    def timeout():
        result["pw"] = None
        try:
            pw.delete(0, "end")
            root.destroy()
        except tk.TclError:
            pass
        write_result("TIMEOUT")

    root.after(5 * 60 * 1000, timeout)
    try:
        root.lift()
        root.focus_force()
        pw.focus_force()
    except tk.TclError:
        pass
    try:
        import winsound
        winsound.MessageBeep(winsound.MB_ICONASTERISK)
    except Exception:
        pass
    root.mainloop()
    return result["pw"]


def main() -> int:
    write_result("WAITING_FOR_PASSWORD")
    try:
        pw = ask_password()
        if not pw:
            if RESULT.read_text(encoding="utf-8").strip() != "TIMEOUT":
                write_result("CANCELLED")
            return 2
        code, out = ssh_and_start(pw)
        pw = None  # noqa: F841
        write_result("exit=%s\n%s" % (code, out))
        return 0 if (code == 0 and "NF:SUCCESS" in out or "NF:ALREADY_RUNNING" in out) else 1
    except Exception:
        # Never include exception details that might echo a password
        write_result("UI_ERROR %s" % type(sys.exc_info()[1]).__name__)
        return 1


if __name__ == "__main__":
    sys.exit(main())
