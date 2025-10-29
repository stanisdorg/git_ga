#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Streaming worker for faster-whisper (Mac M1 friendly).
Protocol (stdin JSONL):
  {"type":"config", "config": {"model":"base", "device":"metal", "computeType":"float16"}}
  {"type":"audio_chunk", "payload": [Float32,...] }  # 16kHz mono
  {"type":"stop"}

Outputs (stdout JSONL):
  {"event":"ready",   "data": {"status":"ok"}}
  {"event":"partial", "data": {"text":"..."}}
  {"event":"final",   "data": {"text":"..."}}
"""

import sys
import json
import numpy as np
from threading import Event

try:
    from faster_whisper import WhisperModel
except Exception as exc:
    WhisperModel = None

def send(event, payload):
    sys.stdout.write(json.dumps({"event": event, "data": payload}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def main():
    send("ready", {"status": "ok"})
    model = None
    stop_event = Event()
    sample_buffer = np.zeros(0, dtype=np.float32)

    # window ~0.75s @16kHz
    SAMPLE_RATE = 16000
    WINDOW_S = 0.75
    HOP_S = 0.35
    WINDOW_SAMPLES = int(SAMPLE_RATE * WINDOW_S)
    HOP_SAMPLES = int(SAMPLE_RATE * HOP_S)

    while not stop_event.is_set():
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        t = msg.get("type")
        if t == "config":
            cfg = msg.get("config", {})
            model_size = cfg.get("model", "base")
            device = cfg.get("device", "metal")
            compute_type = cfg.get("computeType", "float16")
            try:
                if WhisperModel is None:
                    raise RuntimeError("faster-whisper not installed")
                model = WhisperModel(model_size, device=device, compute_type=compute_type)
                send("partial", {"text": "[stt ready]"})
            except Exception as e:
                send("partial", {"text": f"[stt init error: {e}]"})
        elif t == "audio_chunk":
            if model is None:
                continue
            payload = msg.get("payload", [])
            if not payload:
                continue
            try:
                chunk = np.array(payload, dtype=np.float32)
            except Exception:
                continue
            # clip to [-1,1]
            np.clip(chunk, -1.0, 1.0, out=chunk)
            sample_buffer = np.concatenate([sample_buffer, chunk])
            # process when enough samples collected
            if sample_buffer.size >= WINDOW_SAMPLES:
                window = sample_buffer[:WINDOW_SAMPLES]
                # keep overlap
                if sample_buffer.size > HOP_SAMPLES:
                    sample_buffer = sample_buffer[HOP_SAMPLES:]
                else:
                    sample_buffer = np.zeros(0, dtype=np.float32)
                try:
                    segments, _ = model.transcribe(window, language="ru", vad_filter=False, beam_size=1, word_timestamps=False)
                    text = " ".join(seg.text.strip() for seg in segments if seg.text)
                    if text:
                        send("partial", {"text": text})
                except Exception as e:
                    send("partial", {"text": f""})
        elif t == "stop":
            stop_event.set()
            send("final", {"text": ""})
            break

if __name__ == "__main__":
    main()


