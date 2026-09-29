/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- TIPI BASE ---
export type WordType = 'speech' | 'silence' | 'filler' | 'sound_effect';
export type ApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type OperationSource = 'AI_AUTO' | 'USER_DIRECTED' | 'MANUAL';

export interface TimedWord {
  id: string;          // es. "w_0", "w_1"
  text: string;
  start: number;       // Secondi float (es. 5.500)
  end: number;         // Secondi float (es. 6.000)
  confidence: number;  // 0.0 - 1.0
  type: WordType;
}

export type OperationType =
  | 'silence'
  | 'hesitation'
  | 'false_start'
  | 'manual_cut'
  | 'stock_video'
  | 'image'
  | 'screen_recording'
  | 'highlight';

export interface EditOperation {
  id: string;
  operation: 'REMOVE' | 'KEEP' | 'B_ROLL';
  type: OperationType;
  start: number;
  end: number;
  targetWordIds: string[];
  source: OperationSource;
  status: ApprovalStatus;
  confidence: number;
  reason: string;
  createdAt: number;
  assetUrl?: string;
  assetTitle?: string;
}

export interface PlayableSegment {
  start: number;
  end: number;
  originalStart: number;
  originalEnd: number;
}

export interface MediaMetadata {
  sourceUrl: string;
  duration: number;
  width: number;
  height: number;
  title?: string;
}

export interface EditorProject {
  id: string;
  title: string;
  media: MediaMetadata;
  transcript: {
    words: TimedWord[];
    rawText: string;
  };
  operations: EditOperation[];
}

export interface CreatorProfile {
  format: 'Vlog' | 'Tutorial' | 'Podcast' | 'Shorts';
  pacing: 'Dynamic' | 'Natural' | 'Relaxed';
  maxSilence: number; // e.g. 1.2s
  removeFillers: boolean;
}

export interface TimelineVersion {
  id: string;
  name: string;
  createdAt: number;
  operations: EditOperation[];
  targetAspectRatio: '16:9' | '9:16';
}
