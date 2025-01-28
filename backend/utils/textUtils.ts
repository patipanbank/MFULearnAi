export function splitTextIntoChunks(text: string, chunkSize: number = 4000): string[] {
  // ทำความสะอาดข้อความ
  const cleanText = text
    .trim()
    .replace(/\s+/g, ' ') // แทนที่ whitespace หลายตัวด้วยช่องว่างเดียว
    .replace(/\n+/g, ' '); // แทนที่ newline ด้วยช่องว่าง

  // ถ้าข้อความสั้นกว่าหรือเท่ากับ chunkSize ให้คืนค่าเป็น array เดียว
  if (cleanText.length <= chunkSize) {
    console.log(`Text length (${cleanText.length}) is less than chunk size (${chunkSize}), returning single chunk`);
    return [cleanText];
  }

  // ถ้าข้อความยาวเกิน chunkSize จึงค่อยแบ่ง
  console.log(`Text length (${cleanText.length}) exceeds chunk size (${chunkSize}), splitting into chunks`);
  const chunks: string[] = [];
  let currentChunk = '';
  const words = cleanText.split(' ');

  for (const word of words) {
    if ((currentChunk + ' ' + word).length <= chunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  console.log(`Created ${chunks.length} chunks`);
  return chunks;
} 