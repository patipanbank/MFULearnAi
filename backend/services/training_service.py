from fastapi import UploadFile
from typing import List
import asyncio
import os
import uuid

from models.training_history import TrainingAction
from models.user import User
from services.document_service import document_service
from services.web_scraper_service import web_scraper_service
from services.chroma_service import chroma_service
from services.training_history_service import training_history_service
from services.bedrock_service import bedrock_service
from lib.mongodb import get_database

from langchain.text_splitter import RecursiveCharacterTextSplitter

class TrainingService:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

    async def _embed_and_store(self, text: str, source_name: str, content_type: str, collection_name: str, user: User, model_id: str) -> int:
        if not text or not text.strip():
            return 0

        chunks = self.text_splitter.split_text(text)
        if not chunks:
            return 0

        embeddings = await bedrock_service.create_batch_text_embeddings(chunks)
        if not embeddings or len(embeddings) != len(chunks):
            print(f"Error: Mismatch between number of chunks ({len(chunks)}) and embeddings ({len(embeddings) if embeddings else 0}) for source {source_name}")
            return 0

        documents_to_add = [
            {
                "id": str(uuid.uuid4()),
                "text": chunk,
                "metadata": {
                    "source_type": content_type,
                    "source": source_name,
                    "uploadedBy": user.username if user else "system",
                    "userId": str(user.id) if user else "system",
                    "modelId": model_id,
                    "collectionName": collection_name,
                },
                "embedding": embedding,
            }
            for chunk, embedding in zip(chunks, embeddings)
        ]

        if documents_to_add:
            await chroma_service.add_documents(collection_name, documents_to_add)
        
        return len(documents_to_add)

    async def process_and_embed_file(self, file: UploadFile, user: User, model_id: str, collection_name: str) -> int:
        if not file.filename:
            raise ValueError("File has no filename.")
        
        file_content_bytes = await file.read()
        text_content = await document_service.parse_file_content(file_content_bytes, file.filename)
        
        num_chunks = await self._embed_and_store(
            text=text_content,
            source_name=file.filename,
            content_type="file",
            collection_name=collection_name,
            user=user,
            model_id=model_id
        )

        if num_chunks > 0:
            await training_history_service.record_action(
                user_id=str(user.id),
                username=user.username,
                collection_name=collection_name,
                document_name=file.filename,
                action=TrainingAction.UPLOAD,
                details={"modelId": model_id, "chunks_added": num_chunks, "source_type": "file"},
            )
        return num_chunks

    async def process_and_embed_url(self, url: str, user: User, model_id: str, collection_name: str) -> int:
        text_content = await web_scraper_service.scrape_url(url)
        if not text_content:
            raise ValueError("Could not scrape any text from the URL.")

        num_chunks = await self._embed_and_store(
            text=text_content,
            source_name=url,
            content_type="url",
            collection_name=collection_name,
            user=user,
            model_id=model_id
        )

        if num_chunks > 0:
            await training_history_service.record_action(
                user_id=str(user.id),
                username=user.username,
                collection_name=collection_name,
                document_name=url,
                action=TrainingAction.UPLOAD,
                details={"modelId": model_id, "chunks_added": num_chunks, "source_type": "url"},
            )
        return num_chunks

    async def process_and_embed_text(self, text: str, document_name: str, user: User, model_id: str, collection_name: str) -> int:
        num_chunks = await self._embed_and_store(
            text=text,
            source_name=document_name,
            content_type="text",
            collection_name=collection_name,
            user=user,
            model_id=model_id
        )
        
        if num_chunks > 0:
            await training_history_service.record_action(
                user_id=str(user.id),
                username=user.username,
                collection_name=collection_name,
                document_name=document_name,
                action=TrainingAction.UPLOAD,
                details={"modelId": model_id, "chunks_added": num_chunks, "source_type": "text"},
            )
        return num_chunks

    async def ingest_directory(self, directory_path: str, collection_name: str, user: User):
        db = get_database()
        if not os.path.isdir(directory_path):
            print(f"Error: Directory not found: {directory_path}")
            return

        collection_doc = await db.get_collection("collections").find_one({"name": collection_name})
        if not collection_doc:
            print(f"Error: Collection '{collection_name}' not found. Skipping ingestion for directory {directory_path}.")
            return
        
        model_id = collection_doc.get("modelId", "unknown")

        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            if not os.path.isfile(file_path):
                continue
            
            print(f"Ingesting {file_path} into collection {collection_name}...")
            try:
                with open(file_path, 'rb') as f:
                    file_content_bytes = f.read()

                text_content = await document_service.parse_file_content(file_content_bytes, filename)
                
                num_chunks = await self._embed_and_store(
                    text=text_content,
                    source_name=filename,
                    content_type="file-ingest",
                    collection_name=collection_name,
                    user=user,
                    model_id=model_id
                )

                if num_chunks > 0:
                    await training_history_service.record_action(
                        user_id=str(user.id),
                        username=user.username,
                        collection_name=collection_name,
                        document_name=filename,
                        action=TrainingAction.UPLOAD,
                        details={"modelId": model_id, "chunks_added": num_chunks, "source_type": "file-ingest", "source_path": file_path},
                    )
                    print(f"Successfully ingested {filename}, added {num_chunks} chunks.")
                else:
                    print(f"No text content found or embedded for {filename}.")
            
            except Exception as e:
                print(f"Failed to process and ingest file {filename}. Error: {e}")

    async def delete_document(self, collection_name: str, document_name: str, user: User):
        await chroma_service.delete_documents_by_source(collection_name=collection_name, source_name=document_name)
        
        await training_history_service.record_action(
            user_id=str(user.id), 
            username=user.username, 
            collection_name=collection_name,
            document_name=document_name,
            action=TrainingAction.DELETE,
            details={"document": document_name}
        )
        return {"message": f"Document {document_name} deleted."}

training_service = TrainingService() 