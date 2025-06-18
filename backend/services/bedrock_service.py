import boto3
import json
import asyncio
import logging
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, List, AsyncGenerator, Dict
from config.config import settings

logger = logging.getLogger(__name__)

class BedrockService:
    def __init__(self):
        # Recommended configuration for Bedrock streaming and timeouts
        config = Config(
            read_timeout=900,
            retries={'max_attempts': 3, 'mode': 'standard'}
        )
        self.client = boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=config
        )

    async def _invoke_model_async(self, model_id: str, body: dict, operation_name: str):
        """Helper to run synchronous boto3 call in a thread."""
        loop = asyncio.get_running_loop()
        request_body = json.dumps(body)
        try:
            return await loop.run_in_executor(
                None,
                lambda: self.client.invoke_model(
                    modelId=model_id,
                    body=request_body,
                    accept="application/json",
                    contentType="application/json"
                )
            )
        except ClientError as e:
            logger.error(f"Error during Bedrock {operation_name} for model {model_id}: {e}")
            raise  # Re-raise the exception to be handled by the caller

    async def create_text_embedding(self, text: str) -> List[float]:
        """Creates an embedding for a given text using Titan Text Embeddings."""
        model_id = "amazon.titan-embed-text-v1"
        body = {"inputText": text}
        try:
            response = await self._invoke_model_async(model_id, body, "text embedding")
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
        except Exception as e:
            logger.error(f"Failed to create text embedding: {e}")
            # Depending on desired behavior, you might return an empty list or re-raise
            return []

    async def create_batch_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Creates embeddings for a batch of texts concurrently."""
        tasks = [self.create_text_embedding(text) for text in texts]
        embeddings = await asyncio.gather(*tasks)
        return embeddings

    async def create_image_embedding(self, image_base64: str, text: Optional[str] = None) -> List[float]:
        """Creates an embedding for a given image (and optional text) using Titan Multimodal Embeddings."""
        model_id = "amazon.titan-embed-image-v1"
        body = {"inputImage": image_base64}
        if text:
            body["inputText"] = text
        try:
            response = await self._invoke_model_async(model_id, body, "image embedding")
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
        except Exception as e:
            logger.error(f"Failed to create image embedding: {e}")
            return []

    async def generate_image(self, prompt: str) -> str:
        """Generates an image from a text prompt using Titan Image Generator."""
        model_id = "amazon.titan-image-generator-v1"
        body = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {"text": prompt},
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "quality": "standard",
                "height": 1024,
                "width": 1024,
                "cfgScale": 8.0,
                "seed": 0 # Using a fixed seed for reproducibility, can be randomized
            }
        }
        try:
            response = await self._invoke_model_async(model_id, body, "image generation")
            response_body = json.loads(response.get('body').read())
            return response_body.get('images')[0]
        except Exception as e:
            logger.error(f"Failed to generate image: {e}")
            return ""


    async def converse_stream(
        self,
        model_id: str,
        messages: List[Dict],
        system_prompt: str,
        tool_config: Optional[Dict] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None
    ) -> AsyncGenerator[Dict, None]:
        """
        Invokes a model with a streaming response using the Converse API.
        """
        loop = asyncio.get_running_loop()
        if not model_id:
            model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"

        inference_config = {}
        if temperature is not None:
            inference_config["temperature"] = temperature
        if top_p is not None:
            inference_config["topP"] = top_p
        
        # Converse API expects system prompt as a list of content blocks
        system_messages = [{"text": system_prompt}] if system_prompt else []
        
        try:
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
            if stream:
                for event in stream:
                    yield event
        except ClientError as e:
            logger.error(f"Error during Bedrock converse_stream for model {model_id}: {e}")
            # In a streaming context, you might want to yield an error event
            yield {"error": str(e)}
        except Exception as e:
            logger.error(f"An unexpected error occurred in converse_stream: {e}")
            yield {"error": str(e)}

bedrock_service = BedrockService() 