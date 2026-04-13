import { useState, useEffect, useRef } from "react";

export function useLiveAudio(listenUrl: string | undefined | null) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const startListening = () => {
    if (!listenUrl) {
      setError("No listen URL provided");
      return;
    }
    
    setError(null);
    setIsListening(true);
    
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
      
      const ws = new WebSocket(listenUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to Live Call Stream");
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Vapi stream provides raw binary payload
          playPCM16(event.data);
        } else if (typeof event.data === 'string') {
           // JSON payload (like {"type": "media", "media": {"payload": "..."}})
           try {
             const parsed = JSON.parse(event.data);
             if (parsed.type === "media" && parsed.media?.payload) {
                const binaryString = window.atob(parsed.media.payload);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                playPCM16(bytes.buffer);
             }
           } catch(e) {}
        }
      };

      ws.onerror = (err) => {
        console.error("Live Audio WS Error:", err);
        setError("Stream connection failed.");
        stopListening();
      };
      
      ws.onclose = () => {
        setIsListening(false);
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start audio context.");
      setIsListening(false);
    }
  };

  const playPCM16 = (buffer: ArrayBuffer) => {
    if (!audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    // Assuming 16-bit PCM @ 16kHz
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule slightly in the future to avoid jitter
    if (nextStartTimeRef.current < ctx.currentTime) {
      nextStartTimeRef.current = ctx.currentTime + 0.1;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
  };

  const stopListening = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return { isListening, startListening, stopListening, error };
}
