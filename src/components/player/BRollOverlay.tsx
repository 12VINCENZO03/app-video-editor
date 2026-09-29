import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';

export const BRollOverlay: React.FC = () => {
  const operations = useEditorStore((state) => state.project.operations);
  const currentTime = useEditorStore((state) => state.currentTime);

  // Trova se esiste un'operazione B_ROLL approvata attiva nel secondo corrente
  const activeBRoll = operations.find(
    (op) =>
      op.operation === 'B_ROLL' &&
      op.status === 'APPROVED' &&
      currentTime >= op.start &&
      currentTime < op.end
  );

  if (!activeBRoll) {
    return null;
  }

  const remaining = Math.max(0, activeBRoll.end - currentTime).toFixed(1);
  const placeholderImage =
    activeBRoll.assetUrl ||
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80';

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between overflow-hidden bg-black select-none pointer-events-none animate-in fade-in duration-300">
      {/* Immagine o Video B-Roll con effetto Ken-Burns lento */}
      <img
        src={placeholderImage}
        alt={activeBRoll.assetTitle || 'B-Roll Clip'}
        className="w-full h-full object-cover transform scale-105 transition-transform duration-1000 ease-out"
      />

      {/* Gradienti di contrasto per leggibilità */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60"></div>

      {/* Badge Superiore B-Roll Attivo */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 shadow-lg text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-semibold uppercase tracking-wider">B-Roll Attivo</span>
        </div>

        <div className="px-2 py-0.5 rounded bg-black/70 border border-neutral-700 text-neutral-300 text-[11px] font-mono">
          {remaining}s rimasti
        </div>
      </div>

      {/* Titolo e Didascalia Inferiore B-Roll */}
      <div className="absolute bottom-3 left-3 right-3 z-10 p-2.5 rounded bg-neutral-950/85 backdrop-blur border border-neutral-800 text-neutral-200">
        <p className="text-xs font-bold text-emerald-400 font-mono">
          {activeBRoll.assetTitle || 'Copertura Visiva Secondaria'}
        </p>
        <p className="text-[11px] text-neutral-400 leading-tight mt-0.5">
          {activeBRoll.reason}
        </p>
      </div>
    </div>
  );
};
