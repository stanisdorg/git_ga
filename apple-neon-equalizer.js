/**
 * Apple Neon Equalizer - для интеграции в основной сайт
 * Стиль: Apple Neon с первыми 4 видимыми столбиками
 */

(function() {
    // Конфигурация
    const config = {
        bars: 18,
        colors: ['#ff2d55', '#ff6b7a'],
        opacity: 1.0,
        glow: true,
        barWidth: 4,
        barGap: 2
    };

    let analyser = null;
    let audioContext = null;
    let microphone = null;
    let frequencyData = null;
    let isRecording = false;
    let animationId = null;
    let equalizerBars = [];

    // Создание эквалайзера
    function createEqualizer(container) {
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.alignItems = 'flex-end';
        container.style.gap = config.barGap + 'px';
        container.style.padding = '0 4px';
        container.style.height = '100%';
        container.style.width = '100px';

        equalizerBars = [];
        for (let i = config.bars - 1; i >= 0; i--) {
            const bar = document.createElement('div');
            bar.style.width = config.barWidth + 'px';
            bar.style.height = '3px';
            bar.style.background = 'linear-gradient(to top, #ff2d55, #ff6b7a)';
            bar.style.borderRadius = '4px';
            bar.style.transition = 'height 0.08s ease, opacity 0.08s ease';
            bar.style.minHeight = '3px';
            container.appendChild(bar);
            equalizerBars.push(bar);
        }
    }

    // Обновление эквалайзера
    function updateEqualizer() {
        if (!analyser || equalizerBars.length === 0) return;

        analyser.getByteFrequencyData(frequencyData);
        const step = Math.floor(frequencyData.length / equalizerBars.length);

        for (let i = 0; i < equalizerBars.length; i++) {
            const reversedIndex = equalizerBars.length - 1 - i;
            let value = frequencyData[reversedIndex * step];

            // Первые 4 столбика видимые, но слабые (для неона)
            let frequencyMultiplier;
            if (i < 4) {
                frequencyMultiplier = 0.3;
            } else if (i < 8) {
                frequencyMultiplier = 1 + (i / equalizerBars.length) * 0.8;
            } else if (i >= equalizerBars.length - 4 && i < equalizerBars.length - 2) {
                frequencyMultiplier = (1 + (i / equalizerBars.length) * 4.5) * 2.0;
            } else if (i >= equalizerBars.length - 2) {
                frequencyMultiplier = (1 + (i / equalizerBars.length) * 4.5) * 0.5;
            } else {
                frequencyMultiplier = 1 + (i / equalizerBars.length) * 4.5;
            }
            value = Math.min(255, value * frequencyMultiplier);

            const height = 3 + (value / 255) * 32;
            const baseOpacity = config.opacity;
            const opacity = baseOpacity - (height / 35) * (baseOpacity * 0.5);

            equalizerBars[i].style.height = height + 'px';
            equalizerBars[i].style.opacity = Math.max(baseOpacity * 0.5, opacity) + '';
            equalizerBars[i].style.boxShadow = '0 0 8px ' + config.colors[0];
        }

        if (isRecording) {
            animationId = requestAnimationFrame(updateEqualizer);
        }
    }

    // Старт записи
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: true
                }
            });

            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.65;

            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            frequencyData = new Uint8Array(bufferLength);

            isRecording = true;
            updateEqualizer();
        } catch (err) {
            console.error('Ошибка микрофона:', err);
        }
    }

    // Стоп записи
    function stopRecording() {
        isRecording = false;
        if (animationId) cancelAnimationFrame(animationId);
        if (microphone) microphone.disconnect();
        if (audioContext) audioContext.close();
        audioContext = null;
        analyser = null;
        microphone = null;
        frequencyData = null;

        equalizerBars.forEach(bar => {
            bar.style.height = '3px';
            bar.style.opacity = '1';
            bar.style.boxShadow = 'none';
        });
    }

    // Экспорт функций
    window.AppleNeonEqualizer = {
        create: createEqualizer,
        start: startRecording,
        stop: stopRecording,
        isRecording: () => isRecording
    };

    console.log('[Apple Neon Equalizer] Готов к использованию');
})();
