/**
 * Audio Extractor Client-Side
 * Estrae la traccia audio da un file video nel browser e la ricampiona a 16kHz mono (WAV).
 */

export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  const arrayBuffer = await videoFile.arrayBuffer();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtx();

  // Decodifica l'audio del video
  const decodedAudio = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();

  // Target: 16000 Hz, 1 canale (mono) per minimizzare il payload
  const targetSampleRate = 16000;
  const duration = decodedAudio.duration;
  const targetLength = Math.ceil(duration * targetSampleRate);

  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = decodedAudio;
  sourceNode.connect(offlineCtx.destination);
  sourceNode.start(0);

  // Esegue il rendering offline del ricampionamento
  const renderedBuffer = await offlineCtx.startRendering();
  const monoChannelData = renderedBuffer.getChannelData(0);

  // Converti i campioni PCM Float32 in file WAV (16-bit PCM, 16kHz, mono)
  return encodeWAV(monoChannelData, targetSampleRate);
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // Helper per scrivere stringhe ASCII
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // 1. RIFF Identifier
  writeString(0, 'RIFF');
  // RIFF chunk length (file length - 8)
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF Type
  writeString(8, 'WAVE');

  // 2. Format Chunk
  writeString(12, 'fmt ');
  // format chunk length (16 per PCM)
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * channels * bytesPerSample)
  view.setUint32(28, sampleRate * 1 * 2, true);
  // block align (channels * bytesPerSample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);

  // 3. Data Chunk
  writeString(36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Scrivi campioni PCM a 16-bit
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
