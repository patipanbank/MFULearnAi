"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitTextIntoChunks = splitTextIntoChunks;
const compromise_1 = __importDefault(require("compromise"));
function splitTextIntoChunks(text, chunkSize = 2000) {
    // Clean the text
    const cleanText = text
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/\n+/g, ' '); // Replace newlines with space
    // If text is shorter than or equal to chunkSize, return as a single chunk
    if (cleanText.length <= chunkSize) {
        return [cleanText];
    }
    // Use compromise for sentence tokenization
    const doc = (0, compromise_1.default)(cleanText);
    const sentences = doc.sentences().out('array');
    // Create chunks based on sentence boundaries
    const chunks = [];
    let currentChunk = '';
    const overlap = 100; // Number of characters to overlap between chunks
    let lastSentences = [];
    for (const sentence of sentences) {
        // If adding this sentence doesn't exceed the chunk size
        if ((currentChunk + ' ' + sentence).length <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
        else {
            // Save the current chunk
            chunks.push(currentChunk.trim());
            // Keep track of the last few sentences for overlap
            lastSentences.push(sentence);
            if (lastSentences.length > 3) {
                lastSentences.shift();
            }
            // Start a new chunk with some overlap
            const overlapText = lastSentences.join(' ');
            currentChunk = overlapText.length > overlap ? overlapText : sentence;
        }
    }
    // Add the final chunk if there's any content left
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    // Handle edge cases where sentences are extremely long
    return handleLongSentences(chunks, chunkSize);
}
// Handle cases where individual sentences exceed the chunk size
function handleLongSentences(chunks, chunkSize) {
    const result = [];
    for (const chunk of chunks) {
        if (chunk.length <= chunkSize) {
            result.push(chunk);
        }
        else {
            // Use compromise for more intelligent word tokenization
            const doc = (0, compromise_1.default)(chunk);
            const terms = doc.terms().out('array');
            let currentSubChunk = '';
            for (const term of terms) {
                if ((currentSubChunk + ' ' + term).length <= chunkSize) {
                    currentSubChunk += (currentSubChunk ? ' ' : '') + term;
                }
                else {
                    result.push(currentSubChunk.trim());
                    currentSubChunk = term;
                }
            }
            if (currentSubChunk) {
                result.push(currentSubChunk.trim());
            }
        }
    }
    return result;
}
