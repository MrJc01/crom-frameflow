/**
 * Collect Files Utility
 * Bundle project and all assets into a portable archive
 */

import JSZip from 'jszip';
import { db } from '../db/FrameFlowDB';

export interface CollectOptions {
    includeAssets: boolean;
    includeMetadata: boolean;
    projectName: string;
}

export interface CollectResult {
    success: boolean;
    blob?: Blob;
    filename?: string;
    stats?: {
        projectSize: number;
        assetCount: number;
        totalSize: number;
    };
    error?: string;
}

export interface ProjectData {
    cards: any[];
    timeline: any;
    settings?: any;
    version: string;
}

/**
 * Collect all project files into a ZIP archive
 */
export async function collectFiles(
    projectData: ProjectData,
    options: CollectOptions
): Promise<CollectResult> {
    try {
        const zip = new JSZip();
        let totalSize = 0;
        let assetCount = 0;

        // Add project JSON
        const projectJson = JSON.stringify({
            ...projectData,
            exportDate: new Date().toISOString(),
            exportVersion: '1.0',
        }, null, 2);
        
        zip.file('project.json', projectJson);
        totalSize += projectJson.length;

        // Add README
        const readme = generateReadme(options.projectName, projectData);
        zip.file('README.md', readme);

        // Collect assets if requested
        if (options.includeAssets) {
            const assetsFolder = zip.folder('assets');
            if (assetsFolder) {
                const assets = await db.getAllAssets();
                
                for (const asset of assets) {
                    if (asset.blob) {
                        const ext = getExtensionFromType(asset.type);
                        const filename = `${asset.id}${ext}`;
                        assetsFolder.file(filename, asset.blob);
                        totalSize += asset.blob.size;
                        assetCount++;
                    }
                }
            }
        }

        // Add metadata if requested
        if (options.includeMetadata) {
            const metadata = {
                projectName: options.projectName,
                createdAt: new Date().toISOString(),
                cardCount: projectData.cards?.length || 0,
                assetCount,
                frameFlowVersion: projectData.version,
            };
            zip.file('metadata.json', JSON.stringify(metadata, null, 2));
        }

        // Generate the ZIP blob
        const blob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const filename = sanitizeFilename(options.projectName) + '.frameflow.zip';

        return {
            success: true,
            blob,
            filename,
            stats: {
                projectSize: projectJson.length,
                assetCount,
                totalSize: blob.size,
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate README for the exported project
 */
function generateReadme(projectName: string, data: ProjectData): string {
    return `# ${projectName}

Exported from FrameFlow on ${new Date().toLocaleDateString()}

## Contents

- \`project.json\` - Project data (cards, timeline, settings)
- \`assets/\` - Media files used in the project
- \`metadata.json\` - Export metadata

## Import

To import this project:
1. Open FrameFlow
2. Go to File > Import Project
3. Select this ZIP file

## Project Stats

- Cards: ${data.cards?.length || 0}
- Timeline Duration: ${data.timeline?.duration || 0}ms
- Version: ${data.version}
`;
}

/**
 * Get file extension from asset type
 */
function getExtensionFromType(type: string): string {
    const typeMap: Record<string, string> = {
        'image': '.png',
        'video': '.mp4',
        'audio': '.mp3',
    };
    return typeMap[type] || '.bin';
}

/**
 * Sanitize filename for safe saving
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 100);
}

/**
 * Download the collected archive
 */
export function downloadArchive(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
