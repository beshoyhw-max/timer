/**
 * control_panel.js — Control window logic:
 *   Start/stop/next, add-time, speaker list, quote, history.
 *   Config (tiers, alarms, appearance) is in the separate config window.
 */

(function () {
    'use strict';

    /* ═══════ DOM REFS ═══════ */

    const inputSpeaker = document.getElementById('input-speaker');
    const inputMinutes = document.getElementById('input-minutes');
    const inputSeconds = document.getElementById('input-seconds');

    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const btnNext = document.getElementById('btn-next');

    const addTimeBtns = document.querySelectorAll('.btn-add[data-mins]');
    const inputCustomTime = document.getElementById('input-custom-time');
    const btnAddCustom = document.getElementById('btn-add-custom');
    const addTimeSection = document.getElementById('add-time-section');

    const subTimeBtns = document.querySelectorAll('.btn-sub[data-mins]');
    const inputCustomSubTime = document.getElementById('input-custom-sub-time');
    const btnSubCustom = document.getElementById('btn-sub-custom');

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
    const btnGenerateTemplate = document.getElementById('btn-generate-template');
    const btnLoadNext = document.getElementById('btn-load-next');
    const btnRestartList = document.getElementById('btn-restart-list');
    const btnUnlink = document.getElementById('btn-unlink');

    // Configuration button
    const btnSettings = document.getElementById('btn-settings');

    let activeSpeakerRow = null;  // Currently linked speaker row

    /* ═══════ INIT — load config ═══════ */

    window.addEventListener('pywebviewready', () => {
        loadConfig();
        setInterval(pollState, 200);
    });

    /* ═══════ CONFIG WINDOW ═══════ */

    btnSettings.addEventListener('click', async () => {
        try { await pywebview.api.open_config_window(); } catch (e) { console.error('Open config failed:', e); }
    });

    async function loadConfig() {
        try {
            const cfg = await pywebview.api.get_config();
            inputQuote.value = cfg.quote || '';
            renderSpeakers(cfg.speakers || []);
        } catch (e) {
            console.error('Load config failed:', e);
        }
    }

    // Sync quote to backend live on every keystroke
    inputQuote.addEventListener('input', async () => {
        try { await pywebview.api.set_quote(inputQuote.value.trim()); } catch (e) { }
    });

    /* ═══════ AUTO-SAVE (Quote & Speakers) ═══════ */

    let _saveTimer = null;
    function scheduleAutoSave(delay = 600) {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(doAutoSave, delay);
    }

    async function doAutoSave() {
        try {
            await pywebview.api.set_quote(inputQuote.value.trim());
            await pywebview.api.set_speakers(collectSpeakers());
        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    }

    // Auto-save when speakers change (delegation)
    speakersContainer.addEventListener('input', () => scheduleAutoSave());
    speakersContainer.addEventListener('change', () => scheduleAutoSave());

    /* ═══════ START / STOP / NEXT ═══════ */

    btnStart.addEventListener('click', async () => {
        const speaker = inputSpeaker.value.trim() || I18N.t('label.defaultTopic');
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

    btnPause.addEventListener('click', async () => {
        if (currentPhase === 'paused') {
            try { await pywebview.api.resume_timer(); } catch (e) { console.error('Resume failed:', e); }
        } else {
            try { await pywebview.api.pause_timer(); } catch (e) { console.error('Pause failed:', e); }
        }
    });

    btnStop.addEventListener('click', async () => {
        try { await pywebview.api.stop_timer(); } catch (e) { console.error('Stop failed:', e); }
    });

    btnNext.addEventListener('click', async () => {
        try { await pywebview.api.next_speaker(); } catch (e) { console.error('Next failed:', e); }
        await refreshHistory();

        // If linked to a speaker list, auto-load the next speaker
        if (activeSpeakerRow) {
            try {
                const speaker = await pywebview.api.load_next_speaker();
                if (speaker && speaker.hasOwnProperty('time_secs')) {
                    inputSpeaker.value = speaker.name || '';
                    const totalSecs = speaker.time_secs || 0;
                    inputMinutes.value = Math.floor(totalSecs / 60);
                    inputSeconds.value = totalSecs % 60;
                    inputQuote.value = speaker.words || '';
                    try { await pywebview.api.set_quote(speaker.words || ''); } catch (e) { }

                    // Link the matching speaker row by index
                    const rows = speakersContainer.querySelectorAll('.speaker-row');
                    rows.forEach(row => row.classList.remove('active-speaker'));
                    const rowIndex = (speaker._index != null) ? speaker._index : null;
                    const matchRow = (rowIndex != null && rowIndex < rows.length)
                        ? rows[rowIndex]
                        : [...rows].find(r => r.querySelector('.speaker-name').value.trim() === speaker.name);
                    linkActiveSpeaker(matchRow || null);
                }
            } catch (e) {
                console.error('Auto-load next speaker failed:', e);
            }
        }
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

    /* ═══════ SUBTRACT TIME ═══════ */

    subTimeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const mins = parseFloat(btn.getAttribute('data-mins')) || 0;
            try { await pywebview.api.subtract_time(mins * 60); } catch (e) { console.error('Subtract time failed:', e); }
        });
    });

    btnSubCustom.addEventListener('click', async () => {
        const mins = parseFloat(inputCustomSubTime.value) || 0;
        if (mins <= 0) return;
        try { await pywebview.api.subtract_time(mins * 60); } catch (e) { console.error('Subtract custom time failed:', e); }
    });

    /* ═══════ STATE POLLING ═══════ */

    let currentPhase = 'idle';
    let lastConfig = { spk: null, m: null, s: null };

    async function pollState() {
        try {
            if (currentPhase === 'idle') {
                const spk = inputSpeaker.value.trim() || (window.I18N ? window.I18N.t('label.defaultTopic') : '');
                const m = parseFloat(inputMinutes.value) || 0;
                const s = parseFloat(inputSeconds.value) || 0;
                if (spk !== lastConfig.spk || m !== lastConfig.m || s !== lastConfig.s) {
                    await pywebview.api.configure(spk, m, s);
                    lastConfig = { spk, m, s };
                }
            }
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
            idle: I18N.t('status.ready'),
            countdown: I18N.t('status.counting'),
            warning: I18N.t('status.warning'),
            overtime: I18N.t('status.overtime'),
            collecting: I18N.t('status.animation'),
            thankyou: I18N.t('status.done'),
            paused: I18N.t('status.paused'),
        };
        statusPhase.textContent = phaseLabels[phase] || phase.toUpperCase();

        // Speaker
        statusSpeaker.textContent = state.speaker || '';

        // Clock
        if (phase === 'overtime' || (phase === 'paused' && state.overtime_seconds > 0)) {
            const otSecsAbs = Math.abs(state.overtime_seconds);
            const otMin = Math.floor(otSecsAbs / 60);
            const otSec = Math.floor(otSecsAbs % 60);
            const sign = state.overtime_seconds < 0 ? '-' : '+';
            statusClock.textContent = `${sign}${String(otMin).padStart(2, '0')}:${String(otSec).padStart(2, '0')}`;
        } else if (phase === 'collecting' || phase === 'thankyou') {
            statusClock.textContent = '00:00';
        } else {
            statusClock.textContent = state.remaining_display;
        }

        // Cost
        if (phase === 'overtime' || (phase === 'paused' && state.overtime_seconds > 0) || ((phase === 'collecting' || phase === 'thankyou') && state.cost > 0)) {
            statusCost.classList.remove('hidden');
            statusCost.textContent = `￥${Math.floor(state.cost)}`;
        } else {
            statusCost.classList.add('hidden');
        }

        // Time added indicator
        if (state.time_added > 0 && phase !== 'idle') {
            const addedMin = Math.floor(state.time_added / 60);
            statusClock.title = `+${addedMin}m`;
        } else {
            statusClock.title = '';
        }
    }

    function updateButtons(phase) {
        btnStart.disabled = phase !== 'idle';
        btnStop.disabled = phase === 'idle' || phase === 'collecting' || phase === 'thankyou';
        btnNext.disabled = phase !== 'thankyou' && phase !== 'idle';

        // Pause/Resume button logic
        const canPause = phase === 'countdown' || phase === 'warning' || phase === 'overtime' || phase === 'paused';
        btnPause.disabled = !canPause;

        if (phase === 'paused') {
            btnPause.innerHTML = I18N.t('btn.resume');
            btnPause.classList.add('pulse');
        } else {
            btnPause.innerHTML = I18N.t('btn.pause');
            btnPause.classList.remove('pulse');
        }

        // Add-time buttons: only active when timer is running (or paused)
        const canAddTime = phase === 'countdown' || phase === 'warning' || phase === 'overtime' || phase === 'paused';
        addTimeBtns.forEach(btn => { btn.disabled = !canAddTime; });
        btnAddCustom.disabled = !canAddTime;
        inputCustomTime.disabled = !canAddTime;

        // Subtract-time buttons: same logic as add time
        subTimeBtns.forEach(btn => { btn.disabled = !canAddTime; });
        btnSubCustom.disabled = !canAddTime;
        inputCustomSubTime.disabled = !canAddTime;
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

    function secondsToMMSS(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function parseTimeInput(val) {
        if (!val) return 0;
        const str = String(val).trim();
        if (str.includes(':')) {
            const parts = str.split(':');
            const m = parseFloat(parts[0]) || 0;
            const s = parseFloat(parts[1]) || 0;
            return Math.floor(m * 60 + s);
        }
        // Treat plain numbers as minutes
        return Math.floor((parseFloat(str) || 0) * 60);
    }

    function addSpeakerRow(speaker = { name: '', time_secs: 300, words: '' }) {
        const row = document.createElement('div');
        row.className = 'speaker-row';
        row.innerHTML = `
           <span class="speaker-drag-handle" title="Drag to reorder">⋮⋮</span>
           <input type="text" class="speaker-name" value="${escapeHtml(speaker.name)}" placeholder="${I18N.t('placeholder.topic')}" title="${I18N.t('label.topic')}">
           <input type="text" class="narrow speaker-time" value="${secondsToMMSS(speaker.time_secs)}" placeholder="MM:SS" title="${I18N.t('label.time')}">
           <span class="tier-label">min</span>
           <input type="text" class="speaker-words" value="${escapeHtml(speaker.words)}" placeholder="${I18N.t('label.quote')}" title="${I18N.t('label.quote')}">
           <button class="btn-load-speaker" title="Load this speaker immediately">▶</button>
           <button class="btn-remove-tier" title="Remove speaker">✕</button>
         `;
        row.querySelector('.btn-remove-tier').addEventListener('click', () => { row.remove(); scheduleAutoSave(0); });

        row.querySelector('.btn-load-speaker').addEventListener('click', async () => {
            // Find index of this row
            const rows = Array.from(speakersContainer.querySelectorAll('.speaker-row'));
            const idx = rows.indexOf(row);
            if (idx === -1) return;

            try {
                // Ensure current edited list is saved before loading
                await doAutoSave();
                const loaded = await pywebview.api.load_specific_speaker(idx);

                if (loaded && loaded.hasOwnProperty('time_secs')) {
                    inputSpeaker.value = loaded.name || '';
                    const totalSecs = loaded.time_secs || 0;
                    inputMinutes.value = Math.floor(totalSecs / 60);
                    inputSeconds.value = totalSecs % 60;
                    inputQuote.value = loaded.words || '';
                    try { await pywebview.api.set_quote(loaded.words || ''); } catch (e) { }

                    linkActiveSpeaker(row);
                }
            } catch (e) {
                console.error("Failed to load specific speaker:", e);
            }
        });

        speakersContainer.appendChild(row);
    }

    function collectSpeakers() {
        const speakers = [];
        speakersContainer.querySelectorAll('.speaker-row').forEach(row => {
            speakers.push({
                name: row.querySelector('.speaker-name').value.trim(),
                time_secs: parseTimeInput(row.querySelector('.speaker-time').value),
                words: row.querySelector('.speaker-words').value.trim(),
            });
        });
        return speakers;
    }

    /* ═══════ DRAG-AND-DROP SPEAKER REORDERING ═══════ */

    let draggedRow = null;
    let dragPlaceholder = null;

    speakersContainer.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.speaker-drag-handle');
        if (!handle) return;

        const row = handle.closest('.speaker-row');
        if (!row) return;

        e.preventDefault();
        draggedRow = row;
        draggedRow.classList.add('dragging');

        // Create placeholder for visual gap
        dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'speaker-row-placeholder';
        dragPlaceholder.style.height = row.offsetHeight + 'px';

        const onMouseMove = (moveEvent) => {
            if (!draggedRow) return;

            // Find the row we're hovering over
            const rows = [...speakersContainer.querySelectorAll('.speaker-row:not(.dragging)')];
            let target = null;
            let insertBefore = true;

            for (const r of rows) {
                const rect = r.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (moveEvent.clientY < midY) {
                    target = r;
                    insertBefore = true;
                    break;
                }
                target = r;
                insertBefore = false;
            }

            // Clear previous drag-over indicators
            rows.forEach(r => r.classList.remove('drag-over-above', 'drag-over-below'));

            if (target) {
                target.classList.add(insertBefore ? 'drag-over-above' : 'drag-over-below');
            }
        };

        const onMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (!draggedRow) return;

            // Find final drop target
            const rows = [...speakersContainer.querySelectorAll('.speaker-row:not(.dragging)')];
            let target = null;
            let insertBefore = true;

            for (const r of rows) {
                const rect = r.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (upEvent.clientY < midY) {
                    target = r;
                    insertBefore = true;
                    break;
                }
                target = r;
                insertBefore = false;
            }

            // Move the row in DOM
            if (target && target !== draggedRow) {
                if (insertBefore) {
                    speakersContainer.insertBefore(draggedRow, target);
                } else {
                    speakersContainer.insertBefore(draggedRow, target.nextSibling);
                }
            }

            // Cleanup
            draggedRow.classList.remove('dragging');
            rows.forEach(r => r.classList.remove('drag-over-above', 'drag-over-below'));
            if (dragPlaceholder && dragPlaceholder.parentNode) {
                dragPlaceholder.remove();
            }
            draggedRow = null;
            dragPlaceholder = null;

            // Persist new order
            scheduleAutoSave(0);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    btnAddSpeaker.addEventListener('click', () => { addSpeakerRow(); scheduleAutoSave(0); });

    btnImportExcel.addEventListener('click', async () => {
        try {
            const speakers = await pywebview.api.import_speakers_from_excel();
            if (speakers && speakers.length > 0) {
                renderSpeakers(speakers);
                btnImportExcel.textContent = `✅ ${speakers.length} ${I18N.t('feedback.imported')}`;
                setTimeout(() => { btnImportExcel.textContent = I18N.t('btn.importExcel'); }, 2000);
            }
        } catch (e) {
            console.error('Import failed:', e);
        }
    });

    btnGenerateTemplate.addEventListener('click', async () => {
        try {
            const success = await pywebview.api.generate_excel_template();
            if (success) {
                const originalText = btnGenerateTemplate.textContent;
                btnGenerateTemplate.textContent = `✅ ${I18N.getCurrentLang() === 'zh' ? '已生成' : 'Generated'}`;
                setTimeout(() => { btnGenerateTemplate.textContent = originalText; }, 2000);
            }
        } catch (e) {
            console.error('Template generation failed:', e);
        }
    });

    function linkActiveSpeaker(row) {
        // Unlink previous active
        if (activeSpeakerRow) activeSpeakerRow.classList.remove('active-speaker');

        // Clear any unlinked highlights ONLY if we are linking a new speaker
        if (row) {
            speakersContainer.querySelectorAll('.unlinked-highlight').forEach(el => el.classList.remove('unlinked-highlight'));
        }

        activeSpeakerRow = row;
        if (!row) return;
        row.classList.add('active-speaker');

        // Sync speaker row → main inputs on edit
        const nameInput = row.querySelector('.speaker-name');
        const timeInput = row.querySelector('.speaker-time');
        const wordsInput = row.querySelector('.speaker-words');

        nameInput.addEventListener('input', function onName() {
            if (activeSpeakerRow !== row) { nameInput.removeEventListener('input', onName); return; }
            inputSpeaker.value = nameInput.value;
        });
        timeInput.addEventListener('input', function onTime() {
            if (activeSpeakerRow !== row) { timeInput.removeEventListener('input', onTime); return; }
            const secs = parseTimeInput(timeInput.value);
            inputMinutes.value = Math.floor(secs / 60);
            inputSeconds.value = secs % 60;
        });
        wordsInput.addEventListener('input', function onWords() {
            if (activeSpeakerRow !== row) { wordsInput.removeEventListener('input', onWords); return; }
            inputQuote.value = wordsInput.value;
            try { pywebview.api.set_quote(wordsInput.value.trim()); } catch (e) { }
        });
    }

    // Sync Main Inputs -> Active Speaker Row
    function syncMainToRow() {
        if (!activeSpeakerRow) return;

        const name = inputSpeaker.value; // Don't trim while typing to allow spaces
        const mins = parseFloat(inputMinutes.value) || 0;
        const secs = parseFloat(inputSeconds.value) || 0;
        const totalSecs = Math.floor(mins * 60 + secs);
        const quote = inputQuote.value;

        // Update row DOM
        const nameInput = activeSpeakerRow.querySelector('.speaker-name');
        const timeInput = activeSpeakerRow.querySelector('.speaker-time');
        const wordsInput = activeSpeakerRow.querySelector('.speaker-words');

        if (nameInput.value !== name) nameInput.value = name;
        // Only update time if it changed significantly (avoid jitter)
        const currentRowSecs = parseTimeInput(timeInput.value);
        if (currentRowSecs !== totalSecs) {
            timeInput.value = secondsToMMSS(totalSecs);
        }
        if (wordsInput.value !== quote) wordsInput.value = quote;

        // Trigger auto-save
        scheduleAutoSave();
    }

    inputSpeaker.addEventListener('input', syncMainToRow);
    inputMinutes.addEventListener('input', syncMainToRow);
    inputSeconds.addEventListener('input', syncMainToRow);
    inputQuote.addEventListener('input', syncMainToRow);

    btnLoadNext.addEventListener('click', async () => {
        try {
            // Auto-finish current speaker if in DONE state
            if (currentPhase === 'thankyou' || currentPhase === 'collecting') {
                await pywebview.api.next_speaker();
                await refreshHistory();
            }
            const speaker = await pywebview.api.load_next_speaker();
            if (speaker && speaker.hasOwnProperty('time_secs')) {
                inputSpeaker.value = speaker.name || '';
                const totalSecs = speaker.time_secs || 0;
                inputMinutes.value = Math.floor(totalSecs / 60);
                inputSeconds.value = totalSecs % 60;
                inputQuote.value = speaker.words || '';
                try { await pywebview.api.set_quote(speaker.words || ''); } catch (e) { }

                // Link the matching speaker row by index
                const rows = speakersContainer.querySelectorAll('.speaker-row');
                rows.forEach(row => row.classList.remove('active-speaker'));
                const rowIndex = (speaker._index != null) ? speaker._index : null;
                const matchRow = (rowIndex != null && rowIndex < rows.length)
                    ? rows[rowIndex]
                    : [...rows].find(r => r.querySelector('.speaker-name').value.trim() === speaker.name);
                linkActiveSpeaker(matchRow || null);
            }
        } catch (e) {
            console.error('Load next speaker failed:', e);
        }
    });

    btnRestartList.addEventListener('click', async () => {
        try {
            await pywebview.api.reset_speaker_list();

            // Clear any unlinked highlights
            speakersContainer.querySelectorAll('.unlinked-highlight').forEach(el => el.classList.remove('unlinked-highlight'));

            // Load the first speaker and link to its row
            const speaker = await pywebview.api.load_next_speaker();
            if (speaker && speaker.hasOwnProperty('time_secs')) {
                inputSpeaker.value = speaker.name || '';
                const totalSecs = speaker.time_secs || 0;
                inputMinutes.value = Math.floor(totalSecs / 60);
                inputSeconds.value = totalSecs % 60;
                inputQuote.value = speaker.words || '';
                try { await pywebview.api.set_quote(speaker.words || ''); } catch (e) { }

                const rows = speakersContainer.querySelectorAll('.speaker-row');
                rows.forEach(row => row.classList.remove('active-speaker'));
                const rowIndex = (speaker._index != null) ? speaker._index : null;
                const matchRow = (rowIndex != null && rowIndex < rows.length)
                    ? rows[rowIndex]
                    : [...rows].find(r => r.querySelector('.speaker-name').value.trim() === speaker.name);
                linkActiveSpeaker(matchRow || null);
            } else {
                linkActiveSpeaker(null);
            }

            // feedback
            const originalText = btnRestartList.textContent;
            btnRestartList.textContent = I18N.t('feedback.restarted');
            setTimeout(() => { btnRestartList.textContent = originalText; }, 1000);
        } catch (e) {
            console.error('Restart list failed:', e);
        }
    });

    btnUnlink.addEventListener('click', () => {
        // Highlight the current row as "unlinked active" before unlinking
        if (activeSpeakerRow) {
            activeSpeakerRow.classList.add('unlinked-highlight');
        }
        linkActiveSpeaker(null);
        // feedback
        const originalText = btnUnlink.textContent;
        btnUnlink.textContent = I18N.t('feedback.unlinked');
        setTimeout(() => { btnUnlink.textContent = originalText; }, 1000);
    });

    // Handle language change events
    window.addEventListener('languageChanged', () => {
        document.querySelectorAll('.speaker-name').forEach(el => {
            el.placeholder = I18N.t('placeholder.topic');
            el.title = I18N.t('label.topic');
        });
        document.querySelectorAll('.speaker-time').forEach(el => {
            el.title = I18N.t('label.time');
        });
        document.querySelectorAll('.speaker-words').forEach(el => {
            el.placeholder = I18N.t('label.quote');
            el.title = I18N.t('label.quote');
        });
        pollState(); // refresh active translations in status bar / buttons
        if (typeof refreshLmQueue === 'function') refreshLmQueue();
        if (typeof pollLiveMode === 'function') pollLiveMode();
    });

    /* ═══════ LIVE MODE ═══════ */

    let isLiveMode = false;
    let lmPollTimer = null;

    // DOM refs for live mode
    const liveMode = document.getElementById('live-mode');
    const lmPhaseDot = document.getElementById('lm-phase-dot');
    const lmTopic = document.getElementById('lm-topic');
    const lmClock = document.getElementById('lm-clock');
    const lmBtnStart = document.getElementById('lm-btn-start');
    const lmBtnPause = document.getElementById('lm-btn-pause');
    const lmBtnStop = document.getElementById('lm-btn-stop');
    const lmBtnPrev = document.getElementById('lm-btn-prev');
    const lmBtnNext = document.getElementById('lm-btn-next');
    const lmBtnAddtime = document.getElementById('lm-btn-addtime');
    const lmAddtimeDropdown = document.getElementById('lm-addtime-dropdown');
    const lmBtnSubtime = document.getElementById('lm-btn-subtime');
    const lmSubtimeDropdown = document.getElementById('lm-subtime-dropdown');
    const lmBtnAlarm = document.getElementById('lm-btn-alarm');
    const lmBtnExit = document.getElementById('lm-btn-exit');
    const lmBtnExpand = document.getElementById('lm-btn-expand');
    const lmQueuePreview = document.getElementById('lm-queue-preview');
    const lmQueueExpanded = document.getElementById('lm-queue-expanded');
    const btnLiveMode = document.getElementById('btn-live-mode');

    let lmQueueIsExpanded = false;

    async function enterLiveMode() {
        isLiveMode = true;
        document.body.classList.add('live-mode-active');
        if (typeof pywebview !== 'undefined') {
            try { await pywebview.api.enter_live_mode(); } catch (e) { console.error('Enter live mode failed:', e); }
        }

        // Auto-load first speaker from list only if not already inside the list
        const hasSpeakers = speakersContainer.querySelectorAll('.speaker-row').length > 0;
        if (hasSpeakers && !activeSpeakerRow) {
            try {
                await doAutoSave();
                const speaker = await pywebview.api.load_next_speaker();
                if (speaker && speaker.hasOwnProperty('time_secs')) {
                    inputSpeaker.value = speaker.name || '';
                    const totalSecs = speaker.time_secs || 0;
                    inputMinutes.value = Math.floor(totalSecs / 60);
                    inputSeconds.value = totalSecs % 60;
                    inputQuote.value = speaker.words || '';
                    try { await pywebview.api.set_quote(speaker.words || ''); } catch (e) { }

                    // Link the matching speaker row
                    const rows = speakersContainer.querySelectorAll('.speaker-row');
                    rows.forEach(row => row.classList.remove('active-speaker'));
                    const rowIndex = (speaker._index != null) ? speaker._index : null;
                    const matchRow = (rowIndex != null && rowIndex < rows.length)
                        ? rows[rowIndex]
                        : [...rows].find(r => r.querySelector('.speaker-name').value.trim() === speaker.name);
                    linkActiveSpeaker(matchRow || null);
                }
            } catch (e) { console.error('Auto-load speaker on live mode entry failed:', e); }
        }

        // Start live mode polling
        lmPollTimer = setInterval(pollLiveMode, 200);
        pollLiveMode();
        refreshLmQueue();
    }

    async function exitLiveMode() {
        isLiveMode = false;
        document.body.classList.remove('live-mode-active');
        if (lmPollTimer) { clearInterval(lmPollTimer); lmPollTimer = null; }
        if (typeof pywebview !== 'undefined') {
            try { await pywebview.api.exit_live_mode(); } catch (e) { console.error('Exit live mode failed:', e); }
        }
    }

    // Switch button
    btnLiveMode.addEventListener('click', () => enterLiveMode());
    lmBtnExit.addEventListener('click', () => exitLiveMode());

    // Live mode state polling
    async function pollLiveMode() {
        if (!isLiveMode) return;
        try {
            const state = await pywebview.api.get_state();
            const phase = state.phase;

            // Phase dot
            lmPhaseDot.className = 'lm-dot ' + phase;

            // Topic — use the actual input value, not the backend state
            const topicText = inputSpeaker.value.trim() || state.speaker || '';
            lmTopic.textContent = topicText;

            // Clock
            if (phase === 'overtime' || (phase === 'paused' && state.overtime_seconds > 0)) {
                const otSecsAbs = Math.abs(state.overtime_seconds);
                const otMin = Math.floor(otSecsAbs / 60);
                const otSec = Math.floor(otSecsAbs % 60);
                const sign = state.overtime_seconds < 0 ? '-' : '+';
                lmClock.textContent = `${sign}${String(otMin).padStart(2, '0')}:${String(otSec).padStart(2, '0')}`;
                lmClock.classList.add('overtime-clock');
            } else if (phase === 'collecting' || phase === 'thankyou') {
                lmClock.textContent = '00:00';
                lmClock.classList.remove('overtime-clock');
            } else {
                lmClock.textContent = state.remaining_display;
                lmClock.classList.remove('overtime-clock');
            }

            // Overtime glow
            if (phase === 'overtime') {
                liveMode.classList.add('overtime-glow');
            } else {
                liveMode.classList.remove('overtime-glow');
            }

            // Transport buttons visibility
            const isIdle = phase === 'idle' || phase === 'thankyou';
            const isPaused = phase === 'paused';
            const isRunning = phase === 'countdown' || phase === 'warning' || phase === 'overtime';

            // Start: show when idle or paused
            if (isIdle || isPaused) {
                lmBtnStart.classList.remove('hidden');
                lmBtnPause.classList.add('hidden');
                lmBtnStart.textContent = isPaused ? I18N.t('btn.lmResume') : I18N.t('btn.lmStart');
                lmBtnStart.disabled = (phase === 'thankyou');
            } else {
                lmBtnStart.classList.add('hidden');
                lmBtnPause.classList.remove('hidden');
            }

            // Stop
            lmBtnStop.disabled = isIdle || phase === 'collecting';

            // Prev / Next: only when idle or done
            lmBtnPrev.disabled = !isIdle || state.list_index <= 1;
            lmBtnNext.disabled = !isIdle;

            // Add/subtract time: only when running/paused
            lmBtnAddtime.disabled = !(isRunning || isPaused);
            lmBtnSubtime.disabled = !(isRunning || isPaused);

            // Alarm state sync
            if (state.alarms_enabled !== undefined) {
                const targetIsMuted = !state.alarms_enabled;
                if (lmBtnAlarm.classList.contains('muted') !== targetIsMuted) {
                    lmBtnAlarm.textContent = state.alarms_enabled ? '🔔' : '🔇';
                    lmBtnAlarm.classList.toggle('muted', targetIsMuted);
                }
            }
        } catch (e) { /* pywebview not ready */ }
    }

    // Transport: Start
    lmBtnStart.addEventListener('click', async () => {
        try {
            const state = await pywebview.api.get_state();
            if (state.phase === 'paused') {
                await pywebview.api.resume_timer();
            } else {
                // Use current input values from the control panel
                const speaker = inputSpeaker.value.trim();
                const minutes = parseFloat(inputMinutes.value) || 0;
                const seconds = parseFloat(inputSeconds.value) || 0;
                if (minutes === 0 && seconds === 0) return;
                await pywebview.api.configure(speaker, minutes, seconds);
                await pywebview.api.start_timer();
            }
        } catch (e) { console.error('LM Start failed:', e); }
    });

    // Transport: Pause
    lmBtnPause.addEventListener('click', async () => {
        try { await pywebview.api.pause_timer(); } catch (e) { console.error('LM Pause failed:', e); }
    });

    // Transport: Stop
    lmBtnStop.addEventListener('click', async () => {
        try { await pywebview.api.stop_timer(); } catch (e) { console.error('LM Stop failed:', e); }
    });

    // Transport: Next
    lmBtnNext.addEventListener('click', async () => {
        try {
            await pywebview.api.next_speaker();
            const speaker = await pywebview.api.load_next_speaker();
            if (speaker && speaker.hasOwnProperty('time_secs')) {
                inputSpeaker.value = speaker.name || '';
                const totalSecs = speaker.time_secs || 0;
                inputMinutes.value = Math.floor(totalSecs / 60);
                inputSeconds.value = totalSecs % 60;
                inputQuote.value = speaker.words || '';
                try { await pywebview.api.set_quote(speaker.words || ''); } catch (e) { }

                const rows = speakersContainer.querySelectorAll('.speaker-row');
                rows.forEach(row => row.classList.remove('active-speaker'));
                const rowIndex = (speaker._index != null) ? speaker._index : null;
                const matchRow = (rowIndex != null && rowIndex < rows.length)
                    ? rows[rowIndex]
                    : [...rows].find(r => r.querySelector('.speaker-name').value.trim() === speaker.name);
                linkActiveSpeaker(matchRow || null);
            }
            refreshLmQueue();
        } catch (e) { console.error('LM Next failed:', e); }
    });

    // Transport: Prev
    lmBtnPrev.addEventListener('click', async () => {
        try {
            const state = await pywebview.api.get_state();
            // If running, stop first
            if (state.phase !== 'idle' && state.phase !== 'thankyou') {
                await pywebview.api.stop_timer();
                await pywebview.api.next_speaker();
            } else if (state.phase === 'thankyou') {
                // Clear the 'done' state so the next loaded speaker isn't stuck
                await pywebview.api.next_speaker();
            }
            const speaker = await pywebview.api.load_previous_speaker();
            if (speaker && speaker.hasOwnProperty('time_secs')) {
                inputSpeaker.value = speaker.name || '';
                const totalSecs = speaker.time_secs || 0;
                inputMinutes.value = Math.floor(totalSecs / 60);
                inputSeconds.value = totalSecs % 60;
                inputQuote.value = speaker.words || '';
                try { await pywebview.api.set_quote(speaker.words || ''); } catch (e) { }

                const rows = speakersContainer.querySelectorAll('.speaker-row');
                rows.forEach(row => row.classList.remove('active-speaker'));
                const rowIndex = (speaker._index != null) ? speaker._index : null;
                const matchRow = (rowIndex != null && rowIndex < rows.length)
                    ? rows[rowIndex]
                    : [...rows].find(r => r.querySelector('.speaker-name').value.trim() === speaker.name);
                linkActiveSpeaker(matchRow || null);
            }
            refreshLmQueue();
        } catch (e) { console.error('LM Prev failed:', e); }
    });

    // Add time dropdown
    lmBtnAddtime.addEventListener('click', (e) => {
        e.stopPropagation();
        lmAddtimeDropdown.classList.toggle('hidden');
        lmSubtimeDropdown.classList.add('hidden');
    });

    document.addEventListener('click', () => {
        lmAddtimeDropdown.classList.add('hidden');
        lmSubtimeDropdown.classList.add('hidden');
    });

    lmAddtimeDropdown.querySelectorAll('.lm-dd-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const secs = parseInt(item.getAttribute('data-secs')) || 0;
            try { await pywebview.api.add_time(secs); } catch (e2) { console.error('LM Add time failed:', e2); }
            lmAddtimeDropdown.classList.add('hidden');
        });
    });

    // Subtract time dropdown
    lmBtnSubtime.addEventListener('click', (e) => {
        e.stopPropagation();
        lmSubtimeDropdown.classList.toggle('hidden');
        lmAddtimeDropdown.classList.add('hidden');
    });

    lmSubtimeDropdown.querySelectorAll('.lm-dd-item[data-sub-secs]').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const secs = parseInt(item.getAttribute('data-sub-secs')) || 0;
            try { await pywebview.api.subtract_time(secs); } catch (e2) { console.error('LM Subtract time failed:', e2); }
            lmSubtimeDropdown.classList.add('hidden');
        });
    });

    // Alarm toggle
    lmBtnAlarm.addEventListener('click', async () => {
        try {
            const enabled = await pywebview.api.toggle_alarms_enabled();
            lmBtnAlarm.textContent = enabled ? '🔔' : '🔇';
            lmBtnAlarm.classList.toggle('muted', !enabled);
        } catch (e) { console.error('LM Alarm toggle failed:', e); }
    });

    // Queue expand/collapse
    lmBtnExpand.addEventListener('click', async () => {
        lmQueueIsExpanded = !lmQueueIsExpanded;
        lmBtnExpand.textContent = lmQueueIsExpanded ? '▴' : '▾';
        lmBtnExpand.setAttribute('data-i18n-title', lmQueueIsExpanded ? 'title.showLess' : 'title.showMore');
        lmBtnExpand.title = I18N.t(lmQueueIsExpanded ? 'title.showLess' : 'title.showMore');
        refreshLmQueue();
    });

    // Refresh up-next queue — all items in one list
    async function refreshLmQueue() {
        if (!isLiveMode) return;
        try {
            const upcoming = await pywebview.api.get_upcoming_speakers(20);
            lmQueuePreview.innerHTML = '';

            // Only show up to 3 items if collapsed. Show all if expanded.
            const displayCount = lmQueueIsExpanded ? upcoming.length : Math.min(3, upcoming.length);
            for (let i = 0; i < displayCount; i++) {
                lmQueuePreview.appendChild(buildQueueItem(upcoming[i], i));
            }
            if (upcoming.length === 0) {
                lmQueuePreview.innerHTML = `<span style="color:var(--text-muted);font-size:11px">${I18N.t('lm.noTopics')}</span>`;
            }
            // Show expand button if there are items
            lmBtnExpand.style.display = upcoming.length > 3 ? '' : 'none';
            // Resize window based on expanded state
            if (typeof pywebview !== 'undefined') {
                try {
                    if (lmQueueIsExpanded) {
                        const height = Math.min(600, 140 + upcoming.length * 22);
                        await pywebview.api.set_control_size(640, height);
                    } else {
                        await pywebview.api.set_control_size(640, 200);
                    }
                } catch (e) { }
            }
        } catch (e) { /* not ready */ }
    }

    function buildQueueItem(speaker, index) {
        const m = Math.floor((speaker.time_secs || 0) / 60);
        const sec = (speaker.time_secs || 0) % 60;
        const timeStr = `${m}:${String(sec).padStart(2, '0')}`;
        const el = document.createElement('div');
        el.className = 'lm-queue-item';
        let html = `<span class="lm-queue-item-idx">${index + 1}.</span>`;
        html += `<span class="lm-queue-item-name">${speaker.name || '—'}</span>`;
        html += `<span class="lm-queue-item-time">${timeStr}</span>`;
        if (speaker.words) {
            html += `<span class="lm-queue-item-quote">"${escapeHtml(speaker.words)}"</span>`;
        }
        el.innerHTML = html;
        return el;
    }

    // Drag support for live mode window (absolute position based)
    let lmDragging = false;
    let lmDragStartX = 0;
    let lmDragStartY = 0;
    let lmWinStartX = 0;
    let lmWinStartY = 0;

    liveMode.addEventListener('mousedown', async (e) => {
        // Don't drag if clicking a button or dropdown
        if (e.target.closest('.lm-btn') || e.target.closest('.lm-dropdown') || e.target.closest('.lm-dd-item')) return;
        lmDragStartX = e.screenX;
        lmDragStartY = e.screenY;
        try {
            const pos = await pywebview.api.get_control_position();
            lmWinStartX = pos.x;
            lmWinStartY = pos.y;
            lmDragging = true;
        } catch (err) { }
    });

    document.addEventListener('mousemove', (e) => {
        if (!lmDragging || !isLiveMode) return;
        const targetX = lmWinStartX + (e.screenX - lmDragStartX);
        const targetY = lmWinStartY + (e.screenY - lmDragStartY);
        try { pywebview.api.set_control_position(targetX, targetY); } catch (err) { }
    });

    document.addEventListener('mouseup', () => { lmDragging = false; });

})();

