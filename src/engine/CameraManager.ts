export interface CameraConfig {
  deviceId?: string;
  width?: number;
  height?: number;
  frameRate?: number;
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement;

  constructor() {
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
  }

  async start(config: CameraConfig = {}): Promise<void> {
    if (this.stream) {
      this.stop();
    }

    const constraints: MediaStreamConstraints = {
      audio: false, // We only care about video for now
      video: {
        deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
        width: config.width ? { ideal: config.width } : { ideal: 1920 },
        height: config.height ? { ideal: config.height } : { ideal: 1080 },
        frameRate: config.frameRate ? { ideal: config.frameRate } : { ideal: 60 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play().then(() => resolve());
        };
      });
      
      console.log('Camera started', this.stream.getVideoTracks()[0].getSettings());
    } catch (error) {
      console.error('Failed to start camera:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.videoElement.srcObject = null;
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}
