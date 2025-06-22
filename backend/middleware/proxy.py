from starlette.types import ASGIApp, Scope, Receive, Send
from starlette.datastructures import Headers

class ProxyHeadersMiddleware:
    """
    A middleware to trust proxy headers, such as X-Forwarded-For and X-Forwarded-Proto.
    This is necessary when the application is running behind a reverse proxy (e.g., Nginx).
    It inspects the X-Forwarded-Proto header and sets the request's `scheme`.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = Headers(scope=scope)
            x_forwarded_proto = headers.get("x-forwarded-proto")
            
            if x_forwarded_proto:
                scope["scheme"] = x_forwarded_proto

        await self.app(scope, receive, send) 