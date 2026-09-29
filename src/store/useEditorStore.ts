/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import {
  EditorProject,
  EditOperation,
  PlayableSegment,
  TimedWord,
  CreatorProfile,
  TimelineVersion,
} from '../types/editor.ts';
import { computePlayableSegments } from '../engine/virtualTimeline.ts';

export const DEFAULT_CREATOR_PROFILE: CreatorProfile = {
  format: 'Vlog',
  pacing: 'Dynamic',
  maxSilence: 1.5,
  removeFillers: true,
};

const INITIAL_VERSION_ID = 'ver_1';

// --- CASO STUDIO DEMO (FASE 1 / TASK 1) ---
const DEMO_WORDS: TimedWord[] = [
  {
    id: 'w_0',
    text: 'Ciao a tutti ragazzi e benvenuti in questo...',
    start: 0.0,
    end: 3.0,
    confidence: 0.98,
    type: 'speech',
  },
  {
    id: 'w_1',
    text: '[PAUSA 2.5s]',
    start: 3.0,
    end: 5.5,
    confidence: 1.0,
    type: 'silence',
  },
  {
    id: 'w_2',
    text: '...ehm',
    start: 5.5,
    end: 6.0,
    confidence: 0.92,
    type: 'filler',
  },
  {
    id: 'w_3',
    text: 'nuovo video.',
    start: 6.0,
    end: 7.0,
    confidence: 0.97,
    type: 'speech',
  },
  {
    id: 'w_4',
    text: '[PAUSA 0.5s]',
    start: 7.0,
    end: 7.5,
    confidence: 1.0,
    type: 'silence',
  },
  {
    id: 'w_5',
    text: 'Oggi parleremo di una cosa incredibile.',
    start: 7.5,
    end: 10.0,
    confidence: 0.95,
    type: 'speech',
  },
  {
    id: 'w_6',
    text: 'In realtà, no aspetta, ricominciamo.',
    start: 10.0,
    end: 13.0,
    confidence: 0.96,
    type: 'speech',
  },
  {
    id: 'w_7',
    text: '[PAUSA 1.0s]',
    start: 13.0,
    end: 14.0,
    confidence: 1.0,
    type: 'silence',
  },
  {
    id: 'w_8',
    text: 'Oggi vi mostrerò come programmare un AI video editor da zero.',
    start: 14.0,
    end: 18.0,
    confidence: 0.99,
    type: 'speech',
  },
];

const DEMO_OPERATIONS: EditOperation[] = [
  {
    id: 'op_1',
    operation: 'REMOVE',
    type: 'silence',
    start: 3.0,
    end: 5.5,
    targetWordIds: ['w_1'],
    source: 'AI_AUTO',
    status: 'PENDING_APPROVAL',
    confidence: 0.95,
    reason: 'Pausa prolungata di 2.5s',
    createdAt: 1727580000000,
  },
  {
    id: 'op_2',
    operation: 'REMOVE',
    type: 'hesitation',
    start: 5.5,
    end: 6.0,
    targetWordIds: ['w_2'],
    source: 'AI_AUTO',
    status: 'PENDING_APPROVAL',
    confidence: 0.90,
    reason: "Esitazione verbale 'ehm'",
    createdAt: 1727580001000,
  },
  {
    id: 'op_3',
    operation: 'KEEP',
    type: 'silence',
    start: 7.0,
    end: 7.5,
    targetWordIds: ['w_4'],
    source: 'AI_AUTO',
    status: 'PENDING_APPROVAL',
    confidence: 0.85,
    reason: 'Pausa fisiologica 0.5s',
    createdAt: 1727580002000,
  },
  {
    id: 'op_4',
    operation: 'REMOVE',
    type: 'false_start',
    start: 7.5,
    end: 13.0,
    targetWordIds: ['w_5', 'w_6'],
    source: 'AI_AUTO',
    status: 'PENDING_APPROVAL',
    confidence: 0.98,
    reason: 'Interruzione esplicita con riavvio',
    createdAt: 1727580003000,
  },
  {
    id: 'op_5',
    operation: 'REMOVE',
    type: 'silence',
    start: 13.0,
    end: 14.0,
    targetWordIds: ['w_7'],
    source: 'AI_AUTO',
    status: 'PENDING_APPROVAL',
    confidence: 0.90,
    reason: 'Pausa preparatoria pre-ripartenza',
    createdAt: 1727580004000,
  },
  {
    id: 'op_broll_1',
    operation: 'B_ROLL',
    type: 'stock_video',
    start: 14.5,
    end: 17.5,
    targetWordIds: ['w_8'],
    source: 'AI_AUTO',
    status: 'APPROVED',
    confidence: 0.96,
    reason: 'Copertura video B-Roll su concetto di coding AI',
    assetTitle: 'Cyber Coding & AI Visualization',
    assetUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    createdAt: 1727580005000,
  },
];

const INITIAL_PROJECT: EditorProject = {
  id: 'proj_demo_01',
  title: 'AI Video Editor Demo - Introduzione Canale',
  media: {
    sourceUrl: '', // Il player utilizzerà un canvas animato sintetico o un video locale
    duration: 18.0,
    width: 1920,
    height: 1080,
    title: 'master_video.mp4',
  },
  transcript: {
    words: DEMO_WORDS,
    rawText: DEMO_WORDS.map((w) => w.text).join(' '),
  },
  operations: DEMO_OPERATIONS,
};

// --- INTERFACCIA DELLO STORE ZUSTAND ---
export interface EditorStoreState {
  // Progetto e Dati
  project: EditorProject;

  // Stato di Riproduzione
  currentTime: number;
  isPlaying: boolean;
  seekTarget: number | null;

  // Segmenti riproducibili calcolati al volo
  playableSegments: PlayableSegment[];

  // Stato File, Audio e Analisi AI
  uploadedFile: File | null;
  audioBlob: Blob | null;
  isAnalyzing: boolean;
  isExtractingAudio: boolean;
  isTranscribing: boolean;

  // Stato Formato Video (16:9 Landscape vs 9:16 Shorts)
  targetAspectRatio: '16:9' | '9:16';
  setTargetAspectRatio: (ratio: '16:9' | '9:16') => void;

  // Musica di Sottofondo e Audio Ducking
  musicTrack: Blob | null;
  isMusicEnabled: boolean;
  setMusicTrack: (blob: Blob | null) => void;
  setIsMusicEnabled: (enabled: boolean) => void;
  toggleMusic: () => void;

  // Creator Profile e Project Memory
  creatorProfile: CreatorProfile;
  setCreatorProfile: (profile: Partial<CreatorProfile>) => void;

  // Sistema di Versioning (Snapshot State)
  versions: Record<string, TimelineVersion>;
  activeVersionId: string;
  saveVersion: (name: string) => void;
  switchVersion: (id: string) => void;

  // Action richieste dal Task 1
  approveOperation: (id: string) => void;
  rejectOperation: (id: string) => void;
  approveAll: () => void;
  rejectAll: () => void;
  seekTo: (seconds: number) => void;

  // Action di supporto e Task 4/5/6/7
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  clearSeekTarget: () => void;
  resetDemoData: () => void;
  setUploadedFile: (file: File | null) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setIsExtractingAudio: (isExtracting: boolean) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setVideoSource: (url: string, title?: string, duration?: number) => void;
  setTranscript: (words: TimedWord[]) => void;
  addOperations: (newOps: EditOperation[]) => void;
}

export const useEditorStore = create<EditorStoreState>((set, get) => {
  const initialSegments = computePlayableSegments(
    INITIAL_PROJECT.media.duration,
    INITIAL_PROJECT.operations
  );

  const initialVersions: Record<string, TimelineVersion> = {
    [INITIAL_VERSION_ID]: {
      id: INITIAL_VERSION_ID,
      name: 'V1 - Bozza Iniziale',
      createdAt: Date.now(),
      operations: INITIAL_PROJECT.operations.map((op) => ({ ...op })),
      targetAspectRatio: '16:9',
    },
  };

  return {
    project: INITIAL_PROJECT,
    targetAspectRatio: '16:9',
    currentTime: 0.0,
    isPlaying: false,
    seekTarget: null,
    playableSegments: initialSegments,
    uploadedFile: null,
    audioBlob: null,
    isAnalyzing: false,
    isExtractingAudio: false,
    isTranscribing: false,

    // Musica & Ducking
    musicTrack: null,
    isMusicEnabled: false,

    // Creator Profile
    creatorProfile: DEFAULT_CREATOR_PROFILE,

    // Versioning
    versions: initialVersions,
    activeVersionId: INITIAL_VERSION_ID,

    // Approva una singola operazione (es. convalida un taglio REMOVE proposto dall'AI)
    approveOperation: (id: string) => {
      set((state) => {
        const updatedOps = state.project.operations.map((op) =>
          op.id === id ? { ...op, status: 'APPROVED' as const } : op
        );

        const newSegments = computePlayableSegments(
          state.project.media.duration,
          updatedOps
        );

        return {
          project: {
            ...state.project,
            operations: updatedOps,
          },
          playableSegments: newSegments,
        };
      });
    },

    // Rifiuta una singola operazione (il segmento NON verrà rimosso)
    rejectOperation: (id: string) => {
      set((state) => {
        const updatedOps = state.project.operations.map((op) =>
          op.id === id ? { ...op, status: 'REJECTED' as const } : op
        );

        const newSegments = computePlayableSegments(
          state.project.media.duration,
          updatedOps
        );

        return {
          project: {
            ...state.project,
            operations: updatedOps,
          },
          playableSegments: newSegments,
        };
      });
    },

    // Approva in batch tutte le operazioni in stato PENDING_APPROVAL
    approveAll: () => {
      set((state) => {
        const updatedOps = state.project.operations.map((op) =>
          op.status === 'PENDING_APPROVAL' ? { ...op, status: 'APPROVED' as const } : op
        );

        const newSegments = computePlayableSegments(
          state.project.media.duration,
          updatedOps
        );

        return {
          project: {
            ...state.project,
            operations: updatedOps,
          },
          playableSegments: newSegments,
        };
      });
    },

    // Rifiuta in batch tutte le operazioni in stato PENDING_APPROVAL
    rejectAll: () => {
      set((state) => {
        const updatedOps = state.project.operations.map((op) =>
          op.status === 'PENDING_APPROVAL' ? { ...op, status: 'REJECTED' as const } : op
        );

        const newSegments = computePlayableSegments(
          state.project.media.duration,
          updatedOps
        );

        return {
          project: {
            ...state.project,
            operations: updatedOps,
          },
          playableSegments: newSegments,
        };
      });
    },

    // Sposta il cursore di riproduzione temporale (seek)
    seekTo: (seconds: number) => {
      const clamped = Math.max(0, Math.min(seconds, get().project.media.duration));
      set({
        currentTime: clamped,
        seekTarget: clamped,
      });
    },

    setCurrentTime: (time: number) => {
      set({ currentTime: time });
    },

    setIsPlaying: (isPlaying: boolean) => {
      set({ isPlaying });
    },

    clearSeekTarget: () => {
      set({ seekTarget: null });
    },

    setTargetAspectRatio: (ratio: '16:9' | '9:16') => {
      set({ targetAspectRatio: ratio });
    },

    setUploadedFile: (file: File | null) => {
      set({ uploadedFile: file });
    },

    setAudioBlob: (blob: Blob | null) => {
      set({ audioBlob: blob });
    },

    setIsAnalyzing: (isAnalyzing: boolean) => {
      set({ isAnalyzing });
    },

    setIsExtractingAudio: (isExtracting: boolean) => {
      set({ isExtractingAudio: isExtracting });
    },

    setIsTranscribing: (isTranscribing: boolean) => {
      set({ isTranscribing });
    },

    setTranscript: (words: TimedWord[]) => {
      set((state) => {
        const rawText = words.map((w) => w.text).join(' ');
        const lastWord = words[words.length - 1];
        const calculatedDuration = lastWord
          ? Math.max(state.project.media.duration, lastWord.end)
          : state.project.media.duration;

        return {
          project: {
            ...state.project,
            media: {
              ...state.project.media,
              duration: calculatedDuration,
            },
            transcript: {
              words,
              rawText,
            },
            // Pulisci le vecchie operazioni (svuota l'Approval Center)
            operations: [],
          },
          currentTime: 0.0,
          seekTarget: 0.0,
          playableSegments: computePlayableSegments(calculatedDuration, []),
        };
      });
    },

    setVideoSource: (url: string, title?: string, duration?: number) => {
      set((state) => {
        const newDuration = duration !== undefined ? duration : state.project.media.duration;
        return {
          project: {
            ...state.project,
            title: title || state.project.title,
            media: {
              ...state.project.media,
              sourceUrl: url,
              duration: newDuration,
              title: title || state.project.media.title,
            },
          },
          currentTime: 0,
          seekTarget: 0,
          playableSegments: computePlayableSegments(
            newDuration,
            state.project.operations
          ),
        };
      });
    },

    addOperations: (newOps: EditOperation[]) => {
      set((state) => {
        // Unisci mantenendo le operazioni manuali e aggiungendo le nuove AI
        const existingIds = new Set(newOps.map((o) => o.id));
        const merged = [
          ...newOps,
          ...state.project.operations.filter((o) => !existingIds.has(o.id)),
        ];

        return {
          project: {
            ...state.project,
            operations: merged,
          },
          playableSegments: computePlayableSegments(
            state.project.media.duration,
            merged
          ),
        };
      });
    },

    // Musica & Ducking
    setMusicTrack: (blob: Blob | null) => {
      set({ musicTrack: blob });
    },

    setIsMusicEnabled: (enabled: boolean) => {
      set({ isMusicEnabled: enabled });
    },

    toggleMusic: () => {
      set((state) => ({ isMusicEnabled: !state.isMusicEnabled }));
    },

    // Creator Profile
    setCreatorProfile: (profile: Partial<CreatorProfile>) => {
      set((state) => ({
        creatorProfile: {
          ...state.creatorProfile,
          ...profile,
        },
      }));
    },

    // Versioning
    saveVersion: (name: string) => {
      set((state) => {
        const id = `ver_${Date.now()}`;
        const newVersion: TimelineVersion = {
          id,
          name: name.trim() || `Versione ${Object.keys(state.versions).length + 1}`,
          createdAt: Date.now(),
          operations: state.project.operations.map((op) => ({ ...op })),
          targetAspectRatio: state.targetAspectRatio,
        };

        return {
          versions: {
            ...state.versions,
            [id]: newVersion,
          },
          activeVersionId: id,
        };
      });
    },

    switchVersion: (id: string) => {
      set((state) => {
        const targetVersion = state.versions[id];
        if (!targetVersion) return state;

        const clonedOps = targetVersion.operations.map((op) => ({ ...op }));
        const newSegments = computePlayableSegments(
          state.project.media.duration,
          clonedOps
        );

        return {
          activeVersionId: id,
          targetAspectRatio: targetVersion.targetAspectRatio,
          project: {
            ...state.project,
            operations: clonedOps,
          },
          playableSegments: newSegments,
          currentTime: 0.0,
          seekTarget: 0.0,
        };
      });
    },

    resetDemoData: () => {
      const resetOps = DEMO_OPERATIONS.map((op) => ({ ...op }));
      set({
        project: {
          ...INITIAL_PROJECT,
          operations: resetOps,
        },
        currentTime: 0.0,
        isPlaying: false,
        seekTarget: 0.0,
        playableSegments: computePlayableSegments(
          INITIAL_PROJECT.media.duration,
          resetOps
        ),
      });
    },
  };
});
