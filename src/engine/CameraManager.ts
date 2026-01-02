export interface VideoSource {
    id: string; // matches element id
    type: 'camera' | 'display';
    deviceId?: string; 
    stream: MediaStream;
     videoElement: HTMLVideoElement;
}
 
export class CameraManager {
   private sources: Map<string, VideoSource> = new Map();
 
   constructor() {
     // No default init
   }
 
   async getDevices() {
     const devices = await navigator.mediaDevices.enumerateDevices();
     return devices.filter(d => d.kind === 'videoinput');
   }
 
   async startCamera(elementId: string, deviceId?: string): Promise<void> {
     this.stop(elementId); // Stop existing if any
 
     const constraints: MediaStreamConstraints = {
       audio: false, 
       video: {
         deviceId: deviceId ? { exact: deviceId } : undefined,
         width: { ideal: 1920 },
         height: { ideal: 1080 },
         frameRate: { ideal: 60 },
       },
     };
 
     const stream = await navigator.mediaDevices.getUserMedia(constraints);
     await this.setupSource(elementId, 'camera', stream, deviceId);
   }
 
   async startScreenShare(elementId: string): Promise<void> {
      this.stop(elementId);
 
      const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
      });
      
      await this.setupSource(elementId, 'display', stream);
 
      // Handle User stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => {
          this.stop(elementId);
      };
   }
 
   private async setupSource(id: string, type: 'camera' | 'display', stream: MediaStream, deviceId?: string) {
       const video = document.createElement('video');
       video.autoplay = true;
       video.muted = true;
       video.playsInline = true;
       video.srcObject = stream;
 
       await new Promise<void>((resolve) => {
           video.onloadedmetadata = () => {
               video.play().then(() => resolve());
           };
       });
 
       this.sources.set(id, {
           id,
           type,
           deviceId,
           stream,
           videoElement: video
       });
   }
 
   stop(elementId: string): void {
     const source = this.sources.get(elementId);
     if (source) {
       source.stream.getTracks().forEach((track) => track.stop());
       source.videoElement.srcObject = null;
       this.sources.delete(elementId);
     }
   }

   stopAll(): void {
       this.sources.forEach((_, id) => this.stop(id));
   }
 
   getVideoElement(elementId: string): HTMLVideoElement | undefined {
     return this.sources.get(elementId)?.videoElement;
   }
 
   getSource(elementId: string): VideoSource | undefined {
       return this.sources.get(elementId);
   }
 }
