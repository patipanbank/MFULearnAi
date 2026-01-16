"use strict";
/**
 * Data quality validation and normalization utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.validateChunk = validateChunk;
exports.removeDuplicateChunks = removeDuplicateChunks;
exports.removeNearDuplicates = removeNearDuplicates;
exports.validateAndNormalizeChunks = validateAndNormalizeChunks;
exports.validateExtractedText = validateExtractedText;
/**
 * Normalizes text by removing special characters and normalizing whitespace
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    return text
        // Normalize unicode characters
        .normalize('NFKC')
        // Remove zero-width characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Normalize whitespace (but keep single spaces)
        .replace(/[ \t]+/g, ' ')
        // Remove excessive newlines (keep max 2 consecutive)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/**
 * Validates if text chunk is meaningful
 */
function validateChunk(chunk, minLength = 10) {
    if (!chunk || typeof chunk !== 'string') {
        return {
            isValid: false,
            error: 'Chunk is empty or invalid'
        };
    }
    const normalized = normalizeText(chunk);
    // Check minimum length
    if (normalized.length < minLength) {
        return {
            isValid: false,
            error: `Chunk is too short (minimum ${minLength} characters)`
        };
    }
    // Check if chunk is mostly whitespace
    const nonWhitespaceRatio = (normalized.replace(/\s/g, '').length / normalized.length);
    if (nonWhitespaceRatio < 0.3) {
        return {
            isValid: false,
            error: 'Chunk contains too much whitespace'
        };
    }
    // Check for meaningful content (at least some letters or numbers)
    const hasContent = /[a-zA-Z0-9\u0E00-\u0E7F]/.test(normalized);
    if (!hasContent) {
        return {
            isValid: false,
            error: 'Chunk does not contain meaningful content'
        };
    }
    return {
        isValid: true,
        normalizedText: normalized
    };
}
/**
 * Removes duplicate chunks from an array
 */
function removeDuplicateChunks(chunks) {
    const seen = new Set();
    const normalized = chunks.map(chunk => normalizeText(chunk));
    return normalized.filter(chunk => {
        if (!chunk || chunk.length === 0) {
            return false;
        }
        // Use a more sophisticated key for duplicate detection
        // Normalize to lowercase and remove extra whitespace
        const key = chunk
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200); // Use first 200 chars for comparison
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
/**
 * Detects and removes near-duplicate chunks (similarity > 90%)
 */
function removeNearDuplicates(chunks, similarityThreshold = 0.9) {
    if (chunks.length <= 1) {
        return chunks;
    }
    const normalized = chunks.map(chunk => normalizeText(chunk));
    const unique = [];
    for (const chunk of normalized) {
        if (!chunk || chunk.length === 0) {
            continue;
        }
        let isDuplicate = false;
        const chunkKey = chunk.toLowerCase().replace(/\s+/g, ' ').trim();
        for (const existing of unique) {
            const existingKey = existing.toLowerCase().replace(/\s+/g, ' ').trim();
            // Simple similarity check using longest common subsequence
            const similarity = calculateSimilarity(chunkKey, existingKey);
            if (similarity >= similarityThreshold) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            unique.push(chunk);
        }
    }
    return unique;
}
/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) {
        return 1.0;
    }
    // Use Levenshtein distance for similarity
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[str2.length][str1.length];
}
/**
 * Validates and normalizes all chunks
 */
function validateAndNormalizeChunks(chunks, shouldRemoveNearDuplicates = true) {
    const validChunks = [];
    const errors = [];
    let invalidCount = 0;
    for (let i = 0; i < chunks.length; i++) {
        const validation = validateChunk(chunks[i]);
        if (validation.isValid && validation.normalizedText) {
            validChunks.push(validation.normalizedText);
        }
        else {
            invalidCount++;
            errors.push(`Chunk ${i + 1}: ${validation.error || 'Invalid chunk'}`);
        }
    }
    // Remove exact duplicates
    let uniqueChunks = removeDuplicateChunks(validChunks);
    const duplicateCount = validChunks.length - uniqueChunks.length;
    invalidCount += duplicateCount;
    // Remove near-duplicates if enabled
    if (shouldRemoveNearDuplicates && uniqueChunks.length > 1) {
        const beforeNearDup = uniqueChunks.length;
        uniqueChunks = removeNearDuplicates(uniqueChunks, 0.9);
        const nearDupCount = beforeNearDup - uniqueChunks.length;
        invalidCount += nearDupCount;
        if (nearDupCount > 0) {
            errors.push(`${nearDupCount} near-duplicate chunks were removed`);
        }
    }
    return {
        validChunks: uniqueChunks,
        invalidCount,
        errors
    };
}
/**
 * Checks if extracted text has meaningful content
 */
function validateExtractedText(text, minLength = 100) {
    if (!text || typeof text !== 'string') {
        return {
            isValid: false,
            error: 'Extracted text is empty'
        };
    }
    const normalized = normalizeText(text);
    if (normalized.length < minLength) {
        return {
            isValid: false,
            error: `Extracted text is too short (minimum ${minLength} characters, got ${normalized.length})`
        };
    }
    // Check for meaningful content
    const hasContent = /[a-zA-Z0-9\u0E00-\u0E7F]/.test(normalized);
    if (!hasContent) {
        return {
            isValid: false,
            error: 'Extracted text does not contain meaningful content'
        };
    }
    return {
        isValid: true,
        normalizedText: normalized
    };
}
