/**
 * control.js — Settings panel & PyWebView API calls
 */

(function () {
    const gearBtn = document.getElementById('gear-btn');
    const panel = document.getElementById('control-panel');
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    const nextBtn = document.getElementById('btn-next');
    const quickStopBtn = document.getElementById('btn-quick-stop');
    const exportBtn = document.getElementById('btn-export');
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');

    const inputSpeaker = document.getElementById('input-speaker');
    const inputMinutes = document.getElementById('input-minutes');
    const inputSeconds = document.getElementById('input-seconds');
    const inputRate = document.getElementById('input-rate');
    const inputInterval = document.getElementById('input-interval');

    let panelOpen = false;

    /* ═══════ COMPACT SIZES ═══════ */
    const COMPACT_W = 500;
    const COMPACT_H = 120;
    const PANEL_W = 500;
    const MIN_PANEL_H = 340;
    const MAX_PANEL_H = 720;

    /* ═══════ TOGGLE PANEL ═══════ */

    gearBtn.addEventListener('click', () => {
        panelOpen = !panelOpen;
        panel.classList.toggle('hidden', !panelOpen);
        gearBtn.classList.toggle('active', panelOpen);

        // Remove idle dimming when panel is open
        const timer = document.getElementById('floating-timer');
        if (panelOpen) {
            timer.classList.remove('idle');
        }

        if (panelOpen) {
            refreshHistory().then(() => resizeForPanel(true));
        } else {
            resizeForPanel(false);
        }
    });

    /* Right-click also opens panel */
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!panelOpen) {
            panelOpen = true;
            panel.classList.remove('hidden');
            gearBtn.classList.add('active');

            const timer = document.getElementById('floating-timer');
            timer.classList.remove('idle');

            refreshHistory().then(() => resizeForPanel(true));
        }
    });

    /* ═══════ ACTIONS ═══════ */

    startBtn.addEventListener('click', async () => {
        const speaker = inputSpeaker.value.trim() || '发言人';
        const minutes = parseFloat(inputMinutes.value) || 0;
        const seconds = parseFloat(inputSeconds.value) || 0;
        const rateAmt = parseFloat(inputRate.value) || 5;
        const rateInt = parseInt(inputInterval.value) || 5;

        if (minutes === 0 && seconds === 0) {
            inputMinutes.style.borderColor = 'var(--crimson)';
            setTimeout(() => { inputMinutes.style.borderColor = ''; }, 1500);
            return;
        }

        try {
            await pywebview.api.configure(speaker, minutes, seconds, rateAmt, rateInt);
            await pywebview.api.start_timer();
        } catch (e) {
            console.error('Start failed:', e);
        }

        // Collapse panel on start
        panelOpen = false;
        panel.classList.add('hidden');
        gearBtn.classList.remove('active');
        resizeForPanel(false);
    });

    stopBtn.addEventListener('click', async () => {
        try {
            await pywebview.api.stop_timer();
        } catch (e) {
            console.error('Stop failed:', e);
        }
    });

    /* Quick-stop button (hover-revealed) */
    quickStopBtn.addEventListener('click', async () => {
        try {
            await pywebview.api.stop_timer();
        } catch (e) {
            console.error('Quick stop failed:', e);
        }
    });

    nextBtn.addEventListener('click', async () => {
        try {
            await pywebview.api.next_speaker();
        } catch (e) {
            console.error('Next failed:', e);
        }
        await refreshHistory();
        if (panelOpen) resizeForPanel(true);
    });

    /* ═══════ HISTORY ═══════ */

    async function refreshHistory() {
        try {
            const history = await pywebview.api.get_history();
            if (!history || history.length === 0) {
                historySection.classList.add('hidden');
                return;
            }
            historySection.classList.remove('hidden');
            historyList.innerHTML = '';
            for (const h of history) {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `
          <span class="hi-name">${escapeHtml(h.name)}</span>
          <span class="hi-time">${h.allocated} → ${h.actual}</span>
          <span class="hi-cost">￥${h.cost.toFixed(2)}</span>
        `;
                historyList.appendChild(div);
            }
        } catch (e) { /* pywebview not ready */ }
    }

    /* ═══════ CSV EXPORT ═══════ */

    exportBtn.addEventListener('click', async () => {
        try {
            const csv = await pywebview.api.export_csv();
            if (!csv) return;
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meeting-timer-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    });

    /* ═══════ KEYBOARD SHORTCUTS ═══════ */

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') {
            e.preventDefault();
            if (!startBtn.disabled) startBtn.click();
            else if (!stopBtn.disabled) stopBtn.click();
        }
        if (e.code === 'KeyN' && !nextBtn.disabled) nextBtn.click();
        if (e.code === 'Escape') {
            panelOpen = false;
            panel.classList.add('hidden');
            gearBtn.classList.remove('active');
            resizeForPanel(false);
        }
    });

    /* ═══════ DRAG SUPPORT (fallback) ═══════ */

    const dragBar = document.getElementById('drag-bar');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    dragBar.addEventListener('mousedown', (e) => {
        if (e.target === gearBtn || e.target === quickStopBtn) return;
        isDragging = true;
        dragOffsetX = e.screenX;
        dragOffsetY = e.screenY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.screenX - dragOffsetX;
        const dy = e.screenY - dragOffsetY;
        dragOffsetX = e.screenX;
        dragOffsetY = e.screenY;

        try {
            if (window.pywebview && pywebview.api) {
                // CSS -webkit-app-region: drag handles this
            }
        } catch (e) { /* ignore */ }
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    /* ═══════ UTIL ═══════ */

    function resizeForPanel(open) {
        if (!open) {
            try { pywebview.api.set_size(COMPACT_W, COMPACT_H); } catch (e) { }
            return;
        }
        // Base height covers: drag-bar + timer-display + full form + buttons
        // Increased to 420 to ensure buttons are never cut off
        let h = 420;

        // Grow dynamically when history items are present
        const historySection = document.getElementById('history-section');
        if (historySection && !historySection.classList.contains('hidden')) {
            const items = document.querySelectorAll('#history-list .history-item').length;
            if (items > 0) {
                // Header (50) + items (28px each) + padding (20)
                h += 70 + Math.min(items * 28, 240);
            }
        }

        h = Math.min(h, MAX_PANEL_H);

        // Call set_size with a small delay to ensure UI threads are clear
        // But also call immediately for perceived responsiveness
        try { pywebview.api.set_size(PANEL_W, h); } catch (e) { }

        setTimeout(() => {
            try { pywebview.api.set_size(PANEL_W, h); } catch (e) { }
        }, 50);
    }

    function escapeHtml(text) {
        const el = document.createElement('span');
        el.textContent = text;
        return el.innerHTML;
    }
})();
