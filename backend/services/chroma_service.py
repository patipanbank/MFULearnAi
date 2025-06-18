import chromadb
from chromadb.utils import embedding_functions
from config.config import settings
from typing import List, Dict, Any, Optional
import asyncio
import uuid
from chromadb.api.types import QueryResult

class ChromaService:
    def __init__(self, host: str = "http://localhost:8000"):
        if not settings.CHROMA_URL:
            raise ValueError("CHROMA_URL is not set in the environment variables.")
            
        # CHROMA_URL might be like "http://localhost:8000"
        # The client needs host and port separately.
        try:
            url_parts = settings.CHROMA_URL.split(':')
            host = url_parts[1].replace('//', '')
            port = int(url_parts[2])
            
            self.client = chromadb.HttpClient(host=host, port=port)
            
            # Using a default embedding function for now, but the actual embeddings
            # will be provided by TitanService.
            self.default_ef = embedding_functions.DefaultEmbeddingFunction()
            print("ChromaDB client initialized.")

        except (IndexError, ValueError) as e:
            raise ValueError(f"Invalid CHROMA_URL format: {settings.CHROMA_URL}. Expected format: http://hostname:port. Error: {e}")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize ChromaDB client: {e}")

    async def _get_collection(self, name: str):
        if not self.client:
            raise ConnectionError("ChromaDB client is not initialized.")
        try:
            # This is a synchronous call, run it in a thread
            return await asyncio.to_thread(self.client.get_or_create_collection, name=name)
        except Exception as e:
            print(f"Error getting or creating collection '{name}': {e}")
            raise

    async def list_collections(self):
        if not self.client:
            raise ConnectionError("ChromaDB client is not initialized.")
        return await asyncio.to_thread(self.client.list_collections)

    async def delete_collection(self, collection_name: str):
        if not self.client:
            raise ConnectionError("ChromaDB client is not initialized.")
        try:
            await asyncio.to_thread(self.client.delete_collection, name=collection_name)
            print(f"Collection {collection_name} deleted successfully.")
        except Exception as e:
            # ChromaDB's http client might raise various exceptions.
            # It's safer to catch a broad exception and log it.
            print(f"An error occurred while deleting collection {collection_name}: {e}")
            # Depending on requirements, you might want to re-raise or handle differently
            # For now, we print and absorb to prevent crashing the caller.
            # Re-raising a more specific, handled error might be better.
            raise ValueError(f"Failed to delete collection {collection_name}")

    async def query_collection(self, collection_name: str, query_embeddings: Any, n_results: int = 5) -> Optional[QueryResult]:
        """
        Queries a collection with the given embeddings.
        Runs the sync query in a separate thread.
        """
        try:
            collection = await self._get_collection(collection_name)
            results = await asyncio.to_thread(
                collection.query,
                query_embeddings=query_embeddings,
                n_results=n_results,
                include=["metadatas", "documents", "distances"]
            )
            return results
        except Exception as e:
            print(f"Error querying collection '{collection_name}': {e}")
            return None # Return None on error to be handled by the caller

    async def add_to_collection(self, collection_name: str, documents: List[str], embeddings: Any, metadatas: Any, ids: List[str]):
        if not documents:
            print("No documents to add. Skipping.")
            return
        
        collection = await self._get_collection(collection_name)
        
        try:
            await asyncio.to_thread(
                collection.add,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
        except Exception as e:
            print(f"Error adding to collection '{collection_name}': {e}")
            raise

    async def add_documents(self, collection_name: str, documents_with_embeddings: List[Dict[str, Any]]):
        if not documents_with_embeddings:
            print("No documents to process. Skipping.")
            return
            
        collection = await self._get_collection(name=collection_name)

        # Unpack the list of document dictionaries into separate lists
        docs = [item['document'] for item in documents_with_embeddings]
        metadatas = [item['metadata'] for item in documents_with_embeddings]
        embeddings = [item['embedding'] for item in documents_with_embeddings]
        ids = [item['id'] for item in documents_with_embeddings]

        if not docs:
            print("Empty document list after unpacking. Skipping add to collection.")
            return
            
        try:
            await asyncio.to_thread(
                collection.add,
                ids=ids,
                embeddings=embeddings,
                documents=docs,
                metadatas=metadatas
            )
            print(f"Successfully added {len(docs)} documents to '{collection_name}'.")
        except Exception as e:
            print(f"Error during batch add to collection '{collection_name}': {e}")
            raise

    async def get_documents(self, collection_name: str, limit: int = 100, offset: int = 0):
        collection = await self._get_collection(collection_name)
        if not collection:
            return {"documents": [], "total": 0}

        total_count = await asyncio.to_thread(collection.count)
        
        results = await asyncio.to_thread(collection.get, limit=limit, offset=offset, include=["metadatas", "documents"])
        
        # The result 'ids' corresponds to the documents and metadatas
        # We'll zip them together to return a list of document objects
        docs = []
        if results and results.get('ids'):
             for i, doc_id in enumerate(results['ids']):
                doc_data = {
                    "id": doc_id,
                    "document": results['documents'][i] if results['documents'] and i < len(results['documents']) else None,
                    "metadata": results['metadatas'][i] if results['metadatas'] and i < len(results['metadatas']) else None
                }
                docs.append(doc_data)

        return {"documents": docs, "total": total_count}

    async def delete_documents(self, collection_name: str, document_ids: List[str]):
        if not document_ids:
            return
        collection = await self._get_collection(collection_name)
        if not collection:
            raise ValueError(f"Collection '{collection_name}' not found.")
            
        await asyncio.to_thread(collection.delete, ids=document_ids)

    async def delete_documents_by_source(self, collection_name: str, source_name: str):
        """Deletes all documents from a collection that match a given source name."""
        collection = await self._get_collection(collection_name)
        if not collection:
            raise ValueError(f"Collection '{collection_name}' not found.")

        # Find documents with the specified source metadata
        results = await asyncio.to_thread(
            collection.get,
            where={"source": source_name},
            include=[] # We only need the IDs
        )
        
        doc_ids_to_delete = results.get('ids')

        if not doc_ids_to_delete:
            print(f"No documents found with source '{source_name}' in collection '{collection_name}'.")
            return

        print(f"Found {len(doc_ids_to_delete)} documents from source '{source_name}' to delete.")
        await self.delete_documents(collection_name, doc_ids_to_delete)
        print(f"Successfully deleted documents from source '{source_name}'.")

# Instantiate the service
chroma_service = ChromaService() 