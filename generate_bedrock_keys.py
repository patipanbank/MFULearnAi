#!/usr/bin/env python3
"""
Generate API Keys for Bedrock API Gateway
"""

import uuid
import json
from datetime import datetime

def generate_api_keys(count=3):
    """Generate secure API keys for Bedrock Gateway"""
    
    keys = []
    for i in range(count):
        # Generate UUID-based API key
        api_key = str(uuid.uuid4()).replace('-', '')
        keys.append(api_key)
    
    return keys

def main():
    print("🔑 Bedrock API Gateway - API Key Generator")
    print("=" * 50)
    
    # Generate keys
    keys = generate_api_keys(3)
    
    print(f"\n📅 Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔢 Number of keys: {len(keys)}")
    
    print("\n🔑 Generated API Keys:")
    print("-" * 30)
    for i, key in enumerate(keys, 1):
        print(f"{i}. {key}")
    
    # Create comma-separated string for .env
    keys_string = ','.join(keys)
    
    print(f"\n📋 For .env file:")
    print("-" * 30)
    print(f"BEDROCK_API_KEYS={keys_string}")
    
    # Save to file
    output_file = "bedrock_api_keys.json"
    with open(output_file, 'w') as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "keys": keys,
            "env_format": f"BEDROCK_API_KEYS={keys_string}"
        }, f, indent=2)
    
    print(f"\n💾 Keys saved to: {output_file}")
    
    print("\n📝 Usage Instructions:")
    print("-" * 30)
    print("1. Copy the BEDROCK_API_KEYS line above to your .env file")
    print("2. Use any of the generated keys in your API requests")
    print("3. Example curl command:")
    print(f"   curl -H 'Authorization: Bearer {keys[0]}' \\")
    print("        -H 'Content-Type: application/json' \\")
    print("        -d '{\"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}' \\")
    print("        http://localhost:8001/api/v1/bedrock/converse-stream")
    
    print("\n⚠️  Security Notes:")
    print("-" * 30)
    print("- Keep these keys secure and don't commit them to version control")
    print("- Rotate keys regularly in production")
    print("- Use different keys for different environments")

if __name__ == "__main__":
    main() 