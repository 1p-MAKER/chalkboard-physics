export class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private isMuted: boolean = false;
    private bgmOscillators: OscillatorNode[] = [];
    private bgmGain: GainNode | null = null;
    private isPlayingBGM: boolean = false;

    constructor() {
        // Initialize on user interaction usually, but we prepare the class.
    }

    private init() {
        if (!this.ctx) {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx!.createGain();
            this.masterGain.connect(this.ctx!.destination);
            this.masterGain.gain.value = 0.5; // Default volume
        }
        if (this.ctx?.state === 'suspended') {
            this.ctx.resume();
        }
    }

    public toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : 0.5;
        }
    }

    public getMutedState() {
        return this.isMuted;
    }

    // --- SE ---

    public playPop() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }

    public playSpawn() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx!;

        // Major chord arpeggio
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            const start = ctx.currentTime + i * 0.05;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    }

    public playJump() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }

    public playFootstep() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx!;

        // Noise buffer for step
        const bufferSize = ctx.sampleRate * 0.05; // 0.05s
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();

        // Low pass filter to make it dull
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        noise.start();
    }

    public playBubblePop() {
        this.playPop(); // Reuse pop sound
    }

    // --- BGM ---
    // Simple looping ambient melody
    public startBGM() {
        if (this.isPlayingBGM || this.isMuted) return;
        this.init();
        this.isPlayingBGM = true;
        this.scheduleNote();
    }

    public stopBGM() {
        this.isPlayingBGM = false;
        // Logic to stop scheduling would be handled by not calling next schedule
    }

    // Very simple generative ambient music
    private scheduleNote() {
        if (!this.isPlayingBGM || !this.ctx) return;
        const ctx = this.ctx;

        // Pentatonic scale frequencies
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
        const note = scale[Math.floor(Math.random() * scale.length)];

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = note;

        const now = ctx.currentTime;
        const duration = 1.0;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.5);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now);
        osc.stop(now + duration);

        // Schedule next note
        setTimeout(() => this.scheduleNote(), 800);
    }
}

export const soundManager = new SoundManager();
