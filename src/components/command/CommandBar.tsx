import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { generateEditPlan } from '../../services/geminiService';

export const CommandBar: React.FC = () => {
  const [prompt, setPrompt] = useState('');

  const audioBlob = useEditorStore((state) => state.audioBlob);
  const isAnalyzing = useEditorStore((state) => state.isAnalyzing);
  const setIsAnalyzing = useEditorStore((state) => state.setIsAnalyzing);
  const addOperations = useEditorStore((state) => state.addOperations);
  const rawText = useEditorStore((state) => state.project.transcript.rawText);
  const creatorProfile = useEditorStore((state) => state.creatorProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isAnalyzing) return;

    const currentPrompt = prompt;
    setIsAnalyzing(true);

    try {
      // Se non abbiamo ancora caricato un audio Blob, usiamo un placeholder WAV vuoto valido
      const targetBlob =
        audioBlob ||
        new Blob([new Uint8Array(44)], { type: 'audio/wav' });

      const newOperations = await generateEditPlan(
        targetBlob,
        currentPrompt,
        rawText,
        creatorProfile
      );

      if (newOperations && newOperations.length > 0) {
        addOperations(newOperations);
      }
      setPrompt('');
    } catch (err) {
      console.error('Errore durante la generazione dell’Edit Plan:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setTargetAspectRatio = useEditorStore((state) => state.setTargetAspectRatio);

  const handleFindShortsHook = async () => {
    setTargetAspectRatio('9:16');
    const shortsPrompt =
      'Trova i 30-60 secondi più coinvolgenti del transcript da usare come hook per uno Short/TikTok 9:16. Taglia tutto il resto e mantieni solo la parte virale.';
    setPrompt(shortsPrompt);
    setIsAnalyzing(true);
    try {
      const targetBlob =
        audioBlob ||
        new Blob([new Uint8Array(44)], { type: 'audio/wav' });
      const newOps = await generateEditPlan(targetBlob, shortsPrompt, rawText, creatorProfile);
      if (newOps && newOps.length > 0) {
        addOperations(newOps);
      }
    } catch (err) {
      console.error('Errore ricerca hook short:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickPrompt = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="w-full bg-neutral-900/90 backdrop-blur border-t border-neutral-800 p-3 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col space-y-2">
        {/* Quick Suggestion Chips + Pulsante Hook per Short */}
        <div className="flex items-center space-x-2 text-xs text-neutral-400 overflow-x-auto pb-1 scrollbar-none">
          {/* Pulsante Trova Hook per Short (Task 6) */}
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleFindShortsHook}
            className="px-2.5 py-1 rounded-md bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium text-xs transition-all shadow-md shadow-pink-950/40 flex items-center space-x-1 whitespace-nowrap cursor-pointer border border-pink-400/30"
          >
            <span>⚡</span>
            <span>Trova Hook per Short (9:16)</span>
          </button>

          <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider pl-1">
            Filtri:
          </span>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleQuickPrompt('Rimuovi tutte le pause superiori a 1.5 secondi')}
            className="px-2 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 text-[11px] transition-colors whitespace-nowrap cursor-pointer"
          >
            "Taglia pause &gt; 1.5s"
          </button>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleQuickPrompt("Elimina tutti i 'falsi avvii' e le frasi riavviate")}
            className="px-2 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 text-[11px] transition-colors whitespace-nowrap cursor-pointer"
          >
            "Elimina falsi avvii"
          </button>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleQuickPrompt("Rimuovi le esitazioni come 'ehm', 'mmm'")}
            className="px-2 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 text-[11px] transition-colors whitespace-nowrap cursor-pointer"
          >
            "Rimuovi 'ehm' e 'mmm'"
          </button>
        </div>

        {/* Input Bar Principale */}
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyan-400">
              {isAnalyzing ? (
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="text-sm font-bold">✨</span>
              )}
            </div>
            <input
              type="text"
              value={prompt}
              disabled={isAnalyzing}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isAnalyzing
                  ? 'Analisi AI in corso (Gemini Flash Edit Planner)...'
                  : "Chiedi all'AI Edit Planner (es. Rimuovi le pause sopra 2 secondi per rendere l'intro più dinamica)..."
              }
              className="w-full pl-9 pr-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing || !prompt.trim()}
            className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors shadow-md shadow-cyan-900/30 flex items-center space-x-2 cursor-pointer"
          >
            {isAnalyzing ? (
              <span>Analisi in corso...</span>
            ) : (
              <>
                <span>Invia</span>
                <span className="text-xs font-mono">↵</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
