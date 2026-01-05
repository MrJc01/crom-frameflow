export class AudioRecorderService {
    private static instance: AudioRecorderService;
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private source: MediaStreamAudioSourceNode | null = null;

    private constructor() {}

    static getInstance(): AudioRecorderService {
        if (!AudioRecorderService.instance) {
            AudioRecorderService.instance = new AudioRecorderService();
        }
        return AudioRecorderService.instance;
    }

    async startRecording(): Promise<void> {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup Visualizer
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

            // Setup Recorder
            const options = { mimeType: 'audio/webm' };
            // Fallback for Safari/others if webm not supported
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                 console.warn("webm not supported, trying default");
                 // let default handle it
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            console.log("Recording started");
        } catch (err) {
            console.error("Error accessing microphone:", err);
            throw err;
        }
    }

    stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject("No recorder active");
                return;
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.cleanup();
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    getAudioLevel(): number {
        if (!this.analyser || !this.dataArray) return 0;
        
        this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.dataArray.length / 255; // Normalize 0-1
    }

    private cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.mediaRecorder = null;
        this.analyser = null;
        this.source = null;
    }
}
