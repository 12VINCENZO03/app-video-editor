/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditOperation, PlayableSegment } from '../types/editor.ts';

/**
 * Calcola i segmenti attivi da riprodurre (Virtual Timeline)
 * unendo e invertendo i tagli (REMOVE) che si trovano nello stato APPROVED.
 */
export function computePlayableSegments(
  totalDuration: number,
  operations: EditOperation[]
): PlayableSegment[] {
  // 1. Isola i tagli effettivamente approvati
  const approvedCuts = operations
    .filter((op) => op.operation === 'REMOVE' && op.status === 'APPROVED')
    .sort((a, b) => a.start - b.start);

  // 2. Unisci tagli sovrapposti o adiacenti (< 0.05s)
  const mergedCuts: { start: number; end: number }[] = [];
  for (const cut of approvedCuts) {
    if (mergedCuts.length === 0) {
      mergedCuts.push({ start: cut.start, end: cut.end });
      continue;
    }
    const last = mergedCuts[mergedCuts.length - 1];
    if (cut.start <= last.end + 0.05) {
      last.end = Math.max(last.end, cut.end);
    } else {
      mergedCuts.push({ start: cut.start, end: cut.end });
    }
  }

  // 3. Inverti: estrai i blocchi da riprodurre
  const keepSegments: PlayableSegment[] = [];
  let cursor = 0.0;

  for (const cut of mergedCuts) {
    if (cut.start > cursor) {
      keepSegments.push({
        start: cursor,
        end: cut.start,
        originalStart: cursor,
        originalEnd: cut.start,
      });
    }
    cursor = Math.max(cursor, cut.end);
  }

  if (cursor < totalDuration) {
    keepSegments.push({
      start: cursor,
      end: totalDuration,
      originalStart: cursor,
      originalEnd: totalDuration,
    });
  }

  return keepSegments;
}

/**
 * Calcola la durata totale montata sommando tutti i segmenti riproducibili.
 */
export function computeVirtualDuration(segments: PlayableSegment[]): number {
  return segments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
}

/**
 * Esporta la sequenza dei segmenti approvati in formato CMX 3600 EDL standard
 * compatibile con DaVinci Resolve, Adobe Premiere Pro e Final Cut Pro.
 */
export function exportToCMX3600EDL(
  projectName: string,
  keepSegments: PlayableSegment[]
): string {
  let edl = `TITLE: ${projectName}\nFCM: NON-DROP FRAME\n\n`;

  let virtualCursor = 0.0;

  keepSegments.forEach((seg, index) => {
    const editNum = String(index + 1).padStart(3, '0');
    const duration = seg.originalEnd - seg.originalStart;
    const srcIn = formatTimecode(seg.originalStart);
    const srcOut = formatTimecode(seg.originalEnd);
    const recIn = formatTimecode(virtualCursor);
    const recOut = formatTimecode(virtualCursor + duration);

    edl += `${editNum}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}\n`;
    edl += `* FROM CLIP NAME: master_video.mp4\n\n`;

    virtualCursor += duration;
  });

  return edl;
}

function formatTimecode(seconds: number): string {
  const fps = 30;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * fps);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
