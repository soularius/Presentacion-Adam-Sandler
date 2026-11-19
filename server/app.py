"""The Sandler Show — remote control server.

  /        -> the presentation (main screen). It follows the remote.
  /admin   -> the same presentation + control panel, protected by ADMIN_PASSWORD.
  /ws      -> WebSocket: anyone with the password (the /admin panel AND the classroom
              screen after typing it once) sends actions; the server replays them on every
              other client, so screen and panel stay in sync both ways. Without the
              password a client can only watch.
  /healthz -> health check.

Run locally:  ADMIN_PASSWORD=secret uvicorn app:app --app-dir server --port 8000
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import re
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse

log = logging.getLogger("sandler")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

PUBLIC = Path(os.getenv("PUBLIC_DIR", Path(__file__).resolve().parent.parent)).resolve()
PASSWORD = os.getenv("ADMIN_PASSWORD", "")
if len(PASSWORD) < 4:
    raise SystemExit("Set ADMIN_PASSWORD (at least 4 characters) before starting the server.")

# Actions the presentation understands (see ACTIONS in script.js). Anything else is dropped.
ALLOWED = {"go", "flip", "swing", "quote", "video", "vclose", "vtoggle", "quiz",
           "quizNext", "check", "zoom", "unzoom", "party", "chibi"}
MAX_MSG = 2_000

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
# socket -> (role, kind). role: "admin" (has the password, can control) | "display" (view only)
#                         kind: "panel" (/admin) | "screen" (/, the classroom screen)
clients: dict[WebSocket, tuple[str, str]] = {}
state: dict[str, int | None] = {"slide": None, "quote": None}


def no_cache(resp):
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/healthz")
async def healthz():
    return PlainTextResponse("ok")


@app.get("/admin")
async def admin():
    return no_cache(FileResponse(PUBLIC / "index.html"))


@app.get("/admin/")
async def admin_slash():
    return RedirectResponse("/admin")


async def send(ws: WebSocket, msg: dict) -> None:
    try:
        await ws.send_text(json.dumps(msg))
    except Exception:  # client went away mid-send
        clients.pop(ws, None)


async def broadcast(msg: dict, exclude: WebSocket | None = None) -> None:
    await asyncio.gather(*(send(c, msg) for c in list(clients) if c is not exclude))


async def announce_admins() -> None:
    n = sum(1 for role, kind in clients.values() if role == "admin" and kind == "panel")
    await broadcast({"t": "admins", "n": n})


def clean(a: str, p: dict) -> dict | None:
    """Validate an action payload; returns the sanitized payload or None."""
    out: dict = {}
    for k in ("i", "k"):
        if k in p:
            if not isinstance(p[k], int) or isinstance(p[k], bool) or not -100 <= p[k] <= 100:
                return None
            out[k] = p[k]
    if a == "video":
        vid = p.get("id")
        if not isinstance(vid, str) or not 6 <= len(vid) <= 20 or not all(ch.isalnum() or ch in "-_" for ch in vid):
            return None
        out["id"], out["v"] = vid, bool(p.get("v"))
    if a == "chibi":
        out["who"] = "majo" if p.get("who") == "majo" else "yined"
    return out


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        hello = json.loads(await asyncio.wait_for(ws.receive_text(), timeout=10))
    except Exception:
        await ws.close(code=4400)
        return

    role = "display"
    kind = "panel" if isinstance(hello, dict) and hello.get("kind") == "panel" else "screen"
    if isinstance(hello, dict) and hello.get("role") == "admin":
        given = str(hello.get("pw", ""))
        if not hmac.compare_digest(given.encode(), PASSWORD.encode()):
            await asyncio.sleep(1.0)  # slow down guessing
            await send(ws, {"t": "denied"})
            await ws.close(code=4401)
            log.info("admin login refused")
            return
        role = "admin"

    clients[ws] = (role, kind)
    log.info("%s/%s connected (%d clients)", role, kind, len(clients))
    await send(ws, {"t": "welcome", "role": role, "state": state})
    await announce_admins()

    try:
        while True:
            raw = await ws.receive_text()
            if role != "admin" or len(raw) > MAX_MSG:
                continue  # without the password you can only watch
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(msg, dict) or msg.get("t") != "act":
                continue
            a, p = msg.get("a"), msg.get("p") or {}
            if a not in ALLOWED or not isinstance(p, dict):
                continue
            p = clean(a, p)
            if p is None:
                continue
            if a == "go":
                state["slide"] = max(0, p.get("i", 0))
            elif a == "quote":
                state["quote"] = p.get("i", 0)
            await broadcast({"t": "act", "a": a, "p": p}, exclude=ws)
    except WebSocketDisconnect:
        pass
    finally:
        clients.pop(ws, None)
        log.info("%s/%s disconnected (%d clients)", role, kind, len(clients))
        await announce_admins()


# Static files: explicit allow-list, so nothing else in the folder (.env, .git, PDF…) is ever served.
STATIC_OK = re.compile(r"^(index\.html|styles\.css|script\.js|assets/(gifs|thumbs|chars)/[A-Za-z0-9_.-]+\.(gif|jpg|png))$")


@app.get("/")
async def index():
    return no_cache(FileResponse(PUBLIC / "index.html"))


@app.get("/{path:path}")
async def static(path: str):
    if not STATIC_OK.match(path) or ".." in path:
        return PlainTextResponse("Not found", status_code=404)
    f = (PUBLIC / path).resolve()
    if not f.is_file() or PUBLIC not in f.parents:
        return PlainTextResponse("Not found", status_code=404)
    resp = FileResponse(f)
    if path.endswith((".html", ".css", ".js")):
        no_cache(resp)
    else:
        resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp
