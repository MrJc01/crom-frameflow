export interface VideoSource {
    id: string; // matches element id
    type: 'camera' | 'display';
    deviceId?: string; 
    stream: MediaStream;
     videoElement: HTMLVideoElement;
}
 
export class CameraManager {
   private sources: Map<string, VideoSource> = new Map();
   private activeStreams: Map<string, MediaStream> = new Map(); // Map deviceId -> Stream

   constructor() {
     // No default init
   }
 
   async getDevices() {
     // ... same ...
     const devices = await navigator.mediaDevices.enumerateDevices();
     return devices.filter(d => d.kind === 'videoinput');
   }
 
   async startCamera(elementId: string, deviceId?: string): Promise<void> {
     // Don't stop ALL, just this element's previous source
     this.stop(elementId); 
 
     const key = deviceId || 'default';
     let stream = this.activeStreams.get(key);

     if (!stream || !stream.active) {
         const constraints: MediaStreamConstraints = {
            audio: false, 
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 60 },
            },
         };
         try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.activeStreams.set(key, stream);
         } catch (err) {
             console.error("Failed to get camera stream", err);
             return;
         }
     }
 
     await this.setupSource(elementId, 'camera', stream!, deviceId);
   }
 
   async startScreenShare(elementId: string): Promise<void> {
      this.stop(elementId);
 
      try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false
          });
          
          await this.setupSource(elementId, 'display', stream);
     
          // Handle User stopping share via browser UI
          stream.getVideoTracks()[0].onended = () => {
              this.stop(elementId); // Use public stop
          };
      } catch (err) {
          console.error("Display media cancelled or failed", err);
      }
   }
 
   private async setupSource(id: string, type: 'camera' | 'display', stream: MediaStream, deviceId?: string) {
       const video = document.createElement('video');
       video.autoplay = true;
       video.muted = true;
       video.playsInline = true;
       video.srcObject = stream;
 
       // We don't need to await play() for the logic to continue, but ensures it's ready.
       video.onloadedmetadata = () => {
           video.play().catch(e => console.error("Video play failed", e));
       };
 
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
       // Only stop the tracks if NO OTHER source is using this stream?
       // Current implementation: activeStreams holds the stream.
       // If we call stop(), we just unbind the element. 
       // We should NOT stop the tracks if it's a camera shared by others.
       
       if (source.type === 'display') {
           // Display streams are unique per request usually, safe to stop.
           source.stream.getTracks().forEach(t => t.stop());
       } else {
           // Camera: Check if any other source uses this stream
           // For simplicity: We KEEP camera streams open for the session or until explicit "Stop All".
           // Or we could count refs.
           // Let's keep it open to allow fast switching/cloning.
       }

       source.videoElement.srcObject = null;
       this.sources.delete(elementId);
     }
   }

   stopAll(): void {
       // Stop all elements
       this.sources.forEach((_, id) => this.stop(id));
       // Stop all actual streams
       this.activeStreams.forEach(stream => stream.getTracks().forEach(t => t.stop()));
       this.activeStreams.clear();
   }
 
   getVideoElement(elementId: string): HTMLVideoElement | undefined {
     return this.sources.get(elementId)?.videoElement;
   }
 
   getSource(elementId: string): VideoSource | undefined {
       return this.sources.get(elementId);
   }
 }
