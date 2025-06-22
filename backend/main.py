from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from config.config import settings
from lib.mongodb import connect_to_mongo, close_mongo_connection
from routes import (
    embedding as embedding_router,
    stats as stats_router,
    department as department_router,
    auth as auth_router,
    admin as admin_router,
    training as training_router,
    collection as collection_router,
    chat as chat_router,
    agents as agents_router
)

app = FastAPI()

# Enhanced CORS Middleware for WebSocket support
origins = settings.ALLOWED_ORIGINS.split(',') if settings.ALLOWED_ORIGINS else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "Origin",
        "X-Requested-With",
        "X-Real-IP",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        "Upgrade",
        "Connection",
        "Sec-WebSocket-Key",
        "Sec-WebSocket-Version",
        "Sec-WebSocket-Protocol",
        "Sec-WebSocket-Extensions"
    ],
)

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Root level WebSocket endpoint (matches nginx /ws route)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Root level WebSocket endpoint for chat functionality.
    This matches the nginx /ws route configuration.
    """
    # Import the websocket handler from chat router
    from routes.chat import websocket_endpoint as chat_websocket_handler
    await chat_websocket_handler(websocket)

# Include Routers
app.include_router(embedding_router.router, prefix="/api/embeddings")
app.include_router(stats_router.router, prefix="/api/stats")
app.include_router(department_router.router, prefix="/api/departments")
app.include_router(auth_router.router, prefix="/api/auth")
app.include_router(admin_router.router, prefix="/api/admin")
app.include_router(training_router.router, prefix="/api/training")
app.include_router(collection_router.router, prefix="/api/collections")
app.include_router(chat_router.router, prefix="/api/chat")
app.include_router(agents_router.router, prefix="/api/agents")

# WebSocket routes are already included in chat_router with /api prefix
# The nginx /ws location proxy_pass will handle the routing

@app.get("/")
def read_root():
    return {"message": "Welcome to MFULearnAI API"} 