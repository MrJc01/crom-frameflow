import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraManager } from './CameraManager';

describe('CameraManager', () => {
    let cameraManager: CameraManager;
    let mockGetUserMedia: any;
    let mockEnumerateDevices: any;
    let mockGetDisplayMedia: any;
    let mockTracks: any[];

    beforeEach(() => {
        // Mock MediaStream tracks
        mockTracks = [{
            stop: vi.fn(),
            enabled: true,
            kind: 'video',
            onended: null
        }];

        // Mock MediaStream
        const mockStream = {
            getTracks: vi.fn().mockReturnValue(mockTracks),
            getVideoTracks: vi.fn().mockReturnValue(mockTracks),
            active: true,
        } as unknown as MediaStream;

        // Mock navigator.mediaDevices
        mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
        mockEnumerateDevices = vi.fn().mockResolvedValue([
            { kind: 'videoinput', deviceId: 'cam1', label: 'Camera 1' },
            { kind: 'audioinput', deviceId: 'mic1', label: 'Mic 1' }
        ]);
        mockGetDisplayMedia = vi.fn().mockResolvedValue(mockStream);

        Object.assign(navigator, {
            mediaDevices: {
                getUserMedia: mockGetUserMedia,
                enumerateDevices: mockEnumerateDevices,
                getDisplayMedia: mockGetDisplayMedia,
            }
        });

        // Mock HTMLVideoElement methods
        window.HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

        cameraManager = new CameraManager();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should enumerate video devices', async () => {
        const devices = await cameraManager.getDevices();
        expect(mockEnumerateDevices).toHaveBeenCalled();
        expect(devices).toHaveLength(1);
        expect(devices[0].label).toBe('Camera 1');
    });

    it('should start camera and create video element', async () => {
        await cameraManager.startCamera('test-element', 'cam1');
        
        expect(mockGetUserMedia).toHaveBeenCalledWith(expect.objectContaining({
            video: expect.objectContaining({
                deviceId: { exact: 'cam1' }
            })
        }));

        const video = cameraManager.getVideoElement('test-element');
        expect(video).toBeInstanceOf(HTMLVideoElement);
        expect(video?.srcObject).toBeDefined();
    });

    it('should reuse existing stream for same device', async () => {
        // First call
        await cameraManager.startCamera('el1', 'cam1');
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1);

        // Second call with same device
        await cameraManager.startCamera('el2', 'cam1');
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1); // Should not call again
        
        expect(cameraManager.getSource('el1')?.stream).toBe(cameraManager.getSource('el2')?.stream);
    });

    it('should start screen share', async () => {
        await cameraManager.startScreenShare('screen-el');
        expect(mockGetDisplayMedia).toHaveBeenCalled();
        
        const source = cameraManager.getSource('screen-el');
        expect(source?.type).toBe('display');
    });

    it('should stop element source without stopping shared stream', async () => {
        await cameraManager.startCamera('el1', 'cam1');
        const stream = cameraManager.getSource('el1')?.stream;
        
        cameraManager.stop('el1');
        
        // Stream tracks should NOT be stopped because it's cached in activeStreams
        expect(mockTracks[0].stop).not.toHaveBeenCalled();
        expect(cameraManager.getSource('el1')).toBeUndefined();
    });

    it('should stopAll and stop streams', async () => {
        await cameraManager.startCamera('el1', 'cam1');
        
        cameraManager.stopAll();
        
        expect(mockTracks[0].stop).toHaveBeenCalled();
        expect(cameraManager.getActiveSources()).toHaveLength(0);
    });
});
