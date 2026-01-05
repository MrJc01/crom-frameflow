declare module 'mp4box' {
    export interface MP4File {
        onReady?: (info: MP4Info) => void;
        onError?: (e: string | Event) => void;
        onSamples?: (id: number, user: any, samples: MP4Sample[]) => void;
        setExtractionOptions(trackId: number, user: any, options: { nbSamples?: number; accessUnits?: boolean }): void;
        start(): void;
        stop(): void;
        appendBuffer(buffer: ArrayBuffer): number;
        flush(): void;
        getTrackById(id: number): any;
    }

    export interface MP4Info {
        duration: number;
        timescale: number;
        isFragmented: boolean;
        isProgressive: boolean;
        hasIOD: boolean;
        brands: string[];
        created: Date;
        modified: Date;
        tracks: MP4Track[];
    }

    export interface MP4Track {
        id: number;
        created: Date;
        modified: Date;
        movie_duration: number;
        layer: number;
        alternate_group: number;
        volume: number;
        track_width: number;
        track_height: number;
        timescale: number;
        duration: number;
        bitrate: number;
        codec: string;
        language: string;
        nb_samples: number;
        name: string;
        type: string;
        // ... more properties as needed
    }

    export interface MP4Sample {
        number: number;
        track_id: number;
        description_index: number;
        timescale: number;
        cts: number; // Composition Time Stamp
        dts: number; // Decoding Time Stamp
        duration: number;
        size: number;
        is_sync: boolean; // Keyframe
        is_leading: number;
        depends_on: number;
        is_depended_on: number;
        has_redundancy: number;
        degradation_priority: number;
        offset: number;
        data: Uint8Array;
    }
    
    export class DataStream {
        static BIG_ENDIAN: boolean;
        static LITTLE_ENDIAN: boolean;
        constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
        buffer: ArrayBuffer;
    }

    export function createFile(): MP4File;
}
