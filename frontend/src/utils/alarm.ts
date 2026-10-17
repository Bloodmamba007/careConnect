class EmergencyAlarm {
  private audioCtx: AudioContext | null = null;
  private intervalId: number | null = null;
  private isMuted: boolean = false;

  public start() {
    if (this.intervalId) return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      let highPitch = true;
      const playBeep = () => {
        if (!this.audioCtx || this.isMuted) return;
        try {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = "sine";
          // High emergency tone alternating 880Hz (A5) and 660Hz (E5)
          osc.frequency.setValueAtTime(highPitch ? 880 : 660, this.audioCtx.currentTime);
          highPitch = !highPitch;

          gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.22);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.25);
        } catch {
          // Ignore audio error
        }
      };

      playBeep();
      this.intervalId = window.setInterval(playBeep, 350);
    } catch (e) {
      console.warn("Could not start audio alarm:", e);
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const emergencyAlarm = new EmergencyAlarm();
