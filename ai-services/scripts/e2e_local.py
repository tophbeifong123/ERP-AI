"""Local end-to-end test of the async-callback plumbing.

Spins up a mock "backend" callback server, then drives the REAL service
(routes + auth + BackgroundTasks + httpx callback). Verifies the whole
transport round-trip that unit tests mock out:

  request + X-Internal-Token  ->  202 Accepted  ->  background task
                              ->  real POST callback  ->  payload/header check

The core checks use the rule-based decision path (weekly target reached), so
they need NO Groq call and are deterministic/free. Pass --with-groq to also
exercise a real caption generation through the same plumbing.

Run from the ai-services folder:
    PYTHONIOENCODING=utf-8 venv/Scripts/python.exe scripts/e2e_local.py
    PYTHONIOENCODING=utf-8 venv/Scripts/python.exe scripts/e2e_local.py --with-groq
"""
import argparse
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# Set the shared secret BEFORE importing the app so settings picks it up
# (env vars take precedence over .env in pydantic-settings).
TOKEN = "e2e-test-secret"
os.environ["INTERNAL_TOKEN"] = TOKEN

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.config import settings  # noqa: E402

CALLBACK_PORT = 9911
CALLBACK_HOST = "127.0.0.1"

# Records every callback the mock backend receives.
received: list[dict] = []


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        received.append({
            "path": self.path,
            "token": self.headers.get("X-Internal-Token"),
            "content_type": self.headers.get("Content-Type"),
            "body": json.loads(body) if body else None,
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *args):  # silence the default logging
        pass


def _start_mock_backend() -> HTTPServer:
    server = HTTPServer((CALLBACK_HOST, CALLBACK_PORT), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _cb_url(path: str) -> str:
    return f"http://{CALLBACK_HOST}:{CALLBACK_PORT}{path}"


def _wait_for_callback(n: int, timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if len(received) >= n:
            return True
        time.sleep(0.05)
    return False


# ---- individual checks ----

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = ""):
    results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# A valid caption body — used for the auth checks (rejected before any Groq call).
_AUTH_BODY = {
    "callbackUrl": _cb_url("/x"),
    "jobId": "j", "postId": "p",
    "business": {"id": "b", "name": "n"},
    "postType": "promotion",
}


def test_auth_rejects_bad_token(client: TestClient):
    r = client.post("/api/ai/caption/generate", json=_AUTH_BODY,
                    headers={"X-Internal-Token": "wrong"})
    check("Auth rejects wrong token (401)", r.status_code == 401, f"got {r.status_code}")


def test_auth_rejects_missing_token(client: TestClient):
    r = client.post("/api/ai/caption/generate", json=_AUTH_BODY)
    check("Auth rejects missing token (401)", r.status_code == 401, f"got {r.status_code}")


def test_caption_roundtrip_with_groq(client: TestClient, media_type: str,
                                     expect_aspect: str, expect_scenes: int):
    received.clear()
    payload = {
        "callbackUrl": _cb_url("/internal/ai/caption/callback"),
        "jobId": "job-e2e-1",
        "postId": "post-e2e-1",
        "business": {"id": "b1", "name": "ร้านกาแฟดอยช้าง", "tone": "เป็นกันเอง"},
        "postType": "promotion",
        "featuredServices": [
            {"id": "svc-1", "name": "ลาเต้เย็น", "price": 6500, "currency": "THB"}
        ],
        "captionHint": "โปรวันศุกร์",
        "targetAudience": "คนรุ่นใหม่",
        "mediaType": media_type,
    }
    r = client.post("/api/ai/caption/generate", json=payload,
                    headers={"X-Internal-Token": TOKEN})
    check(f"[{media_type}] returns 202 Accepted", r.status_code == 202, f"got {r.status_code}")

    got = _wait_for_callback(1, timeout=30.0)
    check(f"[{media_type}] callback delivered (real Groq)", got)
    if not got:
        return
    body = received[0]["body"] or {}
    result = body.get("result", {})
    caption = result.get("caption", "")
    mr = result.get("mediaRequest") or {}
    scenes = mr.get("scenes", [])
    check(f"[{media_type}] jobId + caption", body.get("jobId") == "job-e2e-1" and bool(caption))
    check(f"[{media_type}] content_type", mr.get("content_type") == media_type, mr.get("content_type"))
    check(f"[{media_type}] aspect_ratio {expect_aspect}", mr.get("aspect_ratio") == expect_aspect,
          mr.get("aspect_ratio"))
    check(f"[{media_type}] {expect_scenes} scene(s)", len(scenes) == expect_scenes, f"got {len(scenes)}")
    check(f"[{media_type}] top-level prompt present", bool(mr.get("prompt")))
    check(f"[{media_type}] scenes are English", bool(scenes) and all(s["prompt"].isascii() for s in scenes))
    check(f"[{media_type}] style present", bool(mr.get("style")))
    if media_type == "short_video":
        check(f"[{media_type}] master_prompt present", bool(mr.get("master_prompt")))
    else:
        check(f"[{media_type}] master_prompt is null (image)", mr.get("master_prompt") is None)
    print(f"\n  [{media_type}] style: {mr.get('style')}")
    print(f"  [{media_type}] master_prompt: {mr.get('master_prompt')}")
    print(f"  [{media_type}] caption:\n  {caption}")
    print(f"  [{media_type}] scenes (English):")
    for i, s in enumerate(scenes, 1):
        print(f"   {i}. {s['prompt']}")
    print()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-groq", action="store_true",
                        help="also run a real caption generation through the plumbing")
    args = parser.parse_args()

    print(f"INTERNAL_TOKEN active: {bool(settings.INTERNAL_TOKEN)}")
    server = _start_mock_backend()
    print(f"Mock backend listening on {CALLBACK_HOST}:{CALLBACK_PORT}\n")

    try:
        with TestClient(app) as client:
            print("== Auth (caption endpoint) ==")
            test_auth_rejects_bad_token(client)
            test_auth_rejects_missing_token(client)
            if args.with_groq:
                print("\n== Caption round-trip: IMAGE (real Groq) ==")
                test_caption_roundtrip_with_groq(client, "image", "4:5", 1)
                print("== Caption round-trip: SHORT_VIDEO (real Groq) ==")
                test_caption_roundtrip_with_groq(client, "short_video", "9:16", 4)
            else:
                print("\n(skip caption+Groq round-trip; pass --with-groq to include it)")
    finally:
        server.shutdown()

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n===== E2E RESULT: {passed}/{total} checks passed =====")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
