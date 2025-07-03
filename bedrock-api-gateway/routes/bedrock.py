from fastapi import APIRouter, Body, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, AsyncGenerator, Any
import json
import logging
import time
from datetime import datetime

from services.bedrock_service import bedrock_service

router = APIRouter()
logger = logging.getLogger(__name__)

# === Request/Response Schemas ===

class BedrockMessage(BaseModel):
    role: str = Field(..., description="The role of the message (user/assistant/system)")
    content: str = Field(..., description="The content of the message")
    
    @validator('role')
    def validate_role(cls, v):
        allowed_roles = ['user', 'assistant', 'system']
        if v not in allowed_roles:
            raise ValueError(f"Role must be one of {allowed_roles}")
        return v
    
    @validator('content')
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError("Content cannot be empty")
        return v

class ConverseStreamRequest(BaseModel):
    messages: List[BedrockMessage] = Field(..., description="List of chat messages")
    system_prompt: Optional[str] = Field(None, description="System prompt")
    model_id: Optional[str] = Field(None, description="Bedrock model ID")
    tool_config: Optional[Dict] = Field(None, description="Tool configuration")
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0, description="Temperature (0.0-1.0)")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p (0.0-1.0)")
    max_tokens: Optional[int] = Field(None, ge=1, le=100000, description="Maximum tokens")
    
    @validator('messages')
    def validate_messages(cls, v):
        if not v:
            raise ValueError("Messages list cannot be empty")
        return v

class TextEmbeddingRequest(BaseModel):
    text: str = Field(..., description="Text to embed")
    model_id: Optional[str] = Field("amazon.titan-embed-text-v1", description="Embedding model ID")
    
    @validator('text')
    def validate_text(cls, v):
        if not v or not v.strip():
            raise ValueError("Text cannot be empty")
        return v

class BatchTextEmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed")
    model_id: Optional[str] = Field("amazon.titan-embed-text-v1", description="Embedding model ID")
    
    @validator('texts')
    def validate_texts(cls, v):
        if not v:
            raise ValueError("Texts list cannot be empty")
        if len(v) > 100:
            raise ValueError("Maximum 100 texts allowed per batch")
        return v

class ImageEmbeddingRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    text: Optional[str] = Field(None, description="Optional text description")
    model_id: Optional[str] = Field("amazon.titan-embed-image-v1", description="Embedding model ID")
    
    @validator('image_base64')
    def validate_image(cls, v):
        if not v or not v.strip():
            raise ValueError("Image data cannot be empty")
        return v

class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt for image generation")
    model_id: Optional[str] = Field("amazon.titan-image-generator-v1", description="Image generation model ID")
    width: Optional[int] = Field(1024, ge=256, le=2048, description="Image width")
    height: Optional[int] = Field(1024, ge=256, le=2048, description="Image height")
    quality: Optional[str] = Field("standard", description="Image quality (standard/premium)")
    
    @validator('prompt')
    def validate_prompt(cls, v):
        if not v or not v.strip():
            raise ValueError("Prompt cannot be empty")
        return v
    
    @validator('quality')
    def validate_quality(cls, v):
        allowed_qualities = ['standard', 'premium']
        if v not in allowed_qualities:
            raise ValueError(f"Quality must be one of {allowed_qualities}")
        return v

# === Response Models ===

class TextEmbeddingResponse(BaseModel):
    embedding: List[float] = Field(..., description="Text embedding vector")
    model_id: str = Field(..., description="Model used for embedding")
    timestamp: datetime = Field(..., description="Request timestamp")

class BatchTextEmbeddingResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="List of embedding vectors")
    model_id: str = Field(..., description="Model used for embedding")
    count: int = Field(..., description="Number of embeddings")
    timestamp: datetime = Field(..., description="Request timestamp")

class ImageEmbeddingResponse(BaseModel):
    embedding: List[float] = Field(..., description="Image embedding vector")
    model_id: str = Field(..., description="Model used for embedding")
    timestamp: datetime = Field(..., description="Request timestamp")

class ImageGenerationResponse(BaseModel):
    image: str = Field(..., description="Base64 encoded generated image")
    model_id: str = Field(..., description="Model used for generation")
    timestamp: datetime = Field(..., description="Request timestamp")

# === API Endpoints ===

@router.post("/converse-stream")
async def converse_stream_endpoint(request: Request, req: ConverseStreamRequest = Body(...)):
    """Stream chat completions from Amazon Bedrock."""
    
    # Log request details
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.info(f"Request {request_id}: Starting converse stream with {len(req.messages)} messages")
    
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            start_time = time.time()
            event_count = 0
            
            async for event in bedrock_service.converse_stream(
                model_id=req.model_id or "anthropic.claude-3-5-sonnet-20240620-v1:0",
                messages=[message.dict() for message in req.messages],
                system_prompt=req.system_prompt,
                tool_config=req.tool_config,
                temperature=req.temperature,
                top_p=req.top_p,
                max_tokens=req.max_tokens
            ):
                event_count += 1
                yield f"data: {json.dumps(event)}\n\n"
            
            # Log completion
            duration = time.time() - start_time
            logger.info(f"Request {request_id}: Completed stream with {event_count} events in {duration:.2f}s")
            
        except Exception as e:
            logger.error(f"Request {request_id}: Error in stream: {e}")
            error_event = {
                "error": str(e),
                "type": "stream_error",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/embeddings/text", response_model=TextEmbeddingResponse)
async def create_text_embedding(request: Request, req: TextEmbeddingRequest = Body(...)):
    """Create text embedding using Amazon Bedrock."""
    
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.info(f"Request {request_id}: Creating text embedding")
    
    try:
        start_time = time.time()
        model_id = req.model_id or "amazon.titan-embed-text-v1"
        embedding = await bedrock_service.create_text_embedding(req.text, model_id)
        duration = time.time() - start_time
        
        logger.info(f"Request {request_id}: Created embedding with {len(embedding)} dimensions in {duration:.2f}s")
        
        return TextEmbeddingResponse(
            embedding=embedding,
            model_id=model_id,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Request {request_id}: Error creating text embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/embeddings/text/batch", response_model=BatchTextEmbeddingResponse)
async def create_batch_text_embeddings(request: Request, req: BatchTextEmbeddingRequest = Body(...)):
    """Create batch text embeddings using Amazon Bedrock."""
    
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.info(f"Request {request_id}: Creating batch embeddings for {len(req.texts)} texts")
    
    try:
        start_time = time.time()
        model_id = req.model_id or "amazon.titan-embed-text-v1"
        embeddings = await bedrock_service.create_batch_text_embeddings(req.texts, model_id)
        duration = time.time() - start_time
        
        logger.info(f"Request {request_id}: Created {len(embeddings)} embeddings in {duration:.2f}s")
        
        return BatchTextEmbeddingResponse(
            embeddings=embeddings,
            model_id=model_id,
            count=len(embeddings),
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Request {request_id}: Error creating batch embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/embeddings/image", response_model=ImageEmbeddingResponse)
async def create_image_embedding(request: Request, req: ImageEmbeddingRequest = Body(...)):
    """Create image embedding using Amazon Bedrock."""
    
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.info(f"Request {request_id}: Creating image embedding")
    
    try:
        start_time = time.time()
        img_model_id = req.model_id or "amazon.titan-embed-image-v1"
        embedding = await bedrock_service.create_image_embedding(req.image_base64, req.text, img_model_id)
        duration = time.time() - start_time
        
        logger.info(f"Request {request_id}: Created image embedding with {len(embedding)} dimensions in {duration:.2f}s")
        
        return ImageEmbeddingResponse(
            embedding=embedding,
            model_id=img_model_id,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Request {request_id}: Error creating image embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/images/generate", response_model=ImageGenerationResponse)
async def generate_image(request: Request, req: ImageGenerationRequest = Body(...)):
    """Generate image using Amazon Bedrock."""
    
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.info(f"Request {request_id}: Generating image")
    
    try:
        start_time = time.time()
        gen_model_id = req.model_id or "amazon.titan-image-generator-v1"
        width = req.width or 1024
        height = req.height or 1024
        quality = req.quality or "standard"

        image_b64 = await bedrock_service.generate_image(
            req.prompt,
            gen_model_id,
            width,
            height,
            quality
        )
        duration = time.time() - start_time
        
        logger.info(f"Request {request_id}: Generated image in {duration:.2f}s")
        
        return ImageGenerationResponse(
            image=image_b64,
            model_id=gen_model_id,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Request {request_id}: Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def bedrock_health_check():
    """Health check endpoint for Bedrock service."""
    try:
        health_status = await bedrock_service.health_check()
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable") 