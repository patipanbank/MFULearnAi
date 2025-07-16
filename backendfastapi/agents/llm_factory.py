from typing import Any

import boto3
from botocore.config import Config
from langchain.chat_models.base import BaseChatModel
from langchain_aws import ChatBedrock

from config.config import settings


def get_llm(model_id: str, *, streaming: bool = True, **kwargs: Any) -> BaseChatModel:
    """Return a LangChain Chat LLM instance for the requested *model_id*.

    This implementation uses Amazon Bedrock via ``langchain_aws.ChatBedrock``.

    Parameters
    ----------
    model_id : str
        The Bedrock model ID (e.g. ``anthropic.claude-v2``).
    streaming : bool, default ``True``
        Whether to enable server-side streaming responses.
    **kwargs : Any
        Any additional keyword arguments will be forwarded to the underlying
        ``ChatBedrock`` constructor.  Common model-specific parameters such as
        ``temperature`` and ``max_tokens`` are automatically moved into the
        ``model_kwargs`` dictionary that Bedrock expects.
    """

    # Bedrock client with sensible time-outs and retry policy
    boto3_config = Config(
        read_timeout=900,
        retries={"max_attempts": 3, "mode": "standard"},
    )

    bedrock_client = boto3.client(
        service_name="bedrock-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=boto3_config,
    )

    # Extract model-level keyword arguments
    model_kwargs: dict[str, Any] = {}
    # Move commonly used generation parameters into model_kwargs if present
    for param in ("temperature", "max_tokens", "top_p", "top_k"):
        if param in kwargs:
            value = kwargs.pop(param)
            if value is not None:
                model_kwargs[param] = value

    params: dict[str, Any] = {
        "client": bedrock_client,
        "model": model_id,
        "streaming": streaming,
    }

    if model_kwargs:
        params["model_kwargs"] = model_kwargs

    # Any remaining kwargs are forwarded verbatim
    params.update(kwargs)

    return ChatBedrock(**params) 