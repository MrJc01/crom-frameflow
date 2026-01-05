
/**
 * Utility for compressing and decompressing data using generic CompressionStream API.
 * Uses GZIP by default.
 */

export async function compressData(data: any): Promise<Blob> {
    const jsonString = JSON.stringify(data);
    const stream = new Blob([jsonString]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    return await new Response(compressedStream).blob();
}

export async function decompressData(blob: Blob): Promise<any> {
    const stream = blob.stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(decompressedStream).text();
    return JSON.parse(text);
}
