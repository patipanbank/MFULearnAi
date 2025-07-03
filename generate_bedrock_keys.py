#!/usr/bin/env python3
"""
Generate API Keys for Bedrock API Gateway
"""

import uuid
import json
import secrets
import os
from datetime import datetime

API_KEYS_FILE = "bedrock_api_keys.json"


def generate_api_keys(count=3):
    """Generate secure API keys for Bedrock Gateway"""
    return [str(uuid.uuid4()).replace('-', '') for _ in range(count)]


def generate_secret_key():
    """Generate a secure secret key"""
    return secrets.token_urlsafe(32)


def get_existing_secret_key_from_json(json_path=API_KEYS_FILE):
    if not os.path.exists(json_path):
        return None
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            secret_key = data.get("secret_key")
            if secret_key:
                return secret_key
    except Exception as e:
        print(f"Warning: Could not read {json_path}: {e}")
    return None


def main():
    print("🔑 Bedrock API Gateway - Key Generator")
    print("=" * 50)

    # Check for existing secret key in JSON
    existing_secret = get_existing_secret_key_from_json()

    # Generate new API keys every time
    keys = generate_api_keys(3)

    if existing_secret:
        secret_key = existing_secret
        print(f"\n📅 Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🔢 Number of API keys: {len(keys)}")
        print(f"🔐 Using existing secret key (from {API_KEYS_FILE})")
    else:
        secret_key = generate_secret_key()
        print(f"\n📅 Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🔢 Number of API keys: {len(keys)}")
        print(f"🔐 Generated new secret key and saved to {API_KEYS_FILE}")

    print("\n🔑 Generated API Keys:")
    print("-" * 30)
    for i, key in enumerate(keys, 1):
        print(f"{i}. {key}")

    print(f"\n🔐 Secret Key:")
    print("-" * 30)
    print(f"SECRET: {secret_key}")

    # Create comma-separated string for .env
    keys_string = ','.join(keys)

    print(f"\n📋 For .env file:")
    print("-" * 30)
    print(f"BEDROCK_SECRET_KEY={secret_key}")
    print(f"BEDROCK_API_KEYS={keys_string}")

    # Save to file (always update API keys, keep secret key)
    output_data = {
        "generated_at": datetime.now().isoformat(),
        "secret_key": secret_key,
        "api_keys": keys,
        "env_format": {
            "BEDROCK_SECRET_KEY": secret_key,
            "BEDROCK_API_KEYS": keys_string
        }
    }
    with open(API_KEYS_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    print(f"\n💾 Keys saved to: {API_KEYS_FILE}")

    print("\n📝 Usage Instructions:")
    print("-" * 30)
    print("1. Copy both BEDROCK_SECRET_KEY and BEDROCK_API_KEYS lines above to your .env file")
    print("2. Use any of the generated API keys in your API requests")
    print("3. Example curl command:")
    print(f"   curl -H 'Authorization: Bearer {keys[0]}' \\")
    print("        -H 'Content-Type: application/json' \\")
    print("        -d '{\"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}' \\")
    print("        http://localhost:8001/api/v1/bedrock/converse-stream")

    print("\n⚠️  Security Notes:")
    print("-" * 30)
    print(f"- Secret key is always loaded from {API_KEYS_FILE} (never overwritten)")
    print("- API keys are newly generated every time you run this script")
    print("- Keep these keys secure and don't commit them to version control")
    print("- Rotate API keys regularly in production")
    print("- Use different keys for different environments")
    print("- The secret key is used for JWT signing and other security features")

if __name__ == "__main__":
    main() 