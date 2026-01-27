// Hook mic button to Electron STT when available
(function() {
    if (!window.sttBridge) return;
    const micBtn = document.getElementById('mic-button');
    const transcriptionHistory = document.getElementById('transcription-history');
    let mediaStream = null;
    let audioCtx = null;
    let source = null;
    let processor = null;

    async function start() {
        if (micBtn.classList.contains('listening')) return;
        window.sttBridge.start({ model: 'base', device: 'metal', computeType: 'float16' });
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        source = audioCtx.createMediaStreamSource(mediaStream);
        processor = audioCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioCtx.destination);
        processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const buf = new Float32Array(input);
            window.sttBridge.sendAudioChunk(Array.from(buf));
        };
        micBtn.classList.add('listening');
    }

    function stop() {
        if (processor) { processor.disconnect(); processor.onaudioprocess = null; }
        if (source) source.disconnect();
        if (audioCtx) audioCtx.close();
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        window.sttBridge.stop();
        micBtn.classList.remove('listening');
    }

    micBtn?.addEventListener('click', () => {
        if (micBtn.classList.contains('listening')) stop(); else start();
    });

    window.sttBridge.onPartial((data) => {
        if (!data || typeof data.text !== 'string') return;
        // Use existing render logic by updating interim tail
        const ev = new CustomEvent('electron-stt-partial', { detail: data.text });
        window.dispatchEvent(ev);
    });
    window.sttBridge.onFinal((data) => {
        if (!data || typeof data.text !== 'string') return;
        const ev = new CustomEvent('electron-stt-final', { detail: data.text });
        window.dispatchEvent(ev);
    });
})();


