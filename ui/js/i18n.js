/**
 * i18n.js — Shared internationalization module for meeting timer UI.
 * Handles English/Chinese switching and exposes a global translation engine.
 */

window.I18N = (function () {
    const TRANSLATIONS = {
        en: {
            // Status Bar
            'status.ready': 'READY',
            'status.counting': 'COUNTING',
            'status.warning': 'WARNING',
            'status.overtime': 'OVERTIME',
            'status.animation': 'ANIMATION',
            'status.done': 'DONE',
            'status.paused': 'PAUSED',
            'btn.config': 'Configuration ⚙️',

            // Control Panel
            'label.topic': 'Topic',
            'placeholder.topic': 'Topic Name',
            'label.defaultTopic': 'Topic',
            'label.time': 'Time',
            'label.rate': 'Rate',
            'label.addTime': 'Add Time (minutes)',
            'btn.addCustom': '+Custom',
            'btn.start': '▶ START',
            'btn.pause': '⏸ PAUSE',
            'btn.resume': '▶ RESUME',
            'btn.stop': '■ STOP',
            'btn.next': '⏭ NEXT',
            'label.quote': 'Quote (shown during animations)',
            'placeholder.quote': 'Enter a motivational quote...',
            'label.topicList': 'Topic List',
            'btn.addTopic': '+ Add Topic',
            'btn.importExcel': '📂 Import Excel',
            'btn.loadNext': '⏭ Load Next',
            'btn.unlink': '🔓 Unlink',
            'btn.restart': '⟲ Restart',
            'label.history': 'History',
            'btn.export': '📥 Export',

            // Branding
            'label.madeBy': 'Made by',
            'label.copyright': '© 2026 Northern Africa IT Business Service Dept. All Rights Reserved.',

            // Interaction Feedback
            'feedback.restarted': 'Restarted!',
            'feedback.unlinked': 'Unlinked',
            'feedback.imported': 'imported',

            // Config Window
            'label.costTiers': 'Cost Tiers',
            'btn.addTier': '+ Add Tier',
            'label.maxCost': 'Max ￥',
            'label.appearance': 'Appearance',
            'label.background': '🖼️ Background',
            'btn.changeImage': 'Change Image',
            'label.font': '🔤 Font',
            'label.presets': 'Presets',
            'label.idle': 'Idle',
            'label.countdown': 'Countdown',
            'label.warning': 'Warning',
            'label.overtime': 'Overtime',
            'label.thankyou': 'Thank You',
            'label.cost': 'Cost',
            'label.alarmConfig': 'Alarm Config',
            'label.enableSounds': 'Enable Sounds',
            'label.alarm': 'Alarm',
            'label.play': 'Play:',
            'placeholder.searchFonts': 'Search fonts...',
            'feedback.imageChanged': '✅ Changed',
            'feedback.noFonts': 'No fonts found',

            // Tier row labels
            'tier.after': 'After',
            'tier.minArrow': 'min →',
            'tier.secUnit': 's',
            'tier.secOption': 'Sec',
            'tier.minOption': 'Min',

            // Alarm labels & units
            'alarm.1': 'Alarm 1:',
            'alarm.2': 'Alarm 2:',
            'alarm.3': 'Alarm 3:',
            'unit.min': 'min',
            'unit.sec': 'sec',
            'unit.rep': 'rep',

            // Preset names
            'preset.classic': '🔥 Classic',
            'preset.ocean': '🌊 Ocean',
            'preset.neon': '💜 Neon',
            'preset.forest': '🌿 Forest',
            'preset.brightLuxury': '✨ Bright Luxury'
        },
        zh: {
            // Status Bar
            'status.ready': '就绪',
            'status.counting': '倒计时',
            'status.warning': '警告',
            'status.overtime': '超时',
            'status.animation': '动画',
            'status.done': '完成',
            'status.paused': '暂停',
            'btn.config': '配置 ⚙️',

            // Control Panel
            'label.topic': '议题',
            'placeholder.topic': '议题名称',
            'label.defaultTopic': '议题',
            'label.time': '时间',
            'label.rate': '费率',
            'label.addTime': '加时 (分钟)',
            'btn.addCustom': '+自定义',
            'btn.start': '▶ 开始',
            'btn.pause': '⏸ 暂停',
            'btn.resume': '▶ 继续',
            'btn.stop': '■ 停止',
            'btn.next': '⏭ 下一个',
            'label.quote': '动态标语 (动画时显示)',
            'placeholder.quote': '输入一句激励语...',
            'label.topicList': '议题列表',
            'btn.addTopic': '+ 添加议题',
            'btn.importExcel': '📂 导入 Excel',
            'btn.loadNext': '⏭ 加载下一项',
            'btn.unlink': '🔓 取消关联',
            'btn.restart': '⟲ 重新开始',
            'label.history': '记录',
            'btn.export': '📥 导出',

            // Branding
            'label.madeBy': '出品',
            'label.copyright': '© 2026 北部非洲IT业务服务部 版权所有',

            // Interaction Feedback
            'feedback.restarted': '已重置!',
            'feedback.unlinked': '已取消关联',
            'feedback.imported': '条已导入',

            // Config Window
            'label.costTiers': '费用阶梯',
            'btn.addTier': '+ 添加阶梯',
            'label.maxCost': '最高 ￥',
            'label.appearance': '外观',
            'label.background': '🖼️ 背景',
            'btn.changeImage': '更换图片',
            'label.font': '🔤 字体',
            'label.presets': '预设',
            'label.idle': '空闲',
            'label.countdown': '倒计时',
            'label.warning': '警告',
            'label.overtime': '超时',
            'label.thankyou': '完成 / 感谢',
            'label.cost': '费用',
            'label.alarmConfig': '提醒配置',
            'label.enableSounds': '启用声音',
            'label.alarm': '提醒',
            'label.play': '播放:',
            'placeholder.searchFonts': '搜索字体...',
            'feedback.imageChanged': '✅ 已更换',
            'feedback.noFonts': '未找到字体',

            // Tier row labels
            'tier.after': '超过',
            'tier.minArrow': '分 →',
            'tier.secUnit': '秒',
            'tier.secOption': '秒',
            'tier.minOption': '分',

            // Alarm labels & units
            'alarm.1': '提醒 1:',
            'alarm.2': '提醒 2:',
            'alarm.3': '提醒 3:',
            'unit.min': '分',
            'unit.sec': '秒',
            'unit.rep': '循环',

            // Preset names
            'preset.classic': '🔥 经典',
            'preset.ocean': '🌊 海洋',
            'preset.neon': '💜 霓虹',
            'preset.forest': '🌿 森林',
            'preset.brightLuxury': '✨ 明亮奢华'
        }
    };

    let currentLang = 'en';

    function t(key) {
        if (!TRANSLATIONS[currentLang] || !TRANSLATIONS[currentLang][key]) {
            console.warn(`[i18n] Missing translation for key: ${key}`);
            return key; // fallback to key itself
        }
        return TRANSLATIONS[currentLang][key];
    }

    function applyTranslations() {
        // Translatable Text Content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });

        // Translatable Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.setAttribute('placeholder', t(key));
        });

        // Translatable Titles (Tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.setAttribute('title', t(key));
        });

        // Trigger an event so custom components can update
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
    }

    async function toggleLanguage() {
        const newLang = currentLang === 'en' ? 'zh' : 'en';
        await setLanguage(newLang);
    }

    async function setLanguage(lang) {
        if (lang !== 'en' && lang !== 'zh') return;
        currentLang = lang;
        applyTranslations();
        updateToggleButton();
        try {
            if (window.pywebview) {
                await pywebview.api.set_language(lang);
            }
        } catch (e) {
            console.error('[i18n] Failed to save language state to backend', e);
        }
    }

    function updateToggleButton() {
        const btns = document.querySelectorAll('.btn-lang-toggle');
        btns.forEach(btn => {
            btn.textContent = currentLang === 'en' ? '中' : 'EN';
            btn.title = currentLang === 'en' ? '切换到中文' : 'Switch to English';
        });
    }

    async function init() {
        try {
            if (window.pywebview) {
                const lang = await pywebview.api.get_language();
                if (lang) currentLang = lang;
            }
        } catch (e) {
            console.error('[i18n] pywebview not ready, defaulting to EN');
        }
        applyTranslations();
        updateToggleButton();
    }

    // Attempt init on load if pywebview is ready, otherwise wait for event
    if (window.pywebview) {
        init();
    } else {
        window.addEventListener('pywebviewready', init);
    }

    return {
        t,
        setLanguage,
        toggleLanguage,
        getCurrentLang: () => currentLang,
        applyTranslations
    };
})();
