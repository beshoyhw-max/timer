/**
 * control_panel.js — Control window logic:
 *   Settings, start/stop/next, add-time, tier config, alarm config, history.
 */

(function () {
    'use strict';

    /* ═══════ DOM REFS ═══════ */

    const inputSpeaker = document.getElementById('input-speaker');
    const inputMinutes = document.getElementById('input-minutes');
    const inputSeconds = document.getElementById('input-seconds');

    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnNext = document.getElementById('btn-next');

    const addTimeBtns = document.querySelectorAll('.btn-add[data-mins]');
    const inputCustomTime = document.getElementById('input-custom-time');
    const btnAddCustom = document.getElementById('btn-add-custom');
    const addTimeSection = document.getElementById('add-time-section');

    const tiersContainer = document.getElementById('tiers-container');
    const btnAddTier = document.getElementById('btn-add-tier');
    const inputMaxCost = document.getElementById('input-max-cost');
    const inputAlarm1 = document.getElementById('input-alarm-1');
    const inputAlarm2 = document.getElementById('input-alarm-2');
    const btnSaveConfig = document.getElementById('btn-save-config');

    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    const btnExport = document.getElementById('btn-export');

    const statusPhase = document.getElementById('status-phase');
    const statusSpeaker = document.getElementById('status-speaker');
    const statusClock = document.getElementById('status-clock');
    const statusCost = document.getElementById('status-cost');

    // Quote & Speakers
    const inputQuote = document.getElementById('input-quote');
    const speakersContainer = document.getElementById('speakers-container');
    const btnAddSpeaker = document.getElementById('btn-add-speaker');
    const btnImportExcel = document.getElementById('btn-import-excel');
    const btnLoadNext = document.getElementById('btn-load-next');

    /* ═══════ INIT — load config ═══════ */

    window.addEventListener('pywebviewready', () => {
        loadConfig();
        setInterval(pollState, 200);
    });

    async function loadConfig() {
        try {
            const cfg = await pywebview.api.get_config();
            renderTiers(cfg.tiers || []);
            inputMaxCost.value = cfg.max_cost || 2500;
            inputAlarm1.value = (cfg.alarm_threshold_1 || 300) / 60;
            inputAlarm2.value = (cfg.alarm_threshold_2 || 60) / 60;
            inputQuote.value = cfg.quote || '';
            renderSpeakers(cfg.speakers || []);
        } catch (e) {
            renderTiers([{ threshold_mins: 0, rate_amount: 5, rate_interval: 5 }]);
        }
    }

    // Sync quote to backend live on every keystroke
    inputQuote.addEventListener('input', async () => {
        try { await pywebview.api.set_quote(inputQuote.value.trim()); } catch (e) { }
    });

    /* ═══════ TIER CONFIG UI ═══════ */

    function renderTiers(tiers) {
        tiersContainer.innerHTML = '';
        tiers.forEach((t, i) => addTierRow(t, i));
    }

    function addTierRow(tier = { threshold_mins: 0, rate_amount: 5, rate_interval: 5 }, index = -1) {
        const row = document.createElement('div');
        row.className = 'tier-row';
        row.innerHTML = `
      <span class="tier-label">After</span>
      <input type="number" class="narrow tier-threshold" min="0" max="999" step="any" value="${tier.threshold_mins}" title="Overtime minutes threshold">
      <span class="tier-label">min →</span>
      <span class="tier-label">￥</span>
      <input type="number" class="narrow tier-rate" min="0" max="9999" step="any" value="${tier.rate_amount}" title="Amount per tick">
      <span class="tier-label">/</span>
      <input type="number" class="narrow tier-interval" min="1" max="120" value="${tier.rate_interval}" title="Seconds per tick">
      <span class="tier-label">s</span>
      <button class="btn-remove-tier" title="Remove tier">✕</button>
    `;
        row.querySelector('.btn-remove-tier').addEventListener('click', () => {
            row.remove();
        });
        tiersContainer.appendChild(row);
    }

    btnAddTier.addEventListener('click', () => {
        // Default new tier: starts at the highest existing threshold + 5 mins
        const existing = tiersContainer.querySelectorAll('.tier-threshold');
        let maxThreshold = 0;
        existing.forEach(el => {
            const v = parseFloat(el.value) || 0;
            if (v > maxThreshold) maxThreshold = v;
        });
        addTierRow({ threshold_mins: maxThreshold + 5, rate_amount: 10, rate_interval: 5 });
    });

    /* ═══════ SAVE CONFIG ═══════ */

    btnSaveConfig.addEventListener('click', async () => {
        const tiers = [];
        tiersContainer.querySelectorAll('.tier-row').forEach(row => {
            tiers.push({
                threshold_mins: parseFloat(row.querySelector('.tier-threshold').value) || 0,
                rate_amount: parseFloat(row.querySelector('.tier-rate').value) || 5,
                rate_interval: parseInt(row.querySelector('.tier-interval').value) || 5,
            });
        });

        const maxCost = parseFloat(inputMaxCost.value) || 2500;
        const alarm1 = (parseFloat(inputAlarm1.value) || 5) * 60;
        const alarm2 = (parseFloat(inputAlarm2.value) || 1) * 60;

        try {
            await pywebview.api.save_config(tiers, maxCost, alarm1, alarm2);
            // Save quote
            await pywebview.api.set_quote(inputQuote.value.trim());
            // Save speakers
            await pywebview.api.set_speakers(collectSpeakers());
            btnSaveConfig.textContent = '✅ Saved!';
            setTimeout(() => { btnSaveConfig.textContent = '💾 Save Config'; }, 1500);
        } catch (e) {
            console.error('Save config failed:', e);
            btnSaveConfig.textContent = '❌ Error';
            setTimeout(() => { btnSaveConfig.textContent = '💾 Save Config'; }, 1500);
        }
    });

    /* ═══════ START / STOP / NEXT ═══════ */

    btnStart.addEventListener('click', async () => {
        const speaker = inputSpeaker.value.trim() || '发言人';
        const minutes = parseFloat(inputMinutes.value) || 0;
        const seconds = parseFloat(inputSeconds.value) || 0;

        if (minutes === 0 && seconds === 0) {
            inputMinutes.style.borderColor = '#ef4444';
            setTimeout(() => { inputMinutes.style.borderColor = ''; }, 1500);
            return;
        }

        try {
            await pywebview.api.configure(speaker, minutes, seconds);
            await pywebview.api.start_timer();
        } catch (e) {
            console.error('Start failed:', e);
        }
    });

    btnStop.addEventListener('click', async () => {
        try { await pywebview.api.stop_timer(); } catch (e) { console.error('Stop failed:', e); }
    });

    btnNext.addEventListener('click', async () => {
        try { await pywebview.api.next_speaker(); } catch (e) { console.error('Next failed:', e); }
        await refreshHistory();
    });

    /* ═══════ ADD TIME ═══════ */

    addTimeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const mins = parseFloat(btn.getAttribute('data-mins')) || 0;
            try { await pywebview.api.add_time(mins * 60); } catch (e) { console.error('Add time failed:', e); }
        });
    });

    btnAddCustom.addEventListener('click', async () => {
        const mins = parseFloat(inputCustomTime.value) || 0;
        if (mins <= 0) return;
        try { await pywebview.api.add_time(mins * 60); } catch (e) { console.error('Add custom time failed:', e); }
    });

    /* ═══════ STATE POLLING ═══════ */

    let currentPhase = 'idle';

    async function pollState() {
        try {
            const state = await pywebview.api.get_state();
            updateStatusBar(state);
            updateButtons(state.phase);
            currentPhase = state.phase;
        } catch (e) { /* pywebview not ready */ }
    }

    function updateStatusBar(state) {
        const phase = state.phase;

        // Phase chip
        statusPhase.className = 'status-chip ' + phase;
        const phaseLabels = {
            idle: 'READY',
            countdown: 'COUNTING',
            warning: 'WARNING',
            overtime: 'OVERTIME',
            collecting: 'ANIMATION',
            thankyou: 'DONE',
        };
        statusPhase.textContent = phaseLabels[phase] || phase.toUpperCase();

        // Speaker
        statusSpeaker.textContent = state.speaker || '';

        // Clock
        if (phase === 'overtime') {
            const otMin = Math.floor(state.overtime_seconds / 60);
            const otSec = Math.floor(state.overtime_seconds % 60);
            statusClock.textContent = `+${String(otMin).padStart(2, '0')}:${String(otSec).padStart(2, '0')}`;
        } else if (phase === 'idle' || phase === 'collecting' || phase === 'thankyou') {
            statusClock.textContent = '00:00';
        } else {
            statusClock.textContent = state.remaining_display;
        }

        // Cost
        if (phase === 'overtime' || ((phase === 'collecting' || phase === 'thankyou') && state.cost > 0)) {
            statusCost.classList.remove('hidden');
            statusCost.textContent = `￥${state.cost.toFixed(2)}`;
        } else {
            statusCost.classList.add('hidden');
        }

        // Time added indicator
        if (state.time_added > 0 && phase !== 'idle') {
            const addedMin = Math.floor(state.time_added / 60);
            statusClock.title = `+${addedMin}min added`;
        } else {
            statusClock.title = '';
        }
    }

    function updateButtons(phase) {
        btnStart.disabled = phase !== 'idle';
        btnStop.disabled = phase === 'idle' || phase === 'collecting' || phase === 'thankyou';
        btnNext.disabled = phase !== 'thankyou' && phase !== 'idle';

        // Add-time buttons: only active when timer is running
        const canAddTime = phase === 'countdown' || phase === 'warning' || phase === 'overtime';
        addTimeBtns.forEach(btn => { btn.disabled = !canAddTime; });
        btnAddCustom.disabled = !canAddTime;
        inputCustomTime.disabled = !canAddTime;
    }

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
                const timeAdded = h.time_added ? ` (+${Math.round(h.time_added / 60)}m)` : '';
                div.innerHTML = `
          <span class="hi-name">${escapeHtml(h.name)}</span>
          <span class="hi-time">${h.allocated} → ${h.actual}${timeAdded}</span>
          <span class="hi-cost">￥${h.cost.toFixed(2)}</span>
        `;
                historyList.appendChild(div);
            }
        } catch (e) { /* pywebview not ready */ }
    }

    // Auto-refresh history when a speaker finishes
    let prevPhaseForHistory = 'idle';
    setInterval(async () => {
        try {
            const state = await pywebview.api.get_state();
            if (state.phase === 'thankyou' && prevPhaseForHistory !== 'thankyou') {
                await refreshHistory();
            }
            prevPhaseForHistory = state.phase;
        } catch (e) { }
    }, 500);

    /* ═══════ CSV EXPORT ═══════ */

    btnExport.addEventListener('click', async () => {
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
            if (!btnStart.disabled) btnStart.click();
            else if (!btnStop.disabled) btnStop.click();
        }
        if (e.code === 'KeyN' && !btnNext.disabled) btnNext.click();
    });

    /* ═══════ UTIL ═══════ */

    function escapeHtml(text) {
        const el = document.createElement('span');
        el.textContent = text;
        return el.innerHTML;
    }

    /* ═══════ SPEAKER LIST ═══════ */

    function renderSpeakers(speakers) {
        speakersContainer.innerHTML = '';
        speakers.forEach(s => addSpeakerRow(s));
    }

    function addSpeakerRow(speaker = { name: '', time_secs: 300, words: '' }) {
        const row = document.createElement('div');
        row.className = 'speaker-row';
        row.innerHTML = `
          <input type="text" class="speaker-name" value="${escapeHtml(speaker.name)}" placeholder="Name" title="Speaker name">
          <input type="number" class="narrow speaker-time" min="0" max="99999" value="${speaker.time_secs}" title="Time in seconds">
          <span class="tier-label">s</span>
          <input type="text" class="speaker-words" value="${escapeHtml(speaker.words)}" placeholder="Words / Topic" title="Talking points">
          <button class="btn-remove-tier" title="Remove speaker">✕</button>
        `;
        row.querySelector('.btn-remove-tier').addEventListener('click', () => row.remove());
        speakersContainer.appendChild(row);
    }

    function collectSpeakers() {
        const speakers = [];
        speakersContainer.querySelectorAll('.speaker-row').forEach(row => {
            speakers.push({
                name: row.querySelector('.speaker-name').value.trim(),
                time_secs: parseInt(row.querySelector('.speaker-time').value) || 0,
                words: row.querySelector('.speaker-words').value.trim(),
            });
        });
        return speakers;
    }

    btnAddSpeaker.addEventListener('click', () => addSpeakerRow());

    btnImportExcel.addEventListener('click', async () => {
        try {
            const speakers = await pywebview.api.import_speakers_from_excel();
            if (speakers && speakers.length > 0) {
                renderSpeakers(speakers);
                btnImportExcel.textContent = `✅ ${speakers.length} imported`;
                setTimeout(() => { btnImportExcel.textContent = '📂 Import Excel'; }, 2000);
            }
        } catch (e) {
            console.error('Import failed:', e);
        }
    });

    btnLoadNext.addEventListener('click', async () => {
        try {
            // Auto-finish current speaker if in DONE state
            if (currentPhase === 'thankyou' || currentPhase === 'collecting') {
                await pywebview.api.next_speaker();
                await refreshHistory();
            }
            const speaker = await pywebview.api.load_next_speaker();
            if (speaker && speaker.name) {
                inputSpeaker.value = speaker.name;
                const totalSecs = speaker.time_secs || 0;
                inputMinutes.value = Math.floor(totalSecs / 60);
                inputSeconds.value = totalSecs % 60;
                // Update quote input with speaker's words
                if (speaker.words) {
                    inputQuote.value = speaker.words;
                }
                // Highlight current speaker in list
                speakersContainer.querySelectorAll('.speaker-row').forEach(row => {
                    row.classList.remove('active-speaker');
                    if (row.querySelector('.speaker-name').value.trim() === speaker.name) {
                        row.classList.add('active-speaker');
                    }
                });
            }
        } catch (e) {
            console.error('Load next speaker failed:', e);
        }
    });
})();
