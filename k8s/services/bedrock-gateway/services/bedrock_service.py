import boto3
import json
import asyncio
import logging
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, List, AsyncGenerator, Dict, Any
from config.config import settings

logger = logging.getLogger(__name__)

class BedrockService:
    def __init__(self):
        # Enhanced configuration for API Gateway with better timeout handling
        config = Config(
            read_timeout=900,
            connect_timeout=60,
            retries={'max_attempts': 3, 'mode': 'adaptive'},
            max_pool_connections=50
        )
        
        self.client = boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=config
        )
        
        logger.info(f"Bedrock service initialized for region: {settings.AWS_REGION}")

    async def _invoke_model_async(self, model_id: str, body: dict, operation_name: str):
        """Helper to run synchronous boto3 call in a thread."""
        loop = asyncio.get_running_loop()
        request_body = json.dumps(body)
        
        try:
            response = await loop.run_in_executor(
                None,
                lambda: self.client.invoke_model(
                    modelId=model_id,
                    body=request_body,
                    accept="application/json",
                    contentType="application/json"
                )
            )
            logger.info(f"Successfully invoked model {model_id} for {operation_name}")
            return response
        except ClientError as e:
            logger.error(f"Error during Bedrock {operation_name} for model {model_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during Bedrock {operation_name}: {e}")
            raise

    async def create_text_embedding(self, text: str, model_id: str = "amazon.titan-embed-text-v1") -> List[float]:
        """Creates an embedding for a given text using Titan Text Embeddings."""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
            
        body = {"inputText": text}
        try:
            response = await self._invoke_model_async(model_id, body, "text embedding")
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
        except Exception as e:
            logger.error(f"Failed to create text embedding: {e}")
            raise

    async def create_batch_text_embeddings(self, texts: List[str], model_id: str = "amazon.titan-embed-text-v1") -> List[List[float]]:
        """Creates embeddings for a batch of texts concurrently."""
        if not texts:
            raise ValueError("Texts list cannot be empty")
            
        # Process in batches to avoid overwhelming the service
        batch_size = 10
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            tasks = [self.create_text_embedding(text, model_id) for text in batch]
            batch_embeddings = await asyncio.gather(*tasks)
            all_embeddings.extend(batch_embeddings)
            
        return all_embeddings

    async def create_image_embedding(self, image_base64: str, text: Optional[str] = None, model_id: str = "amazon.titan-embed-image-v1") -> List[float]:
        """Creates an embedding for a given image (and optional text) using Titan Multimodal Embeddings."""
        if not image_base64:
            raise ValueError("Image data cannot be empty")
            
        body = {"inputImage": image_base64}
        if text:
            body["inputText"] = text
            
        try:
            response = await self._invoke_model_async(model_id, body, "image embedding")
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
        except Exception as e:
            logger.error(f"Failed to create image embedding: {e}")
            raise

    async def generate_image(self, prompt: str, model_id: str = "amazon.titan-image-generator-v1", 
                           width: int = 1024, height: int = 1024, quality: str = "standard") -> str:
        """Generates an image from a text prompt using Titan Image Generator."""
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")
            
        body = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {"text": prompt},
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "quality": quality,
                "height": height,
                "width": width,
                "cfgScale": 8.0,
                "seed": 0
            }
        }
        
        try:
            response = await self._invoke_model_async(model_id, body, "image generation")
            response_body = json.loads(response.get('body').read())
            images = response_body.get('images', [])
            if not images:
                raise ValueError("No image returned from Bedrock")
            return images[0]
        except Exception as e:
            logger.error(f"Failed to generate image: {e}")
            raise

    async def converse_stream(
        self,
        model_id: str,
        messages: List[Dict],
        system_prompt: Optional[str] = None,
        tool_config: Optional[Dict] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> AsyncGenerator[Dict, None]:
        """
        Invokes a model with a streaming response using the Converse API.
        Enhanced with better error handling and logging.
        """
        loop = asyncio.get_running_loop()
        
        # Use default model if not specified
        if not model_id:
            model_id = settings.AWS_BEDROCK_MODEL_ID or "anthropic.claude-3-5-sonnet-20240620-v1:0"

        # Build inference config
        inference_config = {}
        if temperature is not None:
            inference_config["temperature"] = temperature
        if top_p is not None:
            inference_config["topP"] = top_p
        if max_tokens is not None:
            inference_config["maxTokens"] = max_tokens
        
        # Converse API expects system prompt as a list of content blocks
        system_messages = [{"text": system_prompt}] if system_prompt else []
        
        try:
            logger.info(f"Starting converse stream with model: {model_id}")
            
            response = await loop.run_in_executor(
                None,
                lambda: self.client.converse_stream(
                    modelId=model_id,
                    messages=messages,
                    system=system_messages,
                    toolConfig=tool_config,
                    inferenceConfig=inference_config
                )
            )
            
            stream = response.get('stream')
            if not stream:
                raise ValueError("No stream returned from Bedrock")
                
            event_count = 0
            for event in stream:
                event_count += 1
                yield event
                
            logger.info(f"Converse stream completed with {event_count} events")
            
        except ClientError as e:
            error_msg = f"Bedrock ClientError for model {model_id}: {e}"
            logger.error(error_msg)
            yield {"error": error_msg, "type": "client_error"}
        except Exception as e:
            error_msg = f"Unexpected error in converse_stream: {e}"
            logger.error(error_msg)
            yield {"error": error_msg, "type": "unexpected_error"}

    async def health_check(self) -> Dict[str, Any]:
        """Health check for the Bedrock service."""
        try:
            # Simple test to check if we can connect to Bedrock
            test_text = "Health check"
            embedding = await self.create_text_embedding(test_text)
            
            return {
                "status": "healthy",
                "service": "bedrock",
                "region": settings.AWS_REGION,
                "embedding_dimension": len(embedding) if embedding else 0
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "service": "bedrock",
                "region": settings.AWS_REGION,
                "error": str(e)
            }

    async def initialize(self) -> None:
        """Placeholder initialization method for compatibility."""
        return None

    async def list_models(self) -> List[str]:
        """Placeholder list models method until implemented."""
        # In future, integrate with Bedrock listFoundationModels API when available
        return []

# Singleton instance
bedrock_service = BedrockService() 