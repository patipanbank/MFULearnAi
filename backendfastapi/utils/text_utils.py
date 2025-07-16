import tiktoken

def get_token_count(text: str, model: str = "cl100k_base") -> int:
    """Returns the number of tokens in a text string."""
    encoding = tiktoken.get_encoding(model)
    num_tokens = len(encoding.encode(text))
    return num_tokens 