from fastapi import APIRouter, HTTPException, Body
from typing import List
from models.embedding import EmbeddingRequest, EmbeddingResponse, EmbeddingData
from services.bedrock_service import bedrock_service

router = APIRouter()

@router.post("/embedding", response_model=EmbeddingResponse)
async def get_embedding(
    request: EmbeddingRequest = Body(...),
):
    try:
        embeddings = await bedrock_service.create_batch_text_embeddings(request.input)
        
        response_data = [
            EmbeddingData(embedding=emb, index=i)
            for i, emb in enumerate(embeddings)
        ]
        
        return EmbeddingResponse(
            object="list",
            data=response_data,
            model=request.model
        )
    except Exception as e:
        # Log the exception for debugging purposes
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 