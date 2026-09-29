import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { EditOperation } from '../../types/editor';

export const ApprovalCenter: React.FC = () => {
  const operations = useEditorStore((state) => state.project.operations);
  const approveOperation = useEditorStore((state) => state.approveOperation);
  const rejectOperation = useEditorStore((state) => state.rejectOperation);
  const approveAll = useEditorStore((state) => state.approveAll);
  const rejectAll = useEditorStore((state) => state.rejectAll);
  const seekTo = useEditorStore((state) => state.seekTo);
  const resetDemoData = useEditorStore((state) => state.resetDemoData);

  // Filtra solo le operazioni in attesa di approvazione
  const pendingOperations = operations.filter(
    (op) => op.status === 'PENDING_APPROVAL'
  );

  const approvedCount = operations.filter((op) => op.status === 'APPROVED').length;
  const rejectedCount = operations.filter((op) => op.status === 'REJECTED').length;

  const getTypeBadge = (op: EditOperation) => {
    switch (op.type) {
      case 'silence':
        return { label: 'Pausa prolungata', color: 'bg-indigo-950/70 text-indigo-300 border-indigo-800' };
      case 'hesitation':
        return { label: 'Esitazione vocale', color: 'bg-amber-950/70 text-amber-300 border-amber-800' };
      case 'false_start':
        return { label: 'Falso avvio', color: 'bg-rose-950/70 text-rose-300 border-rose-800' };
      case 'stock_video':
      case 'image':
      case 'screen_recording':
        return { label: '🎬 B-Roll Overlay', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-700' };
      default:
        return { label: op.operation === 'B_ROLL' ? '🎬 B-Roll' : op.type, color: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      {/* Header con contatore e Batch Actions */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-950/60 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">Approval Center</h2>
            <p className="text-[11px] text-neutral-400">
              {pendingOperations.length} proposte AI da revisionare
            </p>
          </div>
          <div className="flex space-x-1.5 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
              {approvedCount} ✓
            </span>
            <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-900">
              {rejectedCount} ✕
            </span>
          </div>
        </div>

        {/* Pulsanti Batch */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => approveAll()}
            disabled={pendingOperations.length === 0}
            className="flex items-center justify-center space-x-1 px-3 py-1.5 text-xs font-medium rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
          >
            <span>✓</span>
            <span>Approva Tutti</span>
          </button>
          <button
            onClick={() => rejectAll()}
            disabled={pendingOperations.length === 0}
            className="flex items-center justify-center space-x-1 px-3 py-1.5 text-xs font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-neutral-700 cursor-pointer"
          >
            <span>✕</span>
            <span>Rifiuta Tutti</span>
          </button>
        </div>
      </div>

      {/* Lista delle CutCard in attesa */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {pendingOperations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400 text-lg">
              ✓
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-200">Revisione completata!</p>
              <p className="text-xs text-neutral-400 mt-1">
                Tutte le proposte dell'AI sono state elaborate.
              </p>
            </div>
            <button
              onClick={() => resetDemoData()}
              className="mt-2 text-xs text-neutral-400 hover:text-cyan-400 underline underline-offset-4 cursor-pointer"
            >
              Ripristina dati demo
            </button>
          </div>
        ) : (
          pendingOperations.map((op) => {
            const badge = getTypeBadge(op);
            const durationCut = op.end - op.start;

            return (
              <div
                key={op.id}
                className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-3 space-y-2.5 hover:border-neutral-700 transition-colors"
              >
                {/* Header card: badge, timecode e durata */}
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${badge.color}`}
                  >
                    {badge.label}
                  </span>

                  <button
                    onClick={() => seekTo(op.start)}
                    title="Salta a questo punto nel video"
                    className="font-mono text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center space-x-1 cursor-pointer bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800"
                  >
                    <span>
                      {op.start.toFixed(1)}s - {op.end.toFixed(1)}s
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      (-{durationCut.toFixed(1)}s)
                    </span>
                  </button>
                </div>

                {/* Reason generata dall'AI */}
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {op.reason}
                </p>

                {/* Pulsanti Approva / Rifiuta */}
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-neutral-800/60">
                  <button
                    onClick={() => rejectOperation(op.id)}
                    className="px-2.5 py-1 text-xs rounded bg-neutral-800 hover:bg-red-950/80 hover:text-red-300 text-neutral-400 border border-neutral-700 transition-colors cursor-pointer"
                  >
                    ✕ Rifiuta
                  </button>
                  <button
                    onClick={() => approveOperation(op.id)}
                    className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors shadow-sm cursor-pointer"
                  >
                    ✓ Approva
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
