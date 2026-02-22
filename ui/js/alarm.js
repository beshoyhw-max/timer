/**
 * alarm.js — Alarm sounds using HTMLAudioElement.
 * Plays 1.wav for warning1, 2.wav for warning2 (first 2 seconds only).
 * Pre-warms audio on first user gesture to avoid autoplay policy blocks.
 */

const AlarmSounds = (() => {
    const PLAY_DURATION_MS = 2000;

    const alarm1 = new Audio('sounds/1.wav');
    const alarm2 = new Audio('sounds/2.wav');

    alarm1.preload = 'auto';
    alarm2.preload = 'auto';

    let warmedUp = false;

    function warmUp() {
        if (warmedUp) return;
        warmedUp = true;

        // Play and immediately pause to unlock audio on this gesture
        [alarm1, alarm2].forEach(a => {
            a.volume = 0;
            a.play().then(() => {
                a.pause();
                a.currentTime = 0;
                a.volume = 1;
            }).catch(() => {
                a.volume = 1;
            });
        });

        document.removeEventListener('click', warmUp, true);
        document.removeEventListener('keydown', warmUp, true);
        document.removeEventListener('mousedown', warmUp, true);
    }

    // Listen on capture phase so any click/key anywhere warms up audio
    document.addEventListener('click', warmUp, true);
    document.addEventListener('keydown', warmUp, true);
    document.addEventListener('mousedown', warmUp, true);

    // Also try to warm up when pywebview is ready (Qt backend may allow this)
    window.addEventListener('pywebviewready', warmUp);

    function playClip(audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.play().catch(e => console.warn('Alarm playback failed:', e));

        // Stop after 2 seconds
        setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
        }, PLAY_DURATION_MS);
    }

    /**
     * @param {'warning1'|'warning2'} type
     */
    function playAlarm(type) {
        try {
            if (type === 'warning1') playClip(alarm1);
            else if (type === 'warning2') playClip(alarm2);
        } catch (e) {
            console.warn('Alarm playback failed:', e);
        }
    }

    return { playAlarm };
})();
