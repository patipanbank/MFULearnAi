export function generateObjectId(): string {
  // First 4 bytes: Unix epoch timestamp in seconds (big-endian)
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const randomBytes = crypto.getRandomValues(new Uint8Array(8)); // remaining 8 bytes
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timestamp + randomHex;
} 