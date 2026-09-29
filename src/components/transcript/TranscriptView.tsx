import React, { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { TimedWord, EditOperation } from '../../types/editor';

export const TranscriptView: React.FC = () => {
  const words = useEditorStore((state) => state.project.transcript.words);
  const operations = useEditorStore((state) => state.project.operations);
  const currentTime = useEditorStore((state) => state.currentTime);
  const seekTo = useEditorStore((state) => state.seekTo);

  const isTranscribing = useEditorStore((state) => state.isTranscribing);

  // Mappa rapida per determinare se una parola rientra in una o più operazioni
  const wordStatusMap = useMemo(() => {
    const map = new Map<string, { op: EditOperation; status: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' }>();

    for (const word of words) {
      // Verifica per ID diretto o sovrapposizione temporale
      const matchingOp = operations.find((op) => {
        if (op.targetWordIds && op.targetWordIds.includes(word.id)) return true;
        // Check per sovrapposizione temporale (con un piccolo margine di tolleranza)
        const overlap = Math.max(0, Math.min(word.end, op.end) - Math.max(word.start, op.start));
        return overlap > 0.05;
      });

      if (matchingOp) {
        map.set(word.id, {
          op: matchingOp,
          status: matchingOp.status,
        });
      }
    }

    return map;
  }, [words, operations]);

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      {/* Header colonna trascrizione */}
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">Interactive Transcript</h2>
          <p className="text-[11px] text-neutral-400">Clicca su una parola per saltare al timecode</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px]">
            {words.length} segmenti
          </span>
        </div>
      </div>

      {/* Contenitore scorrevole trascrizione */}
      <div className="flex-1 p-5 overflow-y-auto space-y-3 font-sans leading-relaxed select-text">
        {isTranscribing ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-cyan-950/70 border border-cyan-500/50 flex items-center justify-center text-cyan-400 animate-spin">
              ⚡
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-200">Trascrizione AI in corso...</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                Gemini sta analizzando l'audio 16kHz per generare la trascrizione temporizzata con rilevamento automatico di pause ed esitazioni.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 items-center">
          {words.map((word: TimedWord) => {
            const opInfo = wordStatusMap.get(word.id);
            const isCurrent = currentTime >= word.start && currentTime < word.end;

            const isRemoveApproved =
              opInfo && opInfo.op.operation === 'REMOVE' && opInfo.status === 'APPROVED';
            const isRemovePending =
              opInfo && opInfo.op.operation === 'REMOVE' && opInfo.status === 'PENDING_APPROVAL';
            const isKeep =
              opInfo && opInfo.op.operation === 'KEEP';

            const isSilence = word.type === 'silence';
            const isFiller = word.type === 'filler';

            // Costruisci classi CSS dinamiche
            let wordStyle =
              'inline-flex items-center px-1.5 py-0.5 rounded transition-all cursor-pointer select-none text-sm ';

            if (isRemoveApproved) {
              wordStyle +=
                'text-red-500 line-through opacity-50 bg-red-950/20 border border-red-900/30 hover:opacity-80 ';
            } else if (isRemovePending) {
              wordStyle +=
                'text-amber-300 bg-amber-950/40 border-b-2 border-amber-400 border-dashed hover:bg-amber-900/40 ';
            } else if (isKeep) {
              wordStyle +=
                'text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 ';
            } else if (isSilence) {
              wordStyle +=
                'text-neutral-400 bg-neutral-800/60 font-mono text-xs hover:bg-neutral-800 ';
            } else if (isFiller) {
              wordStyle += 'italic text-amber-200/80 hover:bg-neutral-800 ';
            } else {
              wordStyle += 'text-neutral-200 hover:bg-neutral-800/80 ';
            }

            if (isCurrent) {
              wordStyle += 'ring-2 ring-cyan-400 bg-cyan-950/60 font-medium scale-[1.02] shadow-sm ';
            }

            return (
              <span
                key={word.id}
                onClick={() => seekTo(word.start)}
                title={`${word.text} (${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s)`}
                className={wordStyle}
              >
                {word.text}
                <span className="ml-1 text-[9px] font-mono opacity-40">
                  {word.start.toFixed(1)}s
                </span>
              </span>
            );
          })}
          </div>
        )}
      </div>

      {/* Footer / Info di stato */}
      <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between text-[11px] text-neutral-400">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Tagliato</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Da approvare</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>In ascolto</span>
          </span>
        </div>
      </div>
    </div>
  );
};
