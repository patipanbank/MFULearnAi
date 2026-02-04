const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const KNOWLEDGE_URL = 'http://localhost:7000/api/knowledge/parse';
const MOCK_USER_ID = 'test-user-id';
const MOCK_HEADERS = {
    'x-user-id': MOCK_USER_ID,
    'x-role': 'admin',
    'x-department': 'Engineering'
};

async function testUpload(fileName, buffer, mimeType) {
    console.log(`\n--- Testing ${fileName} ---`);
    try {
        const form = new FormData();
        form.append('file', buffer, { filename: fileName, contentType: mimeType });

        const response = await axios.post(KNOWLEDGE_URL, form, {
            headers: {
                ...form.getHeaders(),
                ...MOCK_HEADERS
            }
        });

        if (response.data.success) {
            console.log('✅ Success!');
            const ir = response.data.ir;
            console.log(`Type: ${ir.file_type}`);
            console.log(`Blocks: ${ir.blocks.length}`);
            console.log('Metadata:', JSON.stringify(ir.metadata));
            // Log first block content preview
            if (ir.blocks.length > 0) {
                console.log('First Block Preview:', ir.blocks[0].content.substring(0, 100) + '...');
                if (ir.blocks[0].metadata) console.log('First Block Meta:', ir.blocks[0].metadata);
            }
        } else {
            console.error('❌ Failed (Business):', response.data);
        }
    } catch (e) {
        console.error('❌ Failed (Network/Server):', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', e.response.data);
        }
    }
}

async function run() {
    // 1. Test Text File
    const textBuffer = Buffer.from('Hello world, this is a test document.');
    await testUpload('test.txt', textBuffer, 'text/plain');

    // 2. Test "Scanned" PDF (Mocking simple PDF structure is hard with raw buffer, 
    // using a minimal valid PDF header/trailer might work or we rely on actual file if available.
    // For now, let's test the "Magic Byte" detection failure or garbage detection logic if possible?
    // Actually, our PdfAdapter uses `pdfjs-dist`, so it needs valid PDF structure. 
    // We will skip generating complex PDF binary here and test simple text fallback or error handling.

    // 3. Test Code File
    const codeBuffer = Buffer.from('console.log("Hello"); function test() { return true; }');
    await testUpload('script.js', codeBuffer, 'application/javascript');

    // 4. Test Markdown
    const mdBuffer = Buffer.from('# Title\n## Section\nContent here.');
    await testUpload('readme.md', mdBuffer, 'text/markdown');

    console.log('\n--- Verification Complete ---');
}

run();
