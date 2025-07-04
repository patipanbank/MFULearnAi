from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from services.collection_service import collection_service
from services.chroma_service import chroma_service
from models.user import User, UserRole
from models.collection import Collection, CollectionPermission
from middleware.role_guard import get_current_user_with_roles

router = APIRouter(
    prefix="",
    tags=["Collections"]
)

class CollectionCreate(BaseModel):
    name: str
    permission: CollectionPermission
    modelId: Optional[str] = None

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    permission: Optional[CollectionPermission] = None

class DocumentResponse(BaseModel):
    id: str
    text: Optional[str] = None
    metadata: Optional[dict] = None

class CollectionResponse(BaseModel):
    id: str
    name: str
    permission: str
    createdBy: str
    createdAt: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[CollectionResponse])
async def get_all_collections(
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    collections = await collection_service.get_user_collections(current_user)
    return collections

@router.get("/public", response_model=List[CollectionResponse])
async def get_public_collections(
    # ไม่จำเป็นต้องมี authentication สำหรับ public collections
):
    """Get public collections that don't require authentication"""
    try:
        # ใช้ method ที่มีอยู่แล้วแต่ filter เฉพาะที่ public
        collections = await collection_service.get_all_collections()
        # Filter เฉพาะ public collections
        public_collections = [c for c in collections if c.permission == "PUBLIC"]
        return public_collections
    except Exception as e:
        # Return empty list instead of error to prevent resource exhaustion
        return []

@router.post("/", response_model=CollectionResponse, status_code=201)
async def create_new_collection(
    collection_data: CollectionCreate,
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    created_by = current_user.username
    try:
        new_collection = await collection_service.create_collection(
            name=collection_data.name,
            permission=collection_data.permission,
            created_by=current_user,
            model_id=collection_data.modelId
        )
        return new_collection
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create collection: {e}")

@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_existing_collection(
    collection_id: str,
    collection_data: CollectionUpdate,
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    collection = await collection_service.get_collection_by_id(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if not collection_service.can_user_access_collection(current_user, collection):
        raise HTTPException(status_code=403, detail="Not authorized to update this collection")

    updates = collection_data.model_dump(exclude_unset=True)
    updated_collection = await collection_service.update_collection(collection_id, updates)
    
    return updated_collection

@router.delete("/{collection_id}", status_code=204)
async def delete_existing_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    collection = await collection_service.get_collection_by_id(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    if not collection_service.can_user_access_collection(current_user, collection):
        raise HTTPException(status_code=403, detail="Not authorized to delete this collection")
        
    try:
        await collection_service.delete_collection(collection, current_user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete collection: {e}")

@router.get("/{collection_id}/documents", response_model=List[DocumentResponse])
async def get_documents_in_collection(
    collection_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    try:
        collection = await collection_service.get_collection_by_id(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
            
        if not collection_service.can_user_access_collection(current_user, collection):
            raise HTTPException(status_code=403, detail="Not authorized to view documents in this collection")

        result = await chroma_service.get_documents(collection.name, limit=limit, offset=offset)
        if not result:
            return []
        
        # Return the documents array from the result
        return result.get("documents", [])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting documents for collection {collection_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")

@router.delete("/{collection_id}/documents")
async def delete_documents_from_a_collection(
    collection_id: str,
    document_ids: List[str] = Body(..., embed=True),
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    collection = await collection_service.get_collection_by_id(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if not collection_service.can_user_access_collection(current_user, collection):
        raise HTTPException(status_code=403, detail="Not authorized to delete documents from this collection")
        
    try:
        await chroma_service.delete_documents(collection.name, document_ids)
        return {"message": f"{len(document_ids)} documents deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete documents: {e}") 

@router.get("/analytics")
async def get_collection_analytics(
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))
):
    """Get analytics for all collections"""
    try:
        collections = await collection_service.get_all_collections()
        
        total_collections = len(collections)
        total_documents = 0
        total_size = 0
        
        # Get document counts and sizes from ChromaDB
        for collection in collections:
            try:
                documents = await chroma_service.get_documents(collection.name, limit=1, offset=0)
                total_documents += documents.get("total", 0)
                
                # Estimate size (rough calculation)
                # Each document typically has metadata and embedding
                # This is a simplified calculation
                total_size += documents.get("total", 0) * 1024  # 1KB per document estimate
            except Exception as e:
                print(f"Error getting analytics for collection {collection.name}: {e}")
                continue
        
        return {
            "totalCollections": total_collections,
            "totalDocuments": total_documents,
            "totalSize": total_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {e}") 