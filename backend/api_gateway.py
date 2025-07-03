from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
import httpx
import os

"""Simple reverse-proxy API Gateway for MFULearnAI

จุดประสงค์
-----------
1. รวมจุดเข้า API เดียว (port ใหม่) สำหรับหลาย micro-services
2. เพิ่ม CORS / Auth / Rate-limit ภายหลังได้ง่าย
3. forward HTTP methods ทั้งหมดไปยัง Backend URL ที่กำหนดผ่าน env `BACKEND_URL` (default http://localhost:8000)

การใช้งาน
---------
$ BACKEND_URL=http://backend:8000 uvicorn backend.api_gateway:app --host 0.0.0.0 --port 9000

* ยัง **ไม่** รองรับ WebSocket proxy; nginx หรือ Traefik ด้านหน้าอาจรับผิดชอบเส้นทาง `/ws` แทน
"""

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

app = FastAPI(title="MFULearnAI API Gateway")

# CORS – เปิดกว้างไว้ก่อน ปรับ Origin เฉพาะ env production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _stream_response(resp: httpx.Response):
    """Stream response chunks to client to support large downloads."""
    async for chunk in resp.aiter_bytes():
        yield chunk


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(full_path: str, request: Request):
    """Proxy any HTTP request to the underlying backend service."""

    # Construct destination URL
    url = f"{BACKEND_URL}/{full_path}"

    # Prepare request data
    method = request.method
    headers = dict(request.headers)
    headers.pop("host", None)  # Avoid host mismatch
    body = await request.body()

    # Forward request
    async with httpx.AsyncClient(follow_redirects=True) as client:
        upstream_resp = await client.request(
            method=method,
            url=url,
            headers=headers,
            params=request.query_params,
            content=body,
        )

    # Stream response back to caller
    response = StreamingResponse(
        _stream_response(upstream_resp), status_code=upstream_resp.status_code
    )

    # Copy headers except hop-by-hop headers
    excluded = {
        "content-encoding",
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "upgrade",
    }
    for k, v in upstream_resp.headers.items():
        if k.lower() not in excluded:
            response.headers[k] = v

    return response


@app.get("/")
async def health_check():
    """Simple health endpoint for the gateway itself."""
    return {"message": "MFULearnAI Gateway running", "backend": BACKEND_URL} 