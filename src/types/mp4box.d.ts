declare module 'mp4box' {
    export interface MP4File {
        onMoovStart?: () => void;
        onReady?: (info: any) => void;
        onError?: (e: string) => void;
        addTrack(options: any): number;
        addSample(trackId: number, data: Uint8Array, options: any): void;
        save(fileName: string): void;
        flush(): void;
        appendBuffer(data: ArrayBuffer): number;
        start(): void;
        stop(): void;
    }

    export function createFile(): MP4File;

    export class DataStream {
        buffer: ArrayBuffer;
        save(fileName: string): void;
    }
}
