from langchain.text_splitter import RecursiveCharacterTextSplitter

def split_text_into_chunks(text: str, chunk_size: int = 2000, chunk_overlap: int = 100) -> list[str]:
    """
    Splits a long text into smaller chunks using RecursiveCharacterTextSplitter.

    Args:
        text: The input text to be split.
        chunk_size: The maximum size of each chunk.
        chunk_overlap: The number of characters to overlap between chunks.

    Returns:
        A list of text chunks.
    """
    if not text or not text.strip():
        return []

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""] # Sensible default separators
    )
    
    documents = text_splitter.create_documents([text])
    return [doc.page_content for doc in documents] 