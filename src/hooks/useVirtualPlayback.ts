import { useEffect, useRef, useCallback } from 'react';
import { PlayableSegment } from '../types/editor';
import { useEditorStore } from '../store/useEditorStore';

interface UseVirtualPlaybackOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  keepSegments: PlayableSegment[];
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

// Cache globale per evitare chiamate duplicate a createMediaElementSource sullo stesso elemento
const mediaElementSourceMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

// Genera un buffer armonico ambient rilassante (Cmaj9) per la musica di sottofondo
function createAmbientPadBuffer(ctx: AudioContext): AudioBuffer {
  const duration = 8.0;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const freqs = [130.81, 164.81, 196.0, 246.94, 293.66];
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;
    for (let f = 0; f < freqs.length; f++) {
      const freq = freqs[f];
      const sin = Math.sin(2 * Math.PI * freq * t);
      const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.4;
      sampleL += (sin + sub) * (0.06 / freqs.length);
      sampleR += (Math.cos(2 * Math.PI * freq * t) + sub) * (0.06 / freqs.length);
    }
    const env = Math.sin((t / duration) * Math.PI);
    left[i] = sampleL * env;
    right[i] = sampleR * env;
  }
  return buffer;
}

export function useVirtualPlayback({
  videoRef,
  keepSegments,
  onTimeUpdate,
  onEnded,
}: UseVirtualPlaybackOptions) {
  const isMusicEnabled = useEditorStore((state) => state.isMusicEnabled);
  const musicTrack = useEditorStore((state) => state.musicTrack);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);

  // Nodi Musica e Ducking
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const isJumpingRef = useRef<boolean>(false);

  // Inizializza Web Audio API con De-clicking e Audio Ducking
  const initAudio = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!audioContextRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // 1. Nodo Gain video vocale per anti-pop
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 1.0;
      gainNodeRef.current = voiceGain;

      // 2. Analizzatore per sidechain ducking vocale
      const voiceAnalyser = ctx.createAnalyser();
      voiceAnalyser.fftSize = 256;
      voiceAnalyserRef.current = voiceAnalyser;

      let sourceNode = mediaElementSourceMap.get(video);
      if (!sourceNode) {
        try {
          sourceNode = ctx.createMediaElementSource(video);
          mediaElementSourceMap.set(video, sourceNode);
        } catch (e) {
          console.warn('Audio node already connected or unavailable:', e);
        }
      }

      if (sourceNode) {
        sourceNode.connect(voiceGain);
        voiceGain.connect(voiceAnalyser);
        voiceGain.connect(ctx.destination);
      }

      // 3. Catena musica di sottofondo con Ducking GainNode
      const musicGain = ctx.createGain();
      musicGain.gain.value = 0.0;
      musicGainNodeRef.current = musicGain;
      musicGain.connect(ctx.destination);
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [videoRef]);

  // Gestione avvio / arresto musica di sottofondo
  useEffect(() => {
    const ctx = audioContextRef.current;
    const video = videoRef.current;
    if (!ctx || !video) return;

    const startMusic = async () => {
      if (musicSourceNodeRef.current) {
        try {
          musicSourceNodeRef.current.stop();
          musicSourceNodeRef.current.disconnect();
        } catch {}
      }

      let audioBuffer: AudioBuffer;
      if (musicTrack) {
        const arrayBuf = await musicTrack.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuf);
      } else {
        audioBuffer = createAmbientPadBuffer(ctx);
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;

      if (musicGainNodeRef.current) {
        source.connect(musicGainNodeRef.current);
      }

      source.start(0);
      musicSourceNodeRef.current = source;
    };

    if (isMusicEnabled) {
      startMusic();
    } else {
      if (musicSourceNodeRef.current) {
        try {
          musicSourceNodeRef.current.stop();
        } catch {}
        musicSourceNodeRef.current = null;
      }
      if (musicGainNodeRef.current) {
        musicGainNodeRef.current.gain.value = 0.0;
      }
    }

    return () => {
      if (musicSourceNodeRef.current) {
        try {
          musicSourceNodeRef.current.stop();
        } catch {}
        musicSourceNodeRef.current = null;
      }
    };
  }, [isMusicEnabled, musicTrack, videoRef]);

  // Esegue un salto temporale con micro-dissolvenza audio (5ms ramp)
  const jumpTo = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      const audioCtx = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      if (!video) return;

      isJumpingRef.current = true;

      if (audioCtx && gainNode && audioCtx.state === 'running') {
        const now = audioCtx.currentTime;
        // Micro fade-out di 5ms prima del salto per evitare il pop acustico
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.setTargetAtTime(0, now, 0.005);

        video.currentTime = targetTime;

        // Micro fade-in di 5ms dopo il salto
        const rampUpTime = now + 0.006;
        gainNode.gain.setTargetAtTime(1.0, rampUpTime, 0.005);
      } else {
        video.currentTime = targetTime;
      }

      setTimeout(() => {
        isJumpingRef.current = false;
      }, 20);
    },
    [videoRef]
  );

  // Loop requestAnimationFrame a 60fps per il monitoraggio della Virtual Timeline e Audio Ducking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const dataArray = new Uint8Array(128);

    const checkVirtualTimeline = () => {
      const audioCtx = audioContextRef.current;
      const voiceAnalyser = voiceAnalyserRef.current;
      const musicGain = musicGainNodeRef.current;

      // 1. Logica Audio Ducking (Sidechain) in tempo reale
      if (isMusicEnabled && audioCtx && voiceAnalyser && musicGain) {
        if (!video.paused && !video.ended) {
          voiceAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avgLevel = sum / dataArray.length;

          // Se il volume del parlato è alto, abbassa la musica al 12-15% (Ducking)
          if (avgLevel > 18) {
            musicGain.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.08);
          } else {
            // Durante le pause naturali non tagliate, alza la musica al 55%
            musicGain.gain.setTargetAtTime(0.55, audioCtx.currentTime, 0.25);
          }
        } else {
          // Video in pausa: silenzia la musica dolcemente
          musicGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.05);
        }
      }

      // 2. Loop Virtual Timeline a 60fps
      if (!video.paused && !video.ended && keepSegments.length > 0 && !isJumpingRef.current) {
        const currentTime = video.currentTime;

        if (onTimeUpdate) {
          onTimeUpdate(currentTime);
        }

        const activeSegment = keepSegments.find(
          (seg) => currentTime >= seg.start && currentTime < seg.end
        );

        if (activeSegment) {
          if (currentTime >= activeSegment.end - 0.03) {
            const currentIndex = keepSegments.indexOf(activeSegment);
            const nextSegment = keepSegments[currentIndex + 1];

            if (nextSegment) {
              jumpTo(nextSegment.start);
            } else {
              video.pause();
              if (onEnded) onEnded();
            }
          }
        } else {
          const nextSegment = keepSegments.find((seg) => seg.start > currentTime);
          if (nextSegment) {
            jumpTo(nextSegment.start);
          } else {
            video.pause();
            if (onEnded) onEnded();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(checkVirtualTimeline);
    };

    animFrameRef.current = requestAnimationFrame(checkVirtualTimeline);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [videoRef, keepSegments, jumpTo, onTimeUpdate, onEnded, isMusicEnabled]);

  // Listener eventi video per sbloccare l'AudioContext e gestire la riproduzione
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      initAudio();
    };

    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('play', handlePlay);
    };
  }, [videoRef, initAudio]);

  return {
    jumpTo,
    initAudio,
  };
}
