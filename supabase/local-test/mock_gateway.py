"""Gateway tiruan Supabase untuk UJI LOKAL saja (tidak dipakai di produksi).

/rest/v1/*     -> diteruskan ke PostgREST
/auth/v1/*     -> login email+password memakai tabel auth.users (bcrypt), menerbitkan JWT
/storage/v1/*  -> simpan/ambil file di folder lokal

Jalankan:  uvicorn mock_gateway:app --port 54321
"""
import os, time, uuid, pathlib
import httpx, jwt, psycopg2
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

SECRET = os.environ.get("JWT_SECRET", "local-test-jwt-secret-local-test-jwt-secret")
PGREST = os.environ.get("PGREST_URL", "http://127.0.0.1:3001")
DSN = os.environ.get("PG_DSN", "host=/tmp port=54322 user=postgres dbname=aqin")
FILES = pathlib.Path(os.environ.get("STORAGE_DIR", "/tmp/claude-0/sb/storage"))
FILES.mkdir(parents=True, exist_ok=True)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["*"])
client = httpx.AsyncClient(timeout=60)


def q(sql, *args):
    with psycopg2.connect(DSN) as c, c.cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchone() if cur.description else None


def session_for(uid, email):
    now = int(time.time())
    token = jwt.encode({"sub": uid, "email": email, "role": "authenticated", "aud": "authenticated",
                        "iat": now, "exp": now + 3600}, SECRET, algorithm="HS256")
    user = {"id": uid, "email": email, "aud": "authenticated", "role": "authenticated",
            "app_metadata": {"provider": "email"}, "user_metadata": {}, "created_at": "2026-01-01T00:00:00Z"}
    return {"access_token": token, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
            "refresh_token": f"{uid}:{uuid.uuid4()}", "user": user}


@app.post("/auth/v1/token")
async def token(request: Request, grant_type: str):
    body = await request.json()
    if grant_type == "password":
        row = q("select id::text, email from auth.users where lower(email)=lower(%s) "
                "and encrypted_password = extensions.crypt(%s, encrypted_password)",
                body.get("email", ""), body.get("password", ""))
        if not row:
            return Response('{"error":"invalid_grant","error_description":"Invalid login credentials"}',
                            status_code=400, media_type="application/json")
        return session_for(*row)
    if grant_type == "refresh_token":
        uid = (body.get("refresh_token") or "").split(":")[0]
        row = q("select id::text, email from auth.users where id::text=%s", uid)
        if not row:
            return Response('{"error":"invalid_grant"}', status_code=400, media_type="application/json")
        return session_for(*row)
    return Response('{"error":"unsupported_grant_type"}', status_code=400, media_type="application/json")


@app.get("/auth/v1/user")
async def get_user(request: Request):
    tok = request.headers.get("authorization", "").replace("Bearer ", "")
    try:
        claims = jwt.decode(tok, SECRET, algorithms=["HS256"], audience="authenticated")
    except Exception:
        return Response('{"msg":"invalid JWT"}', status_code=401, media_type="application/json")
    return session_for(claims["sub"], claims.get("email", ""))["user"]


@app.post("/auth/v1/logout")
async def logout():
    return Response(status_code=204)


@app.api_route("/storage/v1/object/{bucket}/{path:path}", methods=["POST", "PUT"])
async def upload(bucket: str, path: str, request: Request):
    data = await request.body()
    ctype = request.headers.get("content-type", "")
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        f = next(iter(form.values()))
        data = await f.read()
    dest = FILES / bucket / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {"Key": f"{bucket}/{path}", "Id": str(uuid.uuid4())}


@app.get("/storage/v1/object/public/{bucket}/{path:path}")
async def public_file(bucket: str, path: str):
    f = FILES / bucket / path
    if not f.exists():
        return Response(status_code=404)
    return Response(f.read_bytes(), media_type="image/" + (path.rsplit(".", 1)[-1].replace("jpg", "jpeg")))


@app.api_route("/rest/v1/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def rest(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length", "accept-encoding")}
    if "authorization" not in {k.lower() for k in headers}:
        headers["authorization"] = "Bearer " + jwt.encode({"role": "anon"}, SECRET, algorithm="HS256")
    r = await client.request(request.method, f"{PGREST}/{path}", params=request.query_params,
                             content=await request.body(), headers=headers)
    out = {k: v for k, v in r.headers.items() if k.lower() in ("content-type", "content-range")}
    return Response(r.content, status_code=r.status_code, headers=out)
