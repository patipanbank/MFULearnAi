from pydantic import BaseModel, Field
from typing import List, Dict, Any

class EmbeddingRequest(BaseModel):
    input: List[str] = Field(..., description="A list of strings to be embedded.")
    model: str = Field(default="amazon.titan-embed-text-v1", description="The model to use for creating embeddings.")

class EmbeddingData(BaseModel):
    object: str = "embedding"
    embedding: List[float]
    index: int

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[EmbeddingData]
    model: str
    # Potentially add a usage field if you track token counts
    # usage: Dict[str, Any] 