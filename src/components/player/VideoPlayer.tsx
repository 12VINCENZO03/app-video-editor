import React, { useRef, useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { computePlayableSegments } from '../../engine/virtualTimeline';
import { useVirtualPlayback } from '../../hooks/useVirtualPlayback';
import { BRollOverlay } from './BRollOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';

interface VideoPlayerProps {
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const project = useEditorStore((state) => state.project);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const targetAspectRatio = useEditorStore((state) => state.targetAspectRatio);
  const setTargetAspectRatio = useEditorStore((state) => state.setTargetAspectRatio);
  const isMusicEnabled = useEditorStore((state) => state.isMusicEnabled);
  const toggleMusic = useEditorStore((state) => state.toggleMusic);

  // Calcola in tempo reale i segmenti attivi della Virtual Timeline
  const keepSegments = useMemo(() => {
    return computePlayableSegments(project.media.duration, project.operations);
  }, [project.media.duration, project.operations]);

  const seekTarget = useEditorStore((state) => state.seekTarget);
  const clearSeekTarget = useEditorStore((state) => state.clearSeekTarget);

  // Hook Virtual Timeline con Skip-Map a 60fps e audio anti-pop
  const { jumpTo } = useVirtualPlayback({
    videoRef,
    keepSegments,
    onTimeUpdate: (time) => {
      setCurrentTime(time);
    },
    onEnded: () => {
      setIsPlaying(false);
    },
  });

  // Reagisci ai comandi di seek esterni (timeline click o parola cliccata)
  React.useEffect(() => {
    if (seekTarget !== null && videoRef.current) {
      jumpTo(seekTarget);
      clearSeekTarget();
    }
  }, [seekTarget, jumpTo, clearSeekTarget]);

  const setVideoSource = useEditorStore((state) => state.setVideoSource);

  const videoSource =
    project.media.sourceUrl ||
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4';

  const handleLoadedMetadata = () => {
    if (videoRef.current && Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
      if (project.media.sourceUrl && Math.abs(videoRef.current.duration - project.media.duration) > 0.5) {
        setVideoSource(project.media.sourceUrl, project.media.title, videoRef.current.duration);
      }
    }
  };

  const isShorts = targetAspectRatio === '9:16';

  return (
    <div
      className={`relative flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden w-full h-full select-none ${className}`}
    >
      {/* Controlli Overlay Top: Formato e Ducking Musica */}
      <div className="absolute top-2.5 right-2.5 z-40 flex items-center space-x-2">
        {/* Toggle Musica di Sottofondo & Ducking */}
        <button
          type="button"
          onClick={toggleMusic}
          title={isMusicEnabled ? 'Disattiva musica di sottofondo' : 'Attiva musica con Ducking automatico'}
          className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer flex items-center space-x-1 border ${
            isMusicEnabled
              ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm animate-pulse'
              : 'bg-neutral-900/90 text-neutral-400 border-neutral-700 hover:text-neutral-200'
          }`}
        >
          <span>🎵</span>
          <span>{isMusicEnabled ? 'BGM Ducking ON' : 'BGM OFF'}</span>
        </button>

        {/* Selettore Formato e Auto-Reframe (16:9 vs 9:16) */}
        <div className="flex items-center space-x-1 bg-neutral-900/90 backdrop-blur px-1.5 py-1 rounded-md border border-neutral-700 shadow-md">
          <button
            type="button"
            onClick={() => setTargetAspectRatio('16:9')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
              !isShorts
                ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            16:9 Wide
          </button>
          <button
            type="button"
            onClick={() => setTargetAspectRatio('9:16')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center space-x-1 ${
              isShorts
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>📱</span>
            <span>9:16 Shorts</span>
          </button>
        </div>
      </div>

      {/* Sfondo sfocato in modalità 9:16 per riempire lo spazio orizzontale */}
      {isShorts && (
        <div
          className="absolute inset-0 opacity-25 filter blur-2xl scale-125 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <video
            src={videoSource}
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Contenitore Video Principale con Maschera Dinamica 9:16 o 16:9 */}
      <div
        className={`relative transition-all duration-300 flex items-center justify-center ${
          isShorts
            ? 'aspect-[9/16] h-[92%] max-h-[460px] w-auto rounded-xl border-2 border-pink-500/70 shadow-2xl shadow-purple-950/60 overflow-hidden bg-black'
            : 'w-full h-full max-h-[480px]'
        }`}
      >
        <video
          ref={videoRef}
          src={videoSource}
          crossOrigin="anonymous"
          controls
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          className={`w-full h-full ${isShorts ? 'object-cover' : 'object-contain'}`}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Layer B-Roll Overlay (Mostra video/immagine secondaria durante range approvato) */}
        <BRollOverlay />

        {/* Layer Sottotitoli Dinamici a Schermo con evidenziazione parola attiva */}
        <SubtitleOverlay />
      </div>
    </div>
  );
};
