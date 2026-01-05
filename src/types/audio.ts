export interface AudioPluginData {
    id: string;
    type: 'eq-3band' | 'compressor' | 'reverb' | 'delay' | 'gain';
    enabled: boolean;
    parameters: Record<string, number>;
}
