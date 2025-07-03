#!/usr/bin/env python3
"""
API Key Generator for MFU Learn AI Bedrock Gateway
Generates secure UUID-based API keys for production use
"""

import uuid
import secrets
import string
from typing import List

def generate_uuid_key(prefix: str = "mfu") -> str:
    """Generate a UUID-based API key with prefix"""
    return f"{prefix}-{str(uuid.uuid4())}"

def generate_secure_key(prefix: str = "mfu", length: int = 32) -> str:
    """Generate a cryptographically secure random key"""
    # Use alphanumeric characters for better compatibility
    chars = string.ascii_letters + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(length))
    return f"{prefix}-{random_part}"

def generate_api_keys(count: int = 4, method: str = "uuid") -> List[str]:
    """Generate multiple API keys"""
    keys = []
    
    if method == "uuid":
        prefixes = ["web-app", "mobile-app", "admin-panel", "partner-api"]
        for i in range(min(count, len(prefixes))):
            keys.append(generate_uuid_key(prefixes[i]))
    elif method == "secure":
        prefixes = ["web-app", "mobile-app", "admin-panel", "partner-api"]
        for i in range(min(count, len(prefixes))):
            keys.append(generate_secure_key(prefixes[i]))
    else:
        # Generate generic keys
        for i in range(count):
            keys.append(generate_uuid_key(f"api-key-{i+1}"))
    
    return keys

def main():
    """Main function to generate and display API keys"""
    print("🔑 MFU Learn AI - API Key Generator")
    print("=" * 50)
    
    # Generate UUID-based keys
    print("\n📋 UUID-based API Keys (Recommended):")
    uuid_keys = generate_api_keys(4, "uuid")
    for i, key in enumerate(uuid_keys, 1):
        print(f"  {i}. {key}")
    
    # Generate secure random keys
    print("\n🔐 Secure Random API Keys:")
    secure_keys = generate_api_keys(4, "secure")
    for i, key in enumerate(secure_keys, 1):
        print(f"  {i}. {key}")
    
    # Display environment variable format
    print("\n📝 Environment Variable Format:")
    print("API_KEYS=" + ",".join(uuid_keys))
    
    # Display usage example
    print("\n💡 Usage Example:")
    print("Headers: X-API-Key: " + uuid_keys[0])
    
    # Save to file option
    save_to_file = input("\n💾 Save to .env file? (y/n): ").lower().strip()
    if save_to_file == 'y':
        with open('.env', 'a') as f:
            f.write(f"\n# Generated API Keys\n")
            f.write(f"API_KEYS={','.join(uuid_keys)}\n")
        print("✅ API keys saved to .env file")

if __name__ == "__main__":
    main() 