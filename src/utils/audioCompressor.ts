/**
 * Client-side Audio Compressor & Extractor
 * Automatically converts any video (MP4, MOV, MKV, AVI) or audio file to a lightweight 16kHz Mono WAV Blob.
 * Reduces 500MB video files down to ~1.5MB audio Blobs in seconds directly in the browser!
 */
export const extractAudioFromMediaFile = async (
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ blob: Blob; originalSizeMB: string; compressedSizeMB: string; ratio: string }> => {
  const originalSizeMB = (file.size / (1024 * 1024)).toFixed(1);

  if (onProgress) onProgress(15);

  // If already a small audio file under 3MB, return directly
  if (file.type.startsWith('audio/') && file.size < 3 * 1024 * 1024) {
    const compressedSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { blob: file, originalSizeMB, compressedSizeMB, ratio: '0' };
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx({ sampleRate: 16000 });
    const arrayBuffer = await file.arrayBuffer();

    if (onProgress) onProgress(35);

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    if (onProgress) onProgress(60);

    const channelData = audioBuffer.getChannelData(0); // Take first channel (mono)
    const numSamples = channelData.length;

    // Target maximum samples to ensure WAV blob stays under 2.5 MB (Base64 < 3.4 MB, below Vercel 4.5 MB limit)
    const MAX_ALLOWED_SAMPLES = 1250000;
    const step = Math.max(1, Math.ceil(numSamples / MAX_ALLOWED_SAMPLES));
    const targetSampleRate = Math.round(16000 / step);
    const outputSamples = Math.floor(numSamples / step);

    // Build PCM WAV ArrayBuffer with dynamic downsampling
    const wavBuffer = new ArrayBuffer(44 + outputSamples * 2);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + outputSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // Linear PCM
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, targetSampleRate, true); // Dynamic Sample rate (16000, 8000, 4000 Hz)
    view.setUint32(28, targetSampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    writeString(36, 'data');
    view.setUint32(40, outputSamples * 2, true);

    // Write PCM 16-bit samples with step downsampling
    let offset = 44;
    for (let i = 0; i < numSamples && offset < wavBuffer.byteLength; i += step) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    if (onProgress) onProgress(80);

    const compressedBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const compressedSizeMB = (compressedBlob.size / (1024 * 1024)).toFixed(1);
    const ratioNum = Math.max(0, 100 - (compressedBlob.size / file.size) * 100).toFixed(1);

    return {
      blob: compressedBlob,
      originalSizeMB,
      compressedSizeMB,
      ratio: ratioNum
    };
  } catch (err) {
    console.warn('Direct AudioContext extraction failed, falling back to original file:', err);
    return {
      blob: file,
      originalSizeMB,
      compressedSizeMB: originalSizeMB,
      ratio: '0'
    };
  }
};
