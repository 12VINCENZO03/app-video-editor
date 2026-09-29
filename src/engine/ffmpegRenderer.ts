import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { PlayableSegment } from '../types/editor';

let ffmpegInstance: FFmpeg | null = null;

/**
 * Inizializza o restituisce l'istanza singleton di FFmpeg caricando i binary WebAssembly
 */
export async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  // Caricamento del core WebAssembly da CDN affidabile con toBlobURL per conformità CSP/CORS
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Esegue il montaggio fisico del video tagliato tramite FFmpeg.wasm nel browser dell'utente.
 * Itera sui segmenti autorizzati (keepSegments), estrae le porzioni e le unisce senza toccare alcun server.
 */
export async function exportFinalVideo(
  videoFile: File | Blob,
  keepSegments: PlayableSegment[],
  onProgress: (progress: number) => void
): Promise<string> {
  if (!keepSegments || keepSegments.length === 0) {
    throw new Error('Nessun segmento valido da renderizzare.');
  }

  onProgress(5);

  // 1. Inizializza FFmpeg
  const ffmpeg = await getFFmpeg();
  onProgress(15);

  // 2. Scrivi il file video sorgente nel virtual file system
  const inputData = await fetchFile(videoFile);
  await ffmpeg.writeFile('input.mp4', inputData);
  onProgress(25);

  // 3. Taglia ogni segmento attivo
  const segmentFiles: string[] = [];
  const totalSegments = keepSegments.length;

  for (let i = 0; i < totalSegments; i++) {
    const seg = keepSegments[i];
    const segmentName = `part_${i}.mp4`;
    segmentFiles.push(segmentName);

    const startSec = Math.max(0, seg.start).toFixed(3);
    const endSec = Math.max(seg.start + 0.05, seg.end).toFixed(3);

    // Esegui taglio ad alta precisione temporale con re-encoding rapido ultrafast
    await ffmpeg.exec([
      '-ss',
      startSec,
      '-to',
      endSec,
      '-i',
      'input.mp4',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-c:a',
      'aac',
      '-avoid_negative_ts',
      'make_zero',
      segmentName,
    ]);

    // Avanzamento progressivo tra il 25% e il 80%
    const currentProgress = 25 + Math.round(((i + 1) / totalSegments) * 55);
    onProgress(currentProgress);
  }

  // 4. Crea il file list.txt per il demuxer concat
  const listContent = segmentFiles.map((filename) => `file '${filename}'`).join('\n');
  await ffmpeg.writeFile('list.txt', listContent);
  onProgress(85);

  // 5. Unisci le clip tagliate usando il concat demuxer
  await ffmpeg.exec([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'list.txt',
    '-c',
    'copy',
    'output.mp4',
  ]);
  onProgress(95);

  // 6. Leggi il video montato finale da virtual FS
  const outputData = await ffmpeg.readFile('output.mp4');

  // Pulizia file temporanei per non saturare la memoria del virtual FS
  try {
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('list.txt');
    await ffmpeg.deleteFile('output.mp4');
    for (const f of segmentFiles) {
      await ffmpeg.deleteFile(f);
    }
  } catch (cleanErr) {
    console.warn('Pulizia virtual FS completata con qualche file già rimosso:', cleanErr);
  }

  onProgress(100);

  // Crea e restituisci il Blob URL del file MP4 montato
  const uint8 =
    outputData instanceof Uint8Array
      ? new Uint8Array(outputData)
      : new TextEncoder().encode(outputData);
  const finalBlob = new Blob([uint8], { type: 'video/mp4' });

  return URL.createObjectURL(finalBlob);
}
