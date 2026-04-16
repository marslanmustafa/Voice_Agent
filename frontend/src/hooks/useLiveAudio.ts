import { useRef, useState, useCallback, useEffect } from "react";

export function useLiveAudio(listenUrl: string | undefined | null) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const stopListening = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    nextPlayTimeRef.current = 0;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!listenUrl || wsRef.current) return;
    setError(null);

    // Vapi streams 8kHz µ-law PCM — AudioContext must be created after a user gesture
    const ctx = new AudioContext({ sampleRate: 8000 });
    audioCtxRef.current = ctx;
    nextPlayTimeRef.current = ctx.currentTime;

    const ws = new WebSocket(listenUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setIsListening(true);
    ws.onerror = () => setError("WebSocket connection failed");
    ws.onclose = () => setIsListening(false);

    ws.onmessage = (evt) => {
      if (!(evt.data instanceof ArrayBuffer)) return;
      const raw = new Uint8Array(evt.data);

      // Decode µ-law to linear PCM float32
      const pcm = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        pcm[i] = mulawToLinear(raw[i]) / 32768.0;
      }

      const buffer = ctx.createBuffer(1, pcm.length, 8000);
      buffer.copyToChannel(pcm, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      // Schedule chunks sequentially to avoid gaps/glitches
      const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime);
      source.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;
    };
  }, [listenUrl]);

  // Stop when URL changes or component unmounts
  useEffect(() => () => stopListening(), [stopListening]);

  return { isListening, startListening, stopListening, error };
}

// ITU-T G.711 µ-law to linear16 decoder
function mulawToLinear(mulaw: number): number {
  mulaw = ~mulaw & 0xff;
  const sign = mulaw & 0x80;
  const exp = (mulaw >> 4) & 0x07;
  const mantissa = mulaw & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exp;
  sample -= 0x84;
  return sign ? -sample : sample;
}
