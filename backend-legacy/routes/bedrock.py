from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, AsyncGenerator
import json

from services.bedrock_service import bedrock_service

router = APIRouter(tags=["Bedrock"])

# === Request/Response Schemas ===

class BedrockMessage(BaseModel):
    role: str = Field(..., description="The role of the message (user/assistant/system)")
    content: str = Field(..., description="The content of the message")
    # Additional optional fields like name or tool invocation can be added here

class ConverseStreamRequest(BaseModel):
    messages: List[BedrockMessage] = Field(..., description="List of chat messages in Bedrock format")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt that sets the behavior of the assistant")
    model_id: Optional[str] = Field(None, description="Optional Bedrock model ID to override default")
    tool_config: Optional[Dict] = Field(None, description="Optional tool configuration for Bedrock tools")
    temperature: Optional[float] = Field(None, description="Sampling temperature")
    top_p: Optional[float] = Field(None, description="Nucleus sampling top-p value")

class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt to generate an image from")

class ImageGenerationResponse(BaseModel):
    image: str = Field(..., description="Base64-encoded image")

# === Endpoints ===

@router.post("/converse-stream")
async def converse_stream_endpoint(req: ConverseStreamRequest = Body(...)):
    """Streams chat completions from Amazon Bedrock's converse_stream API using Server-Sent Events (SSE)."""

    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in bedrock_service.converse_stream(
            model_id=req.model_id or "anthropic.claude-3-5-sonnet-20240620-v1:0",
            messages=[message.dict() for message in req.messages],
            system_prompt=req.system_prompt or "",
            tool_config=req.tool_config,
            temperature=req.temperature,
            top_p=req.top_p,
        ):
            # Format each event as an SSE data frame
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/generate-image", response_model=ImageGenerationResponse)
async def generate_image_endpoint(req: ImageGenerationRequest = Body(...)):
    """Generates an image from a text prompt using Amazon Bedrock."""
    try:
        image_b64 = await bedrock_service.generate_image(req.prompt)
        if not image_b64:
            raise ValueError("No image returned from Bedrock")
        return ImageGenerationResponse(image=image_b64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 