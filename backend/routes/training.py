from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Body, BackgroundTasks
from typing import List
from pydantic import BaseModel, HttpUrl
from services.training_service import training_service
from middleware.role_guard import get_current_user_with_roles
from models.user import User, UserRole

router = APIRouter(
    prefix="/training",
    tags=["Training"]
)

# You might want to protect this route with a role guard, e.g., for admins
# For now, it's open. You can add Depends(RoleGuard(["admin"])) later.

@router.post("/upload")
async def upload_file_for_training(
    file: UploadFile = File(...),
    modelId: str = Form(...),
    collectionName: str = Form(...),
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    """
    Handles file uploads for training.
    Extracts text, creates embeddings, and stores them.
    - **file**: The file to be processed.
    - **modelId**: The ID of the model associated with this training.
    - **collectionName**: The name of the collection to store the data in.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    try:
        chunks_count = await training_service.process_and_embed_file(
            file=file,
            user=current_user,
            model_id=modelId,
            collection_name=collectionName
        )
        return {
            "message": "File processed successfully with vector embeddings",
            "chunks": chunks_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log the error for debugging
        print(f"Error during file upload processing: {e}")
        raise HTTPException(status_code=500, detail="Error processing upload.")

class ScrapeRequest(BaseModel):
    url: HttpUrl
    modelId: str
    collectionName: str

@router.post("/scrape-url")
async def scrape_url_for_training(
    request: ScrapeRequest,
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    """
    Handles URL scraping for training.
    Scrapes content, creates embeddings, and stores them.
    """
    try:
        chunks_count = await training_service.process_and_embed_url(
            url=str(request.url),
            user=current_user,
            model_id=request.modelId,
            collection_name=request.collectionName
        )
        return {
            "message": f"URL scraped successfully. {chunks_count} chunks were added.",
            "chunks": chunks_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error during URL scraping: {e}")
        raise HTTPException(status_code=500, detail="Error scraping URL.")

class TextRequest(BaseModel):
    text: str
    documentName: str
    modelId: str
    collectionName: str

@router.post("/text")
async def text_for_training(
    request: TextRequest,
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    """
    Handles raw text for training.
    Creates embeddings and stores them.
    """
    try:
        chunks_count = await training_service.process_and_embed_text(
            text=request.text,
            user=current_user,
            model_id=request.modelId,
            collection_name=request.collectionName,
            document_name=request.documentName
        )
        return {
            "message": f"Text processed successfully. {chunks_count} chunks were added.",
            "chunks": chunks_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error during text processing: {e}")
        raise HTTPException(status_code=500, detail="Error processing text.")

class IngestRequest(BaseModel):
    directory_path: str

@router.post("/ingest-directory", status_code=202)
async def ingest_directory(
    background_tasks: BackgroundTasks,
    collection_name: str = Form(...),
    directory_path: str = Form(...),
    current_user: User = Depends(get_current_user_with_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Ingests all files from a specified directory on the server.
    This is a long-running background task.
    """
    print(f"User {current_user.email} triggered ingestion for directory: {directory_path} into collection {collection_name}")
    
    # Add the long-running task to the background
    background_tasks.add_task(
        training_service.ingest_directory, 
        directory_path=directory_path, 
        collection_name=collection_name,
        user=current_user
    )

    return {"message": "Directory ingestion process started in the background.", "directory": directory_path, "collection": collection_name} 