"""Lapisan pengaman umum untuk semua permintaan API."""
import json

from starlette.responses import JSONResponse

MAX_JSON_BYTES = 10 * 1024 * 1024


def _has_operator(obj, depth=0):
    if depth > 40:
        return True
    if isinstance(obj, dict):
        return any((isinstance(k, str) and k.startswith("$")) or _has_operator(v, depth + 1) for k, v in obj.items())
    if isinstance(obj, list):
        return any(_has_operator(v, depth + 1) for v in obj)
    return False


class RejectMongoOperators:
    """Middleware ASGI: periksa isi JSON sebelum sampai ke endpoint.

    Data aplikasi tidak pernah memakai kunci berawalan "$", jadi kunci seperti itu
    pasti percobaan menyisipkan operator MongoDB (mis. {"id": {"$ne": null}}).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "PATCH", "DELETE"):
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers") or [])
        if b"application/json" not in headers.get(b"content-type", b""):
            return await self.app(scope, receive, send)

        body, more = b"", True
        while more:
            msg = await receive()
            if msg["type"] == "http.disconnect":
                return
            body += msg.get("body", b"")
            more = msg.get("more_body", False)
            if len(body) > MAX_JSON_BYTES:
                return await JSONResponse({"detail": "Data terlalu besar"}, status_code=413)(scope, receive, send)
        if body:
            try:
                data = json.loads(body)
            except ValueError:
                data = None
            if _has_operator(data):
                return await JSONResponse({"detail": "Data tidak valid"}, status_code=400)(scope, receive, send)

        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        return await self.app(scope, replay, send)
