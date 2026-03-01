/**
 * config_panel.js — Config window logic:
 *   Tier config, alarm config, appearance/colors/fonts, auto-save.
 */
(function () {
    'use strict';

    /* ═══════ DOM REFS ═══════ */

    const tiersContainer = document.getElementById('tiers-container');
    const btnAddTier = document.getElementById('btn-add-tier');
    const inputMaxCost = document.getElementById('input-max-cost');

    const inputAlarm1 = document.getElementById('input-alarm-1');
    const inputAlarm2 = document.getElementById('input-alarm-2');
    const inputAlarm3 = document.getElementById('input-alarm-3');
    const inputDuration1 = document.getElementById('input-duration-1');
    const inputDuration2 = document.getElementById('input-duration-2');
    const inputDuration3 = document.getElementById('input-duration-3');
    const btnSound1 = document.getElementById('btn-sound-1');
    const btnSound2 = document.getElementById('btn-sound-2');
    const btnSound3 = document.getElementById('btn-sound-3');
    const btnPlay1 = document.getElementById('btn-play-1');
    const btnPlay2 = document.getElementById('btn-play-2');
    const btnPlay3 = document.getElementById('btn-play-3');
    const inputAlarmEnabled = document.getElementById('alarm-enabled');

    // Appearance
    const btnBgImage = document.getElementById('btn-bg-image');
    const bgPreview = document.getElementById('bg-preview');
    const customFontSelect = document.getElementById('custom-font-select');
    const customFontValue = document.getElementById('custom-font-value');
    const customFontDropdown = document.getElementById('custom-font-dropdown');
    const customFontOptions = document.getElementById('custom-font-options');
    const fontSearch = document.getElementById('font-search');
    const fontPreview = document.getElementById('font-preview');
    const colorInputs = {
        idle: document.getElementById('input-color-idle'),
        countdown: document.getElementById('input-color-countdown'),
        warning: document.getElementById('input-color-warning'),
        overtime: document.getElementById('input-color-overtime'),
        thankyou: document.getElementById('input-color-thankyou'),
        cost: document.getElementById('input-color-cost'),
        quote: document.getElementById('input-color-quote'),
    };

    /* ═══════ FONT STATE & HELPERS ═══════ */

    let allFonts = [];

    function fuzzyMatch(query, text) {
        const q = query.toLowerCase();
        const t = text.toLowerCase();
        if (t.includes(q)) return 1000 - t.indexOf(q);
        let qi = 0, score = 0, consecutive = 0;
        for (let ti = 0; ti < t.length && qi < q.length; ti++) {
            if (t[ti] === q[qi]) {
                qi++;
                consecutive++;
                score += consecutive * 2 + (ti < 3 ? 5 : 0);
            } else {
                consecutive = 0;
            }
        }
        return qi === q.length ? score : 0;
    }

    function renderFontOptions(fonts) {
        customFontOptions.innerHTML = '';
        if (fonts.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'font-no-results';
            msg.textContent = 'No fonts found';
            customFontOptions.appendChild(msg);
            return;
        }
        fonts.forEach(f => {
            const opt = document.createElement('div');
            opt.className = 'custom-option';
            opt.dataset.value = f;
            opt.textContent = f;
            opt.style.fontFamily = `'${f}', monospace`;
            customFontOptions.appendChild(opt);
        });
    }

    /* ═══════ INIT ═══════ */

    window.addEventListener('pywebviewready', () => {
        loadConfig();
    });

    async function loadConfig() {
        try {
            const cfg = await pywebview.api.get_config();
            renderTiers(cfg.tiers || []);
            inputMaxCost.value = cfg.max_cost || 2500;
            inputAlarm1.value = (cfg.alarm_threshold_1 ?? 300) / 60;
            inputAlarm2.value = (cfg.alarm_threshold_2 ?? 60) / 60;
            inputAlarm3.value = (cfg.alarm_3_interval ?? 60) / 60;

            const sounds = cfg.alarm_sounds || {};
            const durs = cfg.alarm_durations || {};

            btnSound1.textContent = '🎵 ' + (sounds['1'] || '1.wav');
            btnSound2.textContent = '🎵 ' + (sounds['2'] || '2.wav');
            btnSound3.textContent = '🎵 ' + (sounds['3'] || '3.wav');
            btnSound1.dataset.sound = sounds['1'] || '1.wav';
            btnSound2.dataset.sound = sounds['2'] || '2.wav';
            btnSound3.dataset.sound = sounds['3'] || '3.wav';

            inputDuration1.value = durs['1'] ?? 0;
            inputDuration2.value = durs['2'] ?? 0;
            inputDuration3.value = durs['3'] ?? 0;

            inputAlarmEnabled.checked = cfg.alarms_enabled !== false;

            // Populate font dropdown from system fonts
            try {
                allFonts = await pywebview.api.get_system_fonts();
                renderFontOptions(allFonts);
            } catch (fontErr) {
                console.error('Failed to load system fonts:', fontErr);
            }

            loadAppearance(cfg.appearance || {});
        } catch (e) {
            renderTiers([{ threshold_mins: 0, rate_amount: 5, rate_interval: 5, unit: 'sec' }]);
        }
    }

    /* ═══════ TIER CONFIG UI ═══════ */

    function renderTiers(tiers) {
        tiersContainer.innerHTML = '';
        tiers.forEach((t, i) => addTierRow(t, i));
    }

    function addTierRow(tier = { threshold_mins: 0, rate_amount: 5, rate_interval: 5, unit: 'sec' }, index = -1) {
        const row = document.createElement('div');
        row.className = 'tier-row';
        const isMin = tier.unit === 'min';

        row.innerHTML = `
      <span class="tier-label">After</span>
      <input type="number" class="narrow tier-threshold" min="0" max="999" step="any" value="${tier.threshold_mins}" title="Overtime minutes threshold">
      <span class="tier-label">min →</span>
      <span class="tier-label">￥</span>
      <input type="number" class="narrow tier-rate" min="0" max="9999" step="any" value="${tier.rate_amount}" title="Amount per unit">
      <span class="tier-label">/</span>
      <select class="narrow tier-unit" title="Billing Unit" style="width: 50px;">
        <option value="sec" ${!isMin ? 'selected' : ''}>Sec</option>
        <option value="min" ${isMin ? 'selected' : ''}>Min</option>
      </select>
      <span class="interval-group ${isMin ? 'hidden' : ''}" style="display: inline-flex; align-items: center;">
        <input type="number" class="narrow tier-interval" min="1" max="120" value="${tier.rate_interval}" title="Seconds per tick" style="margin-left: 4px;">
        <span class="tier-label">s</span>
      </span>
      <button class="btn-remove-tier" title="Remove tier">✕</button>
    `;

        const unitSelect = row.querySelector('.tier-unit');
        const intervalGroup = row.querySelector('.interval-group');

        unitSelect.addEventListener('change', (e) => {
            if (e.target.value === 'min') {
                intervalGroup.classList.add('hidden');
            } else {
                intervalGroup.classList.remove('hidden');
            }
        });

        row.querySelector('.btn-remove-tier').addEventListener('click', () => {
            row.remove();
            scheduleAutoSave(0);
        });
        tiersContainer.appendChild(row);
    }

    btnAddTier.addEventListener('click', () => {
        const existing = tiersContainer.querySelectorAll('.tier-threshold');
        let maxThreshold = 0;
        existing.forEach(el => {
            const v = parseFloat(el.value) || 0;
            if (v > maxThreshold) maxThreshold = v;
        });
        addTierRow({ threshold_mins: maxThreshold + 5, rate_amount: 10, rate_interval: 5, unit: 'sec' });
        scheduleAutoSave(0);
    });

    /* ═══════ AUTO-SAVE CONFIG ═══════ */

    let _saveTimer = null;
    function scheduleAutoSave(delay = 600) {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(doAutoSave, delay);
    }

    async function doAutoSave() {
        const tiers = [];
        tiersContainer.querySelectorAll('.tier-row').forEach(row => {
            tiers.push({
                threshold_mins: parseFloat(row.querySelector('.tier-threshold').value) || 0,
                rate_amount: parseFloat(row.querySelector('.tier-rate').value) || 5,
                rate_interval: parseInt(row.querySelector('.tier-interval').value) || 5,
                unit: row.querySelector('.tier-unit').value,
            });
        });

        const maxCost = parseFloat(inputMaxCost.value) || 2500;
        const val1 = parseFloat(inputAlarm1.value);
        const alarm1 = (isNaN(val1) ? 5 : val1) * 60;
        const val2 = parseFloat(inputAlarm2.value);
        const alarm2 = (isNaN(val2) ? 0 : val2) * 60;
        const val3 = parseFloat(inputAlarm3.value);
        const alarm3Interval = (isNaN(val3) ? 1 : val3) * 60;
        const alarmsEnabled = inputAlarmEnabled.checked;

        const alarmSounds = {
            "1": btnSound1.dataset.sound || '1.wav',
            "2": btnSound2.dataset.sound || '2.wav',
            "3": btnSound3.dataset.sound || '3.wav'
        };
        const alarmDurations = {
            "1": parseFloat(inputDuration1.value) || 0,
            "2": parseFloat(inputDuration2.value) || 0,
            "3": parseFloat(inputDuration3.value) || 0
        };

        try {
            await pywebview.api.save_config(tiers, maxCost, alarm1, alarm2, alarmsEnabled, alarm3Interval, alarmSounds, alarmDurations);
        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    }

    // Auto-save on any config input change
    inputMaxCost.addEventListener('input', () => scheduleAutoSave());
    inputAlarm1.addEventListener('input', () => scheduleAutoSave());
    inputAlarm2.addEventListener('input', () => scheduleAutoSave());
    inputAlarm3.addEventListener('input', () => scheduleAutoSave());
    inputDuration1.addEventListener('input', () => scheduleAutoSave());
    inputDuration2.addEventListener('input', () => scheduleAutoSave());
    inputDuration3.addEventListener('input', () => scheduleAutoSave());
    inputAlarmEnabled.addEventListener('change', () => scheduleAutoSave(0));

    // Watch tier changes via event delegation
    tiersContainer.addEventListener('input', () => scheduleAutoSave());
    tiersContainer.addEventListener('change', () => scheduleAutoSave());

    /* ═══════ SOUND PICKER ═══════ */

    async function selectSound(btnId) {
        const btn = document.getElementById(btnId);
        try {
            const filename = await pywebview.api.select_sound_file();
            if (filename) {
                btn.textContent = '🎵 ' + "..." + filename.slice(-7);
                btn.dataset.sound = filename;
                scheduleAutoSave(0);
            }
        } catch (e) {
            console.error('Sound selection failed:', e);
        }
    }
    btnSound1.addEventListener('click', () => selectSound('btn-sound-1'));
    btnSound2.addEventListener('click', () => selectSound('btn-sound-2'));
    btnSound3.addEventListener('click', () => selectSound('btn-sound-3'));

    // Sound preview
    btnPlay1.addEventListener('click', async () => {
        const sound = btnSound1.dataset.sound || '1.wav';
        const dur = parseFloat(inputDuration1.value) || 0;
        await pywebview.api.play_sound_preview(sound, dur);
    });
    btnPlay2.addEventListener('click', async () => {
        const sound = btnSound2.dataset.sound || '2.wav';
        const dur = parseFloat(inputDuration2.value) || 0;
        await pywebview.api.play_sound_preview(sound, dur);
    });
    btnPlay3.addEventListener('click', async () => {
        const sound = btnSound3.dataset.sound || '3.wav';
        const dur = parseFloat(inputDuration3.value) || 0;
        await pywebview.api.play_sound_preview(sound, dur);
    });

    // Validation: alarm2 must be strictly less than alarm1
    function clampAlarm2() {
        const a1 = parseFloat(inputAlarm1.value) || 0;
        const a2 = parseFloat(inputAlarm2.value) || 0;
        inputAlarm2.max = Math.max(0, a1 - 1);
        if (a2 >= a1 && a1 > 0) {
            inputAlarm2.value = Math.max(0, a1 - 1);
        }
    }
    inputAlarm1.addEventListener('input', () => { clampAlarm2(); scheduleAutoSave(); });
    inputAlarm2.addEventListener('input', () => { clampAlarm2(); scheduleAutoSave(); });

    /* ═══════ APPEARANCE CONFIG ═══════ */

    const PRESETS = {
        classic: {
            color_idle: '#ffffff',
            color_countdown: '#2dd4bf',
            color_warning: '#fbbf24',
            color_overtime: '#ef4444',
            color_thankyou: '#f1c40f',
            color_cost: '#ff7979',
            color_quote: '#f1c40f',
        },
        ocean: {
            color_idle: '#a5f3fc',
            color_countdown: '#38bdf8',
            color_warning: '#fbbf24',
            color_overtime: '#f97316',
            color_thankyou: '#67e8f9',
            color_cost: '#fb923c',
            color_quote: '#67e8f9',
        },
        neon: {
            color_idle: '#e0e7ff',
            color_countdown: '#a78bfa',
            color_warning: '#f472b6',
            color_overtime: '#fb7185',
            color_thankyou: '#c084fc',
            color_cost: '#fb7185',
            color_quote: '#c084fc',
        },
        forest: {
            color_idle: '#dcfce7',
            color_countdown: '#4ade80',
            color_warning: '#facc15',
            color_overtime: '#f87171',
            color_thankyou: '#86efac',
            color_cost: '#fca5a5',
            color_quote: '#86efac',
        },
        bright_luxury: {
            color_idle: '#ffffff',
            color_countdown: '#00a2ff',
            color_warning: '#fbe018',
            color_overtime: '#c23b3b',
            color_thankyou: '#f1c40f',
            color_cost: '#ff7979',
            color_quote: '#f1c40f',
        },
    };

    function loadAppearance(app) {
        if (app.color_idle) colorInputs.idle.value = app.color_idle;
        if (app.color_countdown) colorInputs.countdown.value = app.color_countdown;
        if (app.color_warning) colorInputs.warning.value = app.color_warning;
        if (app.color_overtime) colorInputs.overtime.value = app.color_overtime;
        if (app.color_thankyou) colorInputs.thankyou.value = app.color_thankyou;
        if (app.color_cost) colorInputs.cost.value = app.color_cost;
        if (app.color_quote) colorInputs.quote.value = app.color_quote;
        if (app.background_image) {
            bgPreview.style.backgroundImage = `url('../image/${app.background_image}')`;
        }
        if (app.font_family) {
            customFontValue.textContent = app.font_family;
            customFontValue.dataset.value = app.font_family;
            fontPreview.style.fontFamily = `'${app.font_family}', monospace`;
            fontPreview.textContent = `00:00 — AaBbCc 你好`;
        }
        highlightActivePreset();
    }

    function collectAppearance() {
        return {
            color_idle: colorInputs.idle.value,
            color_countdown: colorInputs.countdown.value,
            color_warning: colorInputs.warning.value,
            color_overtime: colorInputs.overtime.value,
            color_thankyou: colorInputs.thankyou.value,
            color_cost: colorInputs.cost.value,
            color_quote: colorInputs.quote.value,
            font_family: customFontValue.dataset.value || 'JetBrains Mono',
        };
    }

    async function saveAppearance() {
        try {
            await pywebview.api.set_appearance(collectAppearance());
        } catch (e) {
            console.error('Save appearance failed:', e);
        }
        highlightActivePreset();
    }

    // Auto-save on any color change
    Object.values(colorInputs).forEach(input => {
        input.addEventListener('input', saveAppearance);
    });

    /* ═══════ FUZZY FONT SEARCH ═══════ */

    fontSearch.addEventListener('input', () => {
        const q = fontSearch.value.trim();
        if (!q) {
            renderFontOptions(allFonts);
            return;
        }
        const scored = allFonts
            .map(f => ({ name: f, score: fuzzyMatch(q, f) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.name);
        renderFontOptions(scored);
    });

    fontSearch.addEventListener('click', (e) => e.stopPropagation());
    fontSearch.addEventListener('mousedown', (e) => e.stopPropagation());

    customFontSelect.addEventListener('click', (e) => {
        if (fontSearch.contains(e.target)) return;
        const isOpen = !customFontDropdown.classList.contains('hidden');
        customFontDropdown.classList.toggle('hidden', !!isOpen);
        customFontSelect.classList.toggle('open', !isOpen);
        if (!isOpen) {
            fontSearch.value = '';
            renderFontOptions(allFonts);
            setTimeout(() => fontSearch.focus(), 50);
        }
    });

    customFontOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-option');
        if (!option) return;
        const val = option.dataset.value;
        customFontValue.textContent = val;
        customFontValue.dataset.value = val;
        fontPreview.style.fontFamily = `'${val}', monospace`;
        customFontDropdown.classList.add('hidden');
        customFontSelect.classList.remove('open');
        saveAppearance();
    });

    document.addEventListener('click', (e) => {
        if (!customFontSelect.contains(e.target)) {
            customFontDropdown.classList.add('hidden');
            customFontSelect.classList.remove('open');
        }
    });

    // Background image button
    btnBgImage.addEventListener('click', async () => {
        try {
            const filename = await pywebview.api.set_background_image();
            if (filename) {
                bgPreview.style.backgroundImage = `url('../image/${filename}')`;
                btnBgImage.textContent = '✅ Changed';
                setTimeout(() => { btnBgImage.textContent = 'Change Image'; }, 1500);
            }
        } catch (e) {
            console.error('Background image picker failed:', e);
        }
    });

    // Preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = PRESETS[btn.dataset.preset];
            if (!preset) return;
            colorInputs.idle.value = preset.color_idle;
            colorInputs.countdown.value = preset.color_countdown;
            colorInputs.warning.value = preset.color_warning;
            colorInputs.overtime.value = preset.color_overtime;
            colorInputs.thankyou.value = preset.color_thankyou;
            colorInputs.cost.value = preset.color_cost;
            colorInputs.quote.value = preset.color_quote;
            saveAppearance();
        });
    });

    function highlightActivePreset() {
        const current = collectAppearance();
        document.querySelectorAll('.btn-preset').forEach(btn => {
            const preset = PRESETS[btn.dataset.preset];
            if (!preset) return;
            const match = Object.keys(preset).every(k => preset[k] === current[k]);
            btn.classList.toggle('active-preset', match);
        });
    }
})();
