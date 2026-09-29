/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { useEditorStore } from './store/useEditorStore';
import { VideoPlayer } from './components/player/VideoPlayer';
import { VisualTimeline } from './components/timeline/VisualTimeline';
import { TranscriptView } from './components/transcript/TranscriptView';
import { ApprovalCenter } from './components/approval/ApprovalCenter';
import { CommandBar } from './components/command/CommandBar';
import { exportToCMX3600EDL } from './engine/virtualTimeline';
import { extractAudioFromVideo } from './engine/audioExtractor';
import { exportFinalVideo } from './engine/ffmpegRenderer';
import { generateTranscript } from './services/geminiService';
import { CreatorProfile } from './types/editor';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExportingMP4, setIsExportingMP4] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  // Stati UI per Versioning e Creator Profile (Task 7)
  const [showVersionsMenu, setShowVersionsMenu] = useState(false);
  const [showNewVersionInput, setShowNewVersionInput] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  const project = useEditorStore((state) => state.project);
  const playableSegments = useEditorStore((state) => state.playableSegments);
  const uploadedFile = useEditorStore((state) => state.uploadedFile);
  const setUploadedFile = useEditorStore((state) => state.setUploadedFile);
  const setVideoSource = useEditorStore((state) => state.setVideoSource);
  const setTranscript = useEditorStore((state) => state.setTranscript);
  const setAudioBlob = useEditorStore((state) => state.setAudioBlob);
  const audioBlob = useEditorStore((state) => state.audioBlob);
  const isExtractingAudio = useEditorStore((state) => state.isExtractingAudio);
  const setIsExtractingAudio = useEditorStore((state) => state.setIsExtractingAudio);
  const isTranscribing = useEditorStore((state) => state.isTranscribing);
  const setIsTranscribing = useEditorStore((state) => state.setIsTranscribing);

  // Versioning & Creator Profile
  const versions = useEditorStore((state) => state.versions);
  const activeVersionId = useEditorStore((state) => state.activeVersionId);
  const saveVersion = useEditorStore((state) => state.saveVersion);
  const switchVersion = useEditorStore((state) => state.switchVersion);
  const creatorProfile = useEditorStore((state) => state.creatorProfile);
  const setCreatorProfile = useEditorStore((state) => state.setCreatorProfile);

  // Scarica il file EDL CMX 3600 con un click
  const handleExportEDL = () => {
    const edlContent = exportToCMX3600EDL(project.title, playableSegments);
    const blob = new Blob([edlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/\s+/g, '_')}.edl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Esportazione MP4 fisica tramite FFmpeg.wasm nel browser
  const handleExportMP4 = async () => {
    if (playableSegments.length === 0) {
      alert('Nessun segmento valido da renderizzare.');
      return;
    }

    setIsExportingMP4(true);
    setExportProgress(0);
    setExportStatusText('Inizializzazione FFmpeg WebAssembly...');
    setExportError(null);

    try {
      let fileToRender: File | Blob | null = uploadedFile;

      // Se l'utente non ha ancora caricato un file locale, recupera il video demo
      if (!fileToRender) {
        setExportStatusText('Recupero video sorgente demo...');
        const response = await fetch(
          'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'
        );
        fileToRender = await response.blob();
      }

      setExportStatusText('Rendering tagli fisici nel browser...');

      const outputUrl = await exportFinalVideo(
        fileToRender,
        playableSegments,
        (progress) => {
          setExportProgress(progress);
          if (progress < 25) {
            setExportStatusText('Caricamento moduli WebAssembly...');
          } else if (progress < 85) {
            setExportStatusText(`Taglio clip in corso (${progress}%)...`);
          } else if (progress < 95) {
            setExportStatusText('Concatenazione e muxing MP4...');
          } else {
            setExportStatusText('Finalizzazione file...');
          }
        }
      );

      // Forza il download del file MP4 montato
      const a = document.createElement('a');
      a.href = outputUrl;
      a.download = `montato_${project.title.toLowerCase().replace(/\s+/g, '_')}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(outputUrl), 5000);
    } catch (err: unknown) {
      console.error('Errore durante il rendering FFmpeg:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(
        `Impossibile completare il rendering locale: ${msg}. Puoi comunque scaricare la timeline EDL per finalizzare in Premiere o DaVinci Resolve.`
      );
    } finally {
      setIsExportingMP4(false);
    }
  };

  // Gestione caricamento video locale, estrazione audio 16kHz e trascrizione Gemini
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedFile(file);

      // 1. Crea Object URL per riproduzione locale immediata
      const objectUrl = URL.createObjectURL(file);
      setVideoSource(objectUrl, file.name);

      // 2. Estrai la traccia audio e ricampiona a 16kHz mono nel browser
      setIsExtractingAudio(true);
      const extractedBlob = await extractAudioFromVideo(file);
      setAudioBlob(extractedBlob);
      setIsExtractingAudio(false);
      console.log('Audio estratto con successo a 16kHz mono. Peso:', extractedBlob.size, 'bytes');

      // 3. Trascrizione temporizzata automatica con Gemini (sovrascrive dati demo e svuota operations)
      setIsTranscribing(true);
      const timedWords = await generateTranscript(extractedBlob);
      setTranscript(timedWords);
      console.log('Trascrizione completata con successo:', timedWords.length, 'parole/token');
    } catch (err) {
      console.error("Errore durante l'elaborazione del video:", err);
    } finally {
      setIsExtractingAudio(false);
      setIsTranscribing(false);
    }
  };

  const handleSaveVersionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    saveVersion(newVersionName.trim());
    setNewVersionName('');
    setShowNewVersionInput(false);
    setShowVersionsMenu(false);
  };

  const currentVersion = versions[activeVersionId] || { name: 'V1 - Bozza Iniziale' };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none relative">
      {/* Input File Nascosto per Caricamento Video */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
        className="hidden"
      />

      {/* Header NLE */}
      <header className="h-12 border-b border-neutral-800 bg-neutral-900/90 px-4 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            AI
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-neutral-200">
              AI Video Editor
            </h1>
          </div>
          <span className="text-neutral-600">/</span>

          {/* Menu Dropdown Versioning (Task 7) */}
          <div className="relative">
            <button
              onClick={() => setShowVersionsMenu(!showVersionsMenu)}
              className="flex items-center space-x-1.5 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-cyan-300 border border-neutral-700 cursor-pointer"
            >
              <span>📑 {currentVersion.name}</span>
              <span className="text-[9px] text-neutral-400">▼</span>
            </button>

            {showVersionsMenu && (
              <div className="absolute top-8 left-0 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-2 z-50 space-y-2 text-xs">
                <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1">
                  Versioni Salvate
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {Object.values(versions).map((ver) => (
                    <button
                      key={ver.id}
                      onClick={() => {
                        switchVersion(ver.id);
                        setShowVersionsMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        ver.id === activeVersionId
                          ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800'
                          : 'hover:bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      <span className="truncate">{ver.name}</span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {ver.targetAspectRatio}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-neutral-800">
                  {showNewVersionInput ? (
                    <form onSubmit={handleSaveVersionSubmit} className="space-y-1.5 p-1">
                      <input
                        type="text"
                        value={newVersionName}
                        onChange={(e) => setNewVersionName(e.target.value)}
                        placeholder="Nome es. V2 - Solo Tagli AI..."
                        autoFocus
                        className="w-full px-2 py-1 text-xs bg-neutral-950 border border-neutral-700 rounded text-neutral-200 focus:outline-none focus:border-cyan-500"
                      />
                      <div className="flex justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => setShowNewVersionInput(false)}
                          className="px-2 py-0.5 rounded text-[10px] text-neutral-400 hover:text-white"
                        >
                          Annulla
                        </button>
                        <button
                          type="submit"
                          className="px-2 py-0.5 rounded text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                        >
                          Salva
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowNewVersionInput(true)}
                      className="w-full text-center py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-cyan-400 font-medium text-xs cursor-pointer"
                    >
                      + Salva Nuova Versione
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pulsante Creator Profile (Task 7) */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-xs border border-neutral-700/60 cursor-pointer"
          >
            <span>👤</span>
            <span className="font-mono text-[11px]">{creatorProfile.format} ({creatorProfile.pacing})</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {/* Status Estrazione Audio / Trascrizione */}
          {isExtractingAudio ? (
            <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-mono text-[11px] border border-amber-700/60 animate-pulse">
              ⏳ Estrazione audio 16kHz...
            </span>
          ) : isTranscribing ? (
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-mono text-[11px] border border-cyan-700/60 animate-pulse">
              ✨ Trascrizione Gemini in corso...
            </span>
          ) : uploadedFile ? (
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-mono text-[11px] border border-emerald-700/60">
              🎙️ Trascrizione pronta ({project.transcript.words.length} segmenti)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-neutral-800/80 text-neutral-400 font-mono text-[11px] border border-neutral-700/60">
              Caso Studio Demo
            </span>
          )}

          {/* Pulsante Carica Video */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExportingMP4}
            className="px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white font-medium transition-colors border border-cyan-600 flex items-center space-x-1.5 cursor-pointer text-xs"
          >
            <span>📁</span>
            <span>Carica Video</span>
          </button>

          {/* Pulsante Esporta EDL */}
          <button
            onClick={handleExportEDL}
            disabled={isExportingMP4}
            className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 font-medium transition-colors border border-neutral-700 flex items-center space-x-1.5 cursor-pointer text-xs"
          >
            <span>📄</span>
            <span>Esporta EDL</span>
          </button>

          {/* Pulsante Esporta MP4 (Task 5) */}
          <button
            onClick={handleExportMP4}
            disabled={isExportingMP4}
            className="px-3 py-1.5 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-semibold transition-all shadow-md shadow-emerald-900/30 flex items-center space-x-1.5 cursor-pointer text-xs border border-emerald-500"
          >
            <span>⬇️</span>
            <span>Esporta MP4</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Layout a 3 Colonne Desktop NLE */}
      <main className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* Colonna Sinistra (Video & Timeline) - 5 colonne */}
        <section className="col-span-12 lg:col-span-5 flex flex-col space-y-3 h-full overflow-hidden">
          <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800/70 text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300">Live Preview Player</span>
              <span className="text-[11px] text-cyan-400 font-mono">Web Audio Anti-Pop + Ducking Active</span>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <VideoPlayer className="w-full h-full shadow-lg" />
            </div>
          </div>

          {/* Timeline orizzontale posizionata sotto il player */}
          <div className="shrink-0">
            <VisualTimeline />
          </div>
        </section>

        {/* Colonna Centrale (Interactive Transcript) - 4 colonne */}
        <section className="col-span-12 lg:col-span-4 h-full overflow-hidden">
          <TranscriptView />
        </section>

        {/* Colonna Destra (Approval Center) - 3 colonne */}
        <section className="col-span-12 lg:col-span-3 h-full overflow-hidden">
          <ApprovalCenter />
        </section>
      </main>

      {/* Barra Inferiore Fissa (Spotlight AI Command Bar) */}
      <footer className="shrink-0">
        <CommandBar />
      </footer>

      {/* Modal Creator Profile (Task 7) */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center space-x-2">
                <span className="text-xl">👤</span>
                <h3 className="text-sm font-bold text-neutral-100">Creator Profile & Project Memory</h3>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Queste impostazioni vengono iniettate nel System Prompt di Gemini per personalizzare l'Edit Plan secondo il tuo stile di montaggio.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Formato Contenuto</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Vlog', 'Tutorial', 'Podcast', 'Shorts'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setCreatorProfile({ format: fmt })}
                      className={`py-1.5 px-2 rounded font-mono text-center cursor-pointer transition-all border ${
                        creatorProfile.format === fmt
                          ? 'bg-cyan-600 text-white font-semibold border-cyan-500'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Ritmo di Montaggio (Pacing)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Dynamic', 'Natural', 'Relaxed'] as const).map((pace) => (
                    <button
                      key={pace}
                      type="button"
                      onClick={() => setCreatorProfile({ pacing: pace })}
                      className={`py-1.5 px-2 rounded font-mono text-center cursor-pointer transition-all border ${
                        creatorProfile.pacing === pace
                          ? 'bg-cyan-600 text-white font-semibold border-cyan-500'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                      }`}
                    >
                      {pace}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Soglia Massima Silenzio Tollerato: <span className="text-cyan-400 font-mono">{creatorProfile.maxSilence}s</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0.8, 1.2, 1.5, 2.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setCreatorProfile({ maxSilence: sec })}
                      className={`py-1.5 px-2 rounded font-mono text-center cursor-pointer transition-all border ${
                        creatorProfile.maxSilence === sec
                          ? 'bg-cyan-600 text-white font-semibold border-cyan-500'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-neutral-300">Rimuovi Intercalari ed Esitazioni ('ehm', 'mmm')</span>
                <button
                  type="button"
                  onClick={() => setCreatorProfile({ removeFillers: !creatorProfile.removeFillers })}
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer border ${
                    creatorProfile.removeFillers
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {creatorProfile.removeFillers ? 'ATTIVO ✓' : 'DISATTIVO'}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs cursor-pointer shadow"
              >
                Conferma Profilo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Overlay di Progresso Rendering FFmpeg.wasm */}
      {isExportingMP4 && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-950/80 border border-emerald-600 flex items-center justify-center text-2xl text-emerald-400 animate-pulse">
              ⚡
            </div>

            <div>
              <h3 className="text-base font-bold text-neutral-100">
                Rendering Video in corso nel Browser
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                FFmpeg.wasm sta applicando i tagli fisicamente sul tuo dispositivo senza inviare file al server.
              </p>
            </div>

            {/* Barra di Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-neutral-300">
                <span>{exportStatusText}</span>
                <span className="font-bold text-emerald-400">{exportProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                <div
                  style={{ width: `${exportProgress}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                ></div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 font-mono">
              Non chiudere la scheda del browser durante l'elaborazione.
            </div>
          </div>
        </div>
      )}

      {/* Notifica di Errore Render */}
      {exportError && (
        <div className="absolute top-16 right-6 max-w-md bg-red-950/90 border border-red-700 rounded-lg p-4 shadow-xl z-50 text-xs text-red-200 space-y-2">
          <div className="flex items-center justify-between font-bold text-red-300">
            <span>Avviso Esportazione</span>
            <button
              onClick={() => setExportError(null)}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p>{exportError}</p>
        </div>
      )}
    </div>
  );
}
