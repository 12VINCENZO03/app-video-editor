import React, { useRef } from 'react';
import { useEditorStore } from '../../store/useEditorStore';

export const VisualTimeline: React.FC = () => {
  const timelineRef = useRef<HTMLDivElement>(null);

  const duration = useEditorStore((state) => state.project.media.duration);
  const operations = useEditorStore((state) => state.project.operations);
  const currentTime = useEditorStore((state) => state.currentTime);
  const playableSegments = useEditorStore((state) => state.playableSegments);
  const seekTo = useEditorStore((state) => state.seekTo);

  // Calcola durata totale post-tagli
  const editedDuration = playableSegments.reduce(
    (acc, seg) => acc + (seg.end - seg.start),
    0
  );

  const savedSeconds = Math.max(0, duration - editedDuration);

  // Click sulla timeline per effettuare il seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = ratio * duration;
    seekTo(targetSeconds);
  };

  // Posizione playhead in percentuale
  const playheadPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2 select-none">
      {/* Header con statistiche di montaggio e Legenda Tracce */}
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center space-x-3">
          <span className="font-mono text-neutral-200">
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </span>
          <span className="text-neutral-500">|</span>
          <span className="text-emerald-400 font-medium">
            Virtual: {editedDuration.toFixed(1)}s
          </span>
          {savedSeconds > 0 && (
            <span className="bg-red-950/60 border border-red-800/50 text-red-300 px-1.5 py-0.5 rounded text-[10px]">
              -{savedSeconds.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Legenda Tracce NLE */}
        <div className="flex items-center space-x-3 text-[11px]">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
            <span>V2 B-Roll</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block"></span>
            <span>V1 Tagliati</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
            <span>In attesa</span>
          </div>
        </div>
      </div>

      {/* Timeline Multi-Traccia NLE (V2 B-Roll + V1 Tagli) */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="relative w-full bg-neutral-950 rounded border border-neutral-800 cursor-pointer overflow-hidden flex flex-col space-y-1 p-1"
      >
        {/* Griglia temporale di sfondo condivisa */}
        <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-full border-r border-neutral-600"></div>
          ))}
        </div>

        {/* TRACCIA VIDEO 2: B-ROLL OVERLAY */}
        <div className="relative h-6 w-full bg-neutral-900/60 rounded border border-neutral-800/80 overflow-hidden flex items-center">
          <span className="absolute left-1.5 text-[9px] font-mono text-neutral-500 uppercase z-0 font-bold">
            Traccia V2 (B-Roll)
          </span>

          {operations
            .filter((op) => op.operation === 'B_ROLL')
            .map((op) => {
              const leftPercent = (op.start / duration) * 100;
              const widthPercent = ((op.end - op.start) / duration) * 100;
              const isApproved = op.status === 'APPROVED';

              return (
                <div
                  key={op.id}
                  title={`${op.assetTitle || 'B-Roll'} (${op.start.toFixed(1)}s - ${op.end.toFixed(1)}s)`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  className={`absolute top-0 bottom-0 z-10 rounded-sm flex items-center px-1.5 overflow-hidden transition-all ${
                    isApproved
                      ? 'bg-emerald-600/90 border border-emerald-400 text-white shadow-sm'
                      : 'bg-cyan-700/70 border border-cyan-400 border-dashed text-cyan-100'
                  }`}
                >
                  <span className="text-[10px] font-medium truncate pointer-events-none drop-shadow flex items-center space-x-1">
                    <span>🎬</span>
                    <span>{op.assetTitle || 'B-Roll'}</span>
                  </span>
                </div>
              );
            })}
        </div>

        {/* TRACCIA VIDEO 1: MASTER CUTS (REMOVE / KEEP) */}
        <div className="relative h-7 w-full bg-neutral-900/60 rounded border border-neutral-800/80 overflow-hidden flex items-center">
          <span className="absolute left-1.5 text-[9px] font-mono text-neutral-500 uppercase z-0 font-bold">
            Traccia V1 (Voice & Cuts)
          </span>

          {operations
            .filter((op) => op.operation === 'REMOVE')
            .map((op) => {
              const leftPercent = (op.start / duration) * 100;
              const widthPercent = ((op.end - op.start) / duration) * 100;
              const isApproved = op.status === 'APPROVED';
              const isPending = op.status === 'PENDING_APPROVAL';

              if (!isApproved && !isPending) return null;

              return (
                <div
                  key={op.id}
                  title={`${op.reason} (${op.start.toFixed(1)}s - ${op.end.toFixed(1)}s)`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  className={`absolute top-0 bottom-0 z-10 transition-colors flex items-center justify-center overflow-hidden px-0.5 ${
                    isApproved
                      ? 'bg-red-600/80 border-x border-red-500'
                      : 'bg-amber-500/70 border-x border-amber-400'
                  }`}
                >
                  <span className="text-[9px] font-mono text-white font-semibold truncate pointer-events-none drop-shadow">
                    {op.type}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Cursore Playhead Condiviso (attraversa entrambe le tracce) */}
        <div
          style={{ left: `${playheadPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none transition-[left] duration-75"
        >
          <div className="w-2.5 h-2.5 -ml-1 bg-cyan-400 rotate-45 transform origin-center shadow-lg shadow-cyan-500/80"></div>
        </div>
      </div>
    </div>
  );
};
