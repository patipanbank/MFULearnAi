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
            
        print(f"Initializing ChromaDB with URL: {settings.CHROMA_URL}")
        
        # CHROMA_URL might be like "http://localhost:8000"
        # The client needs host and port separately.
        try:
            url_parts = settings.CHROMA_URL.split(':')
            host = url_parts[1].replace('//', '')
            port = int(url_parts[2])
            
            print(f"Connecting to ChromaDB at {host}:{port}")
            self.client = chromadb.HttpClient(host=host, port=port)
            
            # Using a default embedding function for now, but the actual embeddings
            # will be provided by TitanService.
            self.default_ef = embedding_functions.DefaultEmbeddingFunction()
            print("ChromaDB client initialized successfully.")

        except (IndexError, ValueError) as e:
            print(f"Invalid CHROMA_URL format: {settings.CHROMA_URL}")
            raise ValueError(f"Invalid CHROMA_URL format: {settings.CHROMA_URL}. Expected format: http://hostname:port. Error: {e}")
        except Exception as e:
            print(f"Failed to initialize ChromaDB client: {e}")
            raise RuntimeError(f"Failed to initialize ChromaDB client: {e}")

    async def _get_collection(self, name: str):
        if not self.client:
            raise ConnectionError("ChromaDB client is not initialized.")
        try:
            print(f"Getting or creating collection: {name}")
            # This is a synchronous call, run it in a thread
            collection = await asyncio.to_thread(self.client.get_or_create_collection, name=name)
            print(f"Successfully got collection: {name}")
            return collection
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
        try:
            collection = await self._get_collection(collection_name)
            if not collection:
                print(f"Collection '{collection_name}' not found")
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
        except Exception as e:
            print(f"Error getting documents from collection '{collection_name}': {e}")
            return {"documents": [], "total": 0}

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

    # ------------------------------------------------------------------
    # LangChain integration
    # ------------------------------------------------------------------
    def get_vector_store(self, collection_name: str):
        """คืนค่า LangChain Chroma VectorStore สำหรับ collection ที่กำหนด

        ใช้ BedrockEmbeddings เป็น embedding function เพื่อให้ vector store
        สามารถทำ similarity search ได้
        """
        try:
            from langchain_community.vectorstores import Chroma  # lazy import เพื่อหลีกเลี่ยง heavy deps ตอน startup
            from langchain_aws import BedrockEmbeddings
            import boto3
            from botocore.config import Config

            print(f"🔍 Creating vector store for collection: {collection_name}")

            # สร้าง embeddings (เหมือนที่ agent_factory ใช้)
            boto3_config = Config(read_timeout=900, retries={"max_attempts": 3, "mode": "standard"})
            bedrock_client = boto3.client(
                service_name="bedrock-runtime",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=boto3_config,
            )

            embeddings = BedrockEmbeddings(client=bedrock_client)

            # สร้างและคืน vector store ใช้ client HTTP ที่สร้างไว้แล้วเพื่อเชื่อม ChromaDB
            vector_store = Chroma(
                client=self.client,
                collection_name=collection_name,
                embedding_function=embeddings,
            )

            # ตรวจสอบจำนวน documents ใน collection
            try:
                collection = self.client.get_collection(name=collection_name)
                count = collection.count()
                print(f"📊 Collection '{collection_name}' has {count} documents")
                
                if count == 0:
                    print(f"⚠️ Collection '{collection_name}' is empty!")
                else:
                    # แสดงตัวอย่าง documents
                    results = collection.get(limit=3, include=["documents", "metadatas"])
                    print(f"📄 Sample documents in '{collection_name}':")
                    documents = results.get('documents', [])
                    if documents:
                        for i, doc in enumerate(documents[:2]):
                            print(f"  {i+1}. {doc[:100]}...")
                    else:
                        print("  No documents found")
                        
            except Exception as e:
                print(f"❌ Error checking collection '{collection_name}': {e}")

            return vector_store
        except Exception as e:
            print(f"❌ ไม่สามารถสร้าง VectorStore สำหรับ {collection_name}: {e}")
            return None

# Instantiate the service
chroma_service = ChromaService() 