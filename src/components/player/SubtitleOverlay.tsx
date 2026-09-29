import React, { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { TimedWord } from '../../types/editor';

interface SubtitleOverlayProps {
  className?: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ className = '' }) => {
  const words = useEditorStore((state) => state.project.transcript.words);
  const operations = useEditorStore((state) => state.project.operations);
  const currentTime = useEditorStore((state) => state.currentTime);
  const targetAspectRatio = useEditorStore((state) => state.targetAspectRatio);

  // Trova le parole attive (escludendo quelle rimosse dai tagli APPROVED)
  const activeSpokenWords = useMemo(() => {
    const approvedRemoveOps = operations.filter(
      (op) => op.operation === 'REMOVE' && op.status === 'APPROVED'
    );

    return words.filter((word) => {
      // Ignora i token di pausa o silenzio per i sottotitoli a schermo
      if (word.type === 'silence') return false;

      // Verifica se cade all'interno di un taglio approvato
      const isRemoved = approvedRemoveOps.some(
        (op) => word.start < op.end && word.end > op.start
      );
      return !isRemoved;
    });
  }, [words, operations]);

  // Trova l'indice della parola correntemente pronunciata
  const currentWordIndex = activeSpokenWords.findIndex(
    (word) => currentTime >= word.start && currentTime <= word.end
  );

  // Se non c'è una parola attiva in questo istante, cerca se siamo all'interno di una frase vicina
  const activeWindowWords = useMemo<TimedWord[]>(() => {
    if (currentWordIndex === -1) {
      // Controlla se siamo poco prima o poco dopo una parola (gap inferiore a 0.3s)
      const nearbyIndex = activeSpokenWords.findIndex(
        (word) => Math.abs(currentTime - word.start) <= 0.35 || Math.abs(currentTime - word.end) <= 0.35
      );
      if (nearbyIndex === -1) return [];
      const start = Math.max(0, nearbyIndex - 2);
      const end = Math.min(activeSpokenWords.length, nearbyIndex + 3);
      return activeSpokenWords.slice(start, end);
    }

    // Mostra una finestra contestuale di 4-5 parole intorno a quella corrente (stile Shorts virale)
    const windowStart = Math.max(0, currentWordIndex - 2);
    const windowEnd = Math.min(activeSpokenWords.length, currentWordIndex + 3);
    return activeSpokenWords.slice(windowStart, windowEnd);
  }, [activeSpokenWords, currentWordIndex, currentTime]);

  if (activeWindowWords.length === 0) {
    return null;
  }

  const isShorts = targetAspectRatio === '9:16';

  return (
    <div
      className={`absolute pointer-events-none z-30 flex items-center justify-center text-center px-4 transition-all duration-150 ${
        isShorts ? 'bottom-20 left-4 right-4' : 'bottom-10 left-6 right-6'
      } ${className}`}
    >
      <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl shadow-2xl border border-white/10 max-w-xl">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {activeWindowWords.map((word) => {
            const isCurrent = currentTime >= word.start && currentTime <= word.end;

            return (
              <span
                key={word.id}
                className={`transition-all duration-100 uppercase tracking-wide font-extrabold ${
                  isCurrent
                    ? 'text-yellow-300 text-lg md:text-xl scale-110 drop-shadow-[0_2px_8px_rgba(234,179,8,0.8)]'
                    : 'text-white/80 text-sm md:text-base font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                }`}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
