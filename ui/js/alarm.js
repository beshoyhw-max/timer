/**
 * alarm.js — Web Audio API alarm sounds for timer warnings.
 * Plays only in the display window.
 */

const AlarmSounds = (() => {
    let audioCtx = null;

    function getContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playTone(freq, duration, startTime, type = 'sine', volume = 0.3) {
        const ctx = getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gain.gain.setValueAtTime(volume, startTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    /**
     * Soft double-chime — first alarm (e.g. 5 min remaining)
     */
    function playWarning1() {
        const ctx = getContext();
        const now = ctx.currentTime;
        playTone(800, 0.3, now, 'sine', 0.25);
        playTone(1000, 0.3, now + 0.4, 'sine', 0.25);
    }

    /**
     * Urgent triple-tone — second alarm (e.g. 1 min remaining)
     */
    function playWarning2() {
        const ctx = getContext();
        const now = ctx.currentTime;
        playTone(1000, 0.2, now, 'square', 0.2);
        playTone(1200, 0.2, now + 0.25, 'square', 0.25);
        playTone(1400, 0.25, now + 0.5, 'square', 0.3);
    }

    /**
     * @param {'warning1'|'warning2'} type
     */
    function playAlarm(type) {
        try {
            if (type === 'warning1') playWarning1();
            else if (type === 'warning2') playWarning2();
        } catch (e) {
            console.warn('Alarm playback failed:', e);
        }
    }

    return { playAlarm };
})();
