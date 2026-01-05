/**
 * File Validation Utility
 * Validates file integrity using magic bytes (file signatures)
 */

// Magic bytes for common formats
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
    // Images
    'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
    'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
    'image/gif': [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF87a or GIF89a
    'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }],
    'image/bmp': [{ bytes: [0x42, 0x4D] }],
    'image/tiff': [{ bytes: [0x49, 0x49, 0x2A, 0x00] }, { bytes: [0x4D, 0x4D, 0x00, 0x2A] }],
    
    // Videos
    'video/mp4': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // ftyp
    'video/webm': [{ bytes: [0x1A, 0x45, 0xDF, 0xA3] }],
    'video/quicktime': [{ bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], offset: 4 }], // ftypqt
    'video/x-msvideo': [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // AVI
    'video/x-matroska': [{ bytes: [0x1A, 0x45, 0xDF, 0xA3] }], // MKV
    
    // Audio
    'audio/mpeg': [{ bytes: [0xFF, 0xFB] }, { bytes: [0xFF, 0xFA] }, { bytes: [0x49, 0x44, 0x33] }], // MP3 or ID3
    'audio/wav': [{ bytes: [0x52, 0x49, 0x46, 0x46] }],
    'audio/ogg': [{ bytes: [0x4F, 0x67, 0x67, 0x53] }],
    'audio/flac': [{ bytes: [0x66, 0x4C, 0x61, 0x43] }],
    'audio/aac': [{ bytes: [0xFF, 0xF1] }, { bytes: [0xFF, 0xF9] }],
    
    // Project/Document
    'application/zip': [{ bytes: [0x50, 0x4B, 0x03, 0x04] }], // ZIP (used by many formats)
    'application/json': [{ bytes: [0x7B] }], // starts with {
};

export interface ValidationResult {
    isValid: boolean;
    detectedType: string | null;
    declaredType: string;
    error?: string;
}

/**
 * Read first N bytes from a file
 */
async function readFileBytes(file: File, numBytes: number): Promise<Uint8Array> {
    const slice = file.slice(0, numBytes);
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
}

/**
 * Check if bytes match a signature at a given offset
 */
function matchesSignature(fileBytes: Uint8Array, signature: { bytes: number[]; offset?: number }): boolean {
    const offset = signature.offset || 0;
    if (fileBytes.length < offset + signature.bytes.length) return false;
    
    return signature.bytes.every((byte, i) => fileBytes[offset + i] === byte);
}

/**
 * Detect file type from magic bytes
 */
function detectFileType(fileBytes: Uint8Array): string | null {
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
        for (const sig of signatures) {
            if (matchesSignature(fileBytes, sig)) {
                return mimeType;
            }
        }
    }
    return null;
}

/**
 * Validate a file for corruption and type mismatch
 */
export async function validateFile(file: File): Promise<ValidationResult> {
    try {
        // Read first 32 bytes for signature detection
        const fileBytes = await readFileBytes(file, 32);
        
        if (fileBytes.length === 0) {
            return {
                isValid: false,
                detectedType: null,
                declaredType: file.type,
                error: 'File is empty'
            };
        }

        const detectedType = detectFileType(fileBytes);
        const declaredType = file.type;

        // If we can detect the type, verify it matches
        if (detectedType) {
            // Check for type category match (image/*, video/*, audio/*)
            const detectedCategory = detectedType.split('/')[0];
            const declaredCategory = declaredType.split('/')[0];
            
            if (detectedCategory !== declaredCategory) {
                return {
                    isValid: false,
                    detectedType,
                    declaredType,
                    error: `File type mismatch: declared as ${declaredType} but detected as ${detectedType}`
                };
            }
        }

        // Additional validation for specific formats
        if (declaredType.startsWith('image/')) {
            const valid = await validateImage(file);
            if (!valid) {
                return {
                    isValid: false,
                    detectedType,
                    declaredType,
                    error: 'Image file appears to be corrupted'
                };
            }
        }

        return {
            isValid: true,
            detectedType,
            declaredType
        };
    } catch (err) {
        return {
            isValid: false,
            detectedType: null,
            declaredType: file.type,
            error: `Validation error: ${err instanceof Error ? err.message : 'Unknown error'}`
        };
    }
}

/**
 * Validate image by attempting to load it
 */
async function validateImage(file: File): Promise<boolean> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img.width > 0 && img.height > 0);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(false);
        };
        
        img.src = url;
    });
}

/**
 * Validate video by checking if it can be loaded
 */
export async function validateVideo(file: File): Promise<boolean> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(video.duration > 0);
        };
        
        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(false);
        };
        
        video.src = url;
    });
}

/**
 * Validate project file (JSON structure)
 */
export async function validateProjectFile(file: File): Promise<{ valid: boolean; error?: string }> {
    try {
        const text = await file.text();
        const json = JSON.parse(text);
        
        // Check for required FrameFlow project structure
        if (!json.cards && !json.timeline && !json.version) {
            return { valid: false, error: 'Invalid project structure: missing required fields' };
        }
        
        return { valid: true };
    } catch (err) {
        return { 
            valid: false, 
            error: `Invalid JSON: ${err instanceof Error ? err.message : 'Parse error'}` 
        };
    }
}

/**
 * Batch validate multiple files
 */
export async function validateFiles(files: File[]): Promise<Map<File, ValidationResult>> {
    const results = new Map<File, ValidationResult>();
    
    await Promise.all(
        files.map(async (file) => {
            const result = await validateFile(file);
            results.set(file, result);
        })
    );
    
    return results;
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(mimeType: string): string {
    const typeMap: Record<string, string> = {
        'image/jpeg': 'JPEG Image',
        'image/png': 'PNG Image',
        'image/gif': 'GIF Image',
        'image/webp': 'WebP Image',
        'video/mp4': 'MP4 Video',
        'video/webm': 'WebM Video',
        'video/quicktime': 'QuickTime Video',
        'audio/mpeg': 'MP3 Audio',
        'audio/wav': 'WAV Audio',
        'audio/ogg': 'OGG Audio',
        'application/json': 'JSON File',
    };
    
    return typeMap[mimeType] || mimeType;
}
