// Effect Preset Definitions
export interface EffectPreset {
    id: string;
    name: string;
    category: 'color' | 'style' | 'cinematic';
    thumbnail: string; // Color for preview
    filter: string; // CSS filter string
    description?: string;
}

export const EFFECT_PRESETS: EffectPreset[] = [
    // Color Presets
    {
        id: 'none',
        name: 'None',
        category: 'color',
        thumbnail: '#333',
        filter: 'none',
        description: 'Remove all filters'
    },
    {
        id: 'vivid',
        name: 'Vivid',
        category: 'color',
        thumbnail: '#ff6b6b',
        filter: 'saturate(1.4) contrast(1.1)',
        description: 'Boost colors and contrast'
    },
    {
        id: 'warm',
        name: 'Warm',
        category: 'color',
        thumbnail: '#ffa94d',
        filter: 'sepia(0.2) saturate(1.2) brightness(1.05)',
        description: 'Warm, golden tones'
    },
    {
        id: 'cool',
        name: 'Cool',
        category: 'color',
        thumbnail: '#74c0fc',
        filter: 'hue-rotate(10deg) saturate(0.9) brightness(1.05)',
        description: 'Cool, blue tones'
    },
    {
        id: 'muted',
        name: 'Muted',
        category: 'color',
        thumbnail: '#adb5bd',
        filter: 'saturate(0.6) contrast(0.95)',
        description: 'Desaturated, soft look'
    },
    
    // Style Presets
    {
        id: 'bw',
        name: 'B&W',
        category: 'style',
        thumbnail: '#495057',
        filter: 'grayscale(1)',
        description: 'Classic black and white'
    },
    {
        id: 'sepia',
        name: 'Sepia',
        category: 'style',
        thumbnail: '#d4a574',
        filter: 'sepia(0.8)',
        description: 'Vintage sepia tone'
    },
    {
        id: 'invert',
        name: 'Invert',
        category: 'style',
        thumbnail: '#228be6',
        filter: 'invert(1)',
        description: 'Inverted colors'
    },
    {
        id: 'blur',
        name: 'Soft Blur',
        category: 'style',
        thumbnail: '#e9ecef',
        filter: 'blur(2px)',
        description: 'Slight blur effect'
    },
    
    // Cinematic Presets
    {
        id: 'film',
        name: 'Film Look',
        category: 'cinematic',
        thumbnail: '#845ef7',
        filter: 'contrast(1.1) saturate(0.85) sepia(0.1)',
        description: 'Classic film emulation'
    },
    {
        id: 'noir',
        name: 'Noir',
        category: 'cinematic',
        thumbnail: '#212529',
        filter: 'grayscale(1) contrast(1.3) brightness(0.95)',
        description: 'High contrast black and white'
    },
    {
        id: 'teal-orange',
        name: 'Teal & Orange',
        category: 'cinematic',
        thumbnail: '#20c997',
        filter: 'contrast(1.1) saturate(1.2) hue-rotate(-5deg)',
        description: 'Hollywood color grade'
    },
    {
        id: 'dreamy',
        name: 'Dreamy',
        category: 'cinematic',
        thumbnail: '#f8f0fc',
        filter: 'brightness(1.1) contrast(0.9) saturate(0.8) blur(0.5px)',
        description: 'Soft, ethereal look'
    },
    {
        id: 'dramatic',
        name: 'Dramatic',
        category: 'cinematic',
        thumbnail: '#343a40',
        filter: 'contrast(1.3) brightness(0.95) saturate(0.9)',
        description: 'High contrast drama'
    }
];

export const getPresetsByCategory = (category: EffectPreset['category']) => 
    EFFECT_PRESETS.filter(p => p.category === category);

export const getPresetById = (id: string) => 
    EFFECT_PRESETS.find(p => p.id === id);
