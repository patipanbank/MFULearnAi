from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.config import settings
from lib.mongodb import connect_to_mongo, close_mongo_connection
from routes import (
    embedding as embedding_router,
    stats as stats_router,
    department as department_router,
    auth as auth_router,
    admin as admin_router,
    models as models_router,
    training as training_router,
    collection as collection_router,
    chat as chat_router
)

app = FastAPI()

# CORS Middleware
origins = settings.ALLOWED_ORIGINS.split(',') if settings.ALLOWED_ORIGINS else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Include Routers
app.include_router(embedding_router.router, prefix="/api")
app.include_router(stats_router.router, prefix="/api")
app.include_router(department_router.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api/auth")
app.include_router(admin_router.router, prefix="/api/admin")
app.include_router(models_router.router, prefix="/api")
app.include_router(training_router.router, prefix="/api")
app.include_router(collection_router.router, prefix="/api")
app.include_router(chat_router.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to MFULearnAI API"} 