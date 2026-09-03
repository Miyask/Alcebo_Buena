import React, { useState, useEffect, useRef } from 'react';
import { Quote, SystemConfig } from '../types';
import { extractAudioChunksFromMediaFile } from '../utils/audioCompressor';

interface DashboardViewProps {
  onAddQuote: (newQuote: Quote) => void;
  config: SystemConfig;
}

// Keyword-based fallback for the diagnosis "zonas afectadas" phrase, used whenever the AI didn't
// return one (e.g. no LLM key configured, or the call failed).
const ZONA_KEYWORDS = [
  'placas solares', 'panel solar', 'paneles solares', 'cornisas superiores', 'cornisas', 'aleros',
  'tejado', 'tejados', 'canalones', 'canalón', 'balcones', 'balcón', 'azotea', 'terrazas', 'terraza',
  'ventanas', 'chimeneas', 'antenas', 'antena', 'fachada', 'repisas', 'alféizares', 'buhardilla', 'patio'
];
const extractZonasFromText = (text: string): string | null => {
  if (!text) return null;
  const lower = text.toLowerCase();
  const found: string[] = [];
  ZONA_KEYWORDS.forEach(kw => {
    if (lower.includes(kw) && !found.some(f => f.includes(kw) || kw.includes(f))) {
      found.push(kw);
    }
  });
  if (found.length === 0) return null;
  return found.slice(0, 3).join(' y ');
};

export default function DashboardView({ onAddQuote, config }: DashboardViewProps) {
  // Wizard States
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string>('');
  const [isEditingText, setIsEditingText] = useState<boolean>(false);

  // Extracted parameters
  const [detectedBirds, setDetectedBirds] = useState<string[]>([]);
  const [detectedSystems, setDetectedSystems] = useState<string[]>([]);
  const [meters, setMeters] = useState<number>(15); // default 15

  // Form states
  const [clientName, setClientName] = useState<string>('');
  const [clientAddress, setClientAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [aiData, setAiData] = useState<any>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBlank = () => {
    const blankQuote: Quote = {
      id: 'q-' + Date.now(),
      title: 'Nuevo Presupuesto',
      date: new Date().toISOString().split('T')[0],
      status: 'Borrador',
      text: '',
      birds: ['Palomas'],
      systems: ['Red'],
      estimationLineal: 15,
      totalCost: 525.00,
      clientName: '',
      clientAddress: '',
      notes: 'Presupuesto creado en blanco sin transcripción de vídeo.',
      images: []
    };
    onAddQuote(blankQuote);
  };

  // Run the regex-based automatic extraction on transcription change
  useEffect(() => {
    if (!transcription) return;

    const textLower = transcription.toLowerCase();

    // 1. Bird detection
    const birds: string[] = [];
    if (textLower.includes('paloma')) birds.push('Palomas');
    if (textLower.includes('golondrina')) birds.push('Golondrinas');
    if (textLower.includes('avión') || textLower.includes('avion')) birds.push('Avión Común');
    if (textLower.includes('gaviota')) birds.push('Gaviotas');
    if (textLower.includes('gorrion') || textLower.includes('gorrión')) birds.push('Gorriones');
    if (textLower.includes('cotorra')) birds.push('Cotorras');
    if (textLower.includes('cigueña') || textLower.includes('cigüeña')) birds.push('Cigüeñas');
    if (birds.length > 0) setDetectedBirds(birds);

    // 2. Systems detection
    const systems: string[] = [];
    // "Malla" (solar-panel mesh) only when panels are actually mentioned — plain "malla"/"red"
    // without that context still means the regular anti-bird net system.
    const mentionsSolarPanels = textLower.includes('placa solar') || textLower.includes('placas solares') || textLower.includes('panel solar') || textLower.includes('paneles solares');
    if (mentionsSolarPanels && (textLower.includes('malla') || textLower.includes('clip'))) {
      systems.push('Malla');
    } else if (textLower.includes('red') || textLower.includes('malla')) {
      systems.push('Red');
    }
    if (textLower.includes('varilla') || textLower.includes('pincho') || textLower.includes('púa')) {
      systems.push('Varillas');
    }
    if (textLower.includes('eléctrico') || textLower.includes('electrostático')) systems.push('Eléctrico');
    if (textLower.includes('captura') || textLower.includes('trampa')) systems.push('Capturas');
    if (systems.length > 0) setDetectedSystems(systems);

    // 3. Lineal meters extraction
    const match = textLower.match(/(\d+)\s*(metros|metro|m\b)/);
    if (match && match[1]) {
      setMeters(parseInt(match[1], 10));
    }
  }, [transcription]);

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Transcribes + AI-parses a single (already-compressed) audio chunk, returning its raw text and
  // (if available) the structured data. Sent as a raw binary POST — not base64 JSON — so it doesn't
  // pay the ~33% base64 size penalty against Vercel's ~4.5MB serverless body limit.
  const transcribeOneChunk = async (blob: Blob, filename: string, userKey?: string, userLlmKey?: string): Promise<{ text: string; aiParsed: any }> => {
    const callProxyServer = async (fileBlob: Blob, fname: string, key?: string, llmKey?: string) => {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': fileBlob.type || 'audio/wav',
          'X-File-Name': encodeURIComponent(fname),
          ...(key ? { 'X-Api-Key': key } : {}),
          ...(llmKey ? { 'X-Llm-Api-Key': llmKey } : {}),
        },
        body: fileBlob,
      });

      const rawText = await response.text().catch(() => '');
      if (!response.ok) {
        let errMsg = 'Error al transcribir el archivo.';
        if (response.status === 413 || rawText.includes('Too Large') || rawText.includes('Request Entity')) {
          throw new Error(`El archivo "${fname}" sigue siendo demasiado grande para el servidor.\n\nPrueba a grabar un clip más corto, o introduce una clave de API de Groq en "Ajustes" para subir archivos de hasta 25MB directamente desde tu navegador.`);
        }
        try {
          const errData = JSON.parse(rawText);
          errMsg = errData.error || errData.details || errMsg;
        } catch (jsonErr) {
          errMsg = rawText || errMsg;
        }
        throw new Error(errMsg);
      }

      try {
        return JSON.parse(rawText);
      } catch (e) {
        throw new Error('La respuesta del servidor no tiene un formato JSON válido.');
      }
    };

    if (userKey && userKey.startsWith('gsk_')) {
      console.log('Utilizando transcripción directa en panel principal (Groq)...');
      try {
        const formData = new FormData();
        formData.append('file', blob, 'audio.wav');
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'es');

        const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${userKey}` },
          body: formData
        });

        if (!whisperRes.ok) {
          const textErr = await whisperRes.text();
          throw new Error(`Groq Whisper falló: ${textErr}`);
        }

        const whisperData = await whisperRes.json();
        const transcriptionText = whisperData.text;

        const prompt = `Analiza la siguiente transcripción de una visita técnica para control de aves y extrae la información en un objeto JSON con el siguiente formato estricto. No incluyas explicaciones ni formato markdown (como backticks o la palabra json), devuelve únicamente un objeto JSON válido.

JSON keys:
- "detectedBird": Debe ser uno de los siguientes valores exactos en español: "Palomas", "Gorriones", "Cigüeñas", "Gaviotas", "Cotorras", "Golondrinas", "Avión Común".
- "detectedSystems": Array de strings que contengan los sistemas de control propuestos. Valores válidos: "Red", "Varillas", "Eléctrico", "Capturas", "Malla" (usa "Malla" solo cuando se mencionen placas solares o paneles solares junto con malla metálica/clips de presión — es un sistema distinto de "Red").
- "clientName": Nombre formal de la comunidad de propietarios en MAYÚSCULAS, ej. "COMUNIDAD DE PROPIETARIOS PRINCESA 28".
- "clientAddress": Dirección de la obra limpia, ej. "Calle de la Princesa 28, Madrid".
- "city": Localidad o municipio de la visita (NO asumas Madrid por defecto; puede ser cualquier pueblo o ciudad de España, ej. "Toledo", "Talavera de la Reina", "Illescas"). Si no se menciona explícitamente, deriva la más probable a partir de la dirección o deja el campo vacío.
- "postalCode": Código postal de 5 dígitos si se menciona, ej. "28008".
- "meters": Metros lineales o cantidad numérica estimada que se mencione (número entero).
- "introTecnica": Resumen técnico profesional descriptivo y amplio (de 2 a 4 líneas de longitud), redactado en tercera persona del plural ("pudimos comprobar cómo..."). IMPORTANTE: Debes REESCRIBIR y RESUMIR en detalle la descripción coloquial del técnico. Explica las zonas observadas (como tejados, aleros, canalones o antenas) y los rastros de las aves. Elimina muletillas, repeticiones, fechas de la visita y direcciones. El texto resultante debe ser formal, técnico, detallado y fluido al concatenarse con "Durante la visita realizada pudimos comprobar cómo...". Ejemplo: "las aves se posan de manera recurrentemente en todo el borde del tejado de pizarra y en la antena del edificio contiguo, acumulando gran cantidad de excrementos en los bordes y terrazas inferiores, lo que degrada la salubridad y la estética de la fachada".
- "problemaPrincipal": Resumen profesional detallado y completo (de 2 a 3 líneas de longitud), redactado en tercera persona del singular. IMPORTANTE: Debes REESCRIBIR de forma técnica el problema central. Explica la causa raíz (ej. que bajan a beber agua a la piscina o que anidan en huecos) y las consecuencias. El texto resultante debe fluir perfectamente al concatenarse con "El problema principal...". Ejemplo: "radica en que las aves descienden constantemente a la zona de la piscina para beber agua, lo que provoca la acumulación de excrementos ácidos en las terrazas verticales de los propietarios, requiriendo tareas de barrido y limpieza diarias".
- "detalleAdicional": Resumen profesional amplio e informativo (de 2 a 3 líneas de longitud), detallando los accesos y las soluciones específicas propuestas en la inspección (como protección con red, instalación de varillas en focos rectangulares, o ausencia de nidos en huecos cerrados). Ejemplo: "se propone la instalación de varillas de acero inoxidable en los dos focos rectangulares de la terraza donde se posan las aves, junto con la instalación de una red antipalomas perimetral que proteja la zona de la piscina para evitar el acceso al agua".
- "price1": Precio de la primera opción de presupuesto formateado (ej. "450 €").
- "price2": Precio de la segunda opción o lote completo de presupuesto formateado (ej. "1.090 €").
- "price3": Precio total sugerido o de la opción elegida formateado (ej. "1.090 €").
- "refCode": Código de referencia del presupuesto si se menciona (ej. "Ref-ALC-L-2026-0-589").
- "date": Fecha en la que se realizó la visita/inspección, en formato "YYYY-MM-DD", SOLO si se menciona explícitamente como la fecha de la visita (frases como "hoy es...", "estamos a...", "la visita fue el..."). IMPORTANTE: ignora por completo cualquier número que forme parte del NOMBRE DE UNA CALLE O DIRECCIÓN (ej. "Calle 18 de Octubre" es el nombre de una calle, NO una fecha — no la confundas con la fecha de la visita). Si no se menciona una fecha real de la visita, deja este campo vacío o null.
- "zonasAfectadas": Frase corta (5-12 palabras) que describa las zonas concretas del inmueble donde se observaron las aves, tal y como se mencionan en la transcripción (ej. "el tejado de pizarra y la antena", "las repisas de las ventanas y el alero trasero"). Si no se menciona ninguna zona concreta, usa "varias zonas del edificio".

Transcripción:
"${transcriptionText}"`;

        const finalLlmKey = userLlmKey || userKey;
        const isLlmGroq = finalLlmKey.startsWith('gsk_');
        const llmUrl = isLlmGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
        const llmModel = isLlmGroq ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';

        const llmRes = await fetch(llmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${finalLlmKey}`,
            'Content-Type': 'application/json',
            ...(isLlmGroq ? {} : {
              'HTTP-Referer': 'https://alcebo-technical-quotes.vercel.app',
              'X-Title': 'Alcebo Quotes'
            })
          },
          body: JSON.stringify({
            model: llmModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });

        let aiParsed = null;
        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const rawJsonText = llmData.choices[0].message.content.trim();
          aiParsed = JSON.parse(rawJsonText);
        }

        return { text: transcriptionText, aiParsed };
      } catch (directErr) {
        console.warn('Llamada directa a Groq falló, recurriendo al servidor proxy...', directErr);
        return await callProxyServer(blob, filename, userKey, userLlmKey);
      }
    }
    return await callProxyServer(blob, filename, userKey, userLlmKey);
  };

  // Merge structured data extracted from several clips of the same visit: first non-empty value wins
  // per field, arrays (systems) get unioned.
  const mergeAiParsed = (a: any, b: any): any => {
    if (!a) return b;
    if (!b) return a;
    const merged: any = { ...a };
    Object.keys(b).forEach(key => {
      if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
        merged[key] = b[key];
      } else if (key === 'detectedSystems' && Array.isArray(merged[key]) && Array.isArray(b[key])) {
        merged[key] = Array.from(new Set([...merged[key], ...b[key]]));
      }
    });
    return merged;
  };

  // File Upload flow — supports selecting several clips of the same visit (e.g. when a recording got
  // cut off partway through) and combines them into one transcript/quote.
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setFileName(files.length > 1 ? `${files.length} archivos (${files.map(f => f.name).join(', ')})` : files[0].name);
    setIsProcessing(true);
    setProgress(5);
    setTranscription('');
    setClientName('');
    setClientAddress('');
    setNotes('');

    const userKey = config?.groqApiKey?.trim();
    const userLlmKey = config?.llmApiKey?.trim();

    try {
      // Split each selected file into ~2-minute audio chunks first, so a single long recording
      // (or a large WhatsApp video) never hits the server's request-size limit — no API key needed.
      const chunkGroups = await Promise.all(files.map(f => extractAudioChunksFromMediaFile(f)));
      const allChunks: { blob: Blob; filename: string }[] = [];
      chunkGroups.forEach((chunks, fileIdx) => {
        chunks.forEach((blob, chunkIdx) => {
          allChunks.push({ blob, filename: chunks.length > 1 ? `${files[fileIdx].name}-part${chunkIdx + 1}` : files[fileIdx].name });
        });
      });

      const texts: string[] = [];
      let combinedAi: any = null;

      for (let i = 0; i < allChunks.length; i++) {
        const { text, aiParsed } = await transcribeOneChunk(allChunks[i].blob, allChunks[i].filename, userKey, userLlmKey);
        texts.push(text);
        combinedAi = mergeAiParsed(combinedAi, aiParsed);
        setProgress(Math.round(((i + 1) / allChunks.length) * 95));
      }

      const combinedText = texts.filter(t => t && t.trim()).join('\n\n');
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setTranscription(combinedText);
        if (combinedAi) {
          setAiData(combinedAi);
          if (combinedAi.clientName) setClientName(combinedAi.clientName);
          if (combinedAi.clientAddress) setClientAddress(combinedAi.clientAddress);
          if (combinedAi.detectedBird) setDetectedBirds([combinedAi.detectedBird]);
          if (combinedAi.detectedSystems) setDetectedSystems(combinedAi.detectedSystems);
          if (combinedAi.meters) setMeters(combinedAi.meters);
          if (combinedAi.introTecnica) setNotes(combinedAi.introTecnica);
        }
        showToast(files.length > 1 ? `¡${files.length} vídeos/audios transcritos y combinados con éxito!` : '¡Vídeo/Audio transcrito con éxito!');
      }, 300);

    } catch (err: any) {
      console.error('File transcription failed:', err);
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        alert(`Error de Transcripción:\n${err.message || 'Hubo un fallo al procesar la grabación.'}`);
      }, 200);
    }
  };

  // Toggle helpers
  const toggleBird = (bird: string) => {
    setDetectedBirds((prev) =>
      prev.includes(bird) ? prev.filter((b) => b !== bird) : [...prev, bird]
    );
  };

  const toggleSystem = (system: string) => {
    setDetectedSystems((prev) =>
      prev.includes(system) ? prev.filter((s) => s !== system) : [...prev, system]
    );
  };

  // Generate Draft
  const handleGenerateBorrador = () => {
    if (!transcription) return;

    // Negative lookbehind avoids matching a street name that happens to contain a date-like number
    // (e.g. "Calle 18 de Octubre 11" is an address, not the visit date).
    const dateRegex = /\b(?<!calle\s)(?<!c\/\s?)(\d{1,2})[\s/de]+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{1,2})[\s/de]+(\d{2,4})\b/i;
    const extractDateFromText = (text: string): string | null => {
      const matchDate = text.match(dateRegex);
      if (!matchDate) return null;
      const day = matchDate[1];
      const monthTextOrNum = matchDate[2].toLowerCase();
      let year = matchDate[3];
      if (year.length === 2) year = '20' + year;
      const monthMap: Record<string, string> = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
        'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
      };
      const month = monthMap[monthTextOrNum] || monthTextOrNum.padStart(2, '0');
      const formattedDate = `${year}-${month}-${day.padStart(2, '0')}`;
      return isNaN(new Date(formattedDate).getTime()) ? null : formattedDate;
    };

    // The date spoken/shown in the video is when the TECHNICIAN VISITED — not the date the
    // quote itself is issued/sent (that one determines its validity period and defaults to
    // today, editable separately in the document editor).
    let visitDate = new Date().toISOString().split('T')[0];
    const regexExtractedDate = extractDateFromText(transcription);
    if (aiData?.date && !isNaN(new Date(aiData.date).getTime())) {
      // Cross-check: if the AI's date's day number is actually part of a street name in the
      // transcript (e.g. it picked "18" out of "Calle 18 de Octubre"), distrust it and prefer
      // whatever the guarded regex scan found instead.
      const aiDay = parseInt(aiData.date.split('-')[2], 10);
      const looksLikeStreetNumber = !isNaN(aiDay) && new RegExp(`(calle|c\\/)[^.]{0,40}\\b${aiDay}\\b`, 'i').test(transcription);
      visitDate = (looksLikeStreetNumber && regexExtractedDate) ? regexExtractedDate : aiData.date;
    } else if (regexExtractedDate) {
      visitDate = regexExtractedDate;
    }

    const newQuote: Quote = {
      id: 'q-' + Date.now(),
      title: clientName ? `Presupuesto ${clientName}` : `Presupuesto Automático ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString().split('T')[0],
      visitDate,
      status: 'Borrador',
      text: transcription,
      birds: detectedBirds.length > 0 ? detectedBirds : ['Palomas'],
      systems: detectedSystems.length > 0 ? detectedSystems : ['Red'],
      estimationLineal: meters,
      totalCost: 0,
      clientName: clientName || 'Comunidad Vecinos Pendiente',
      clientAddress: clientAddress || 'Sin dirección registrada',
      notes: notes || 'Presupuesto generado a partir de transcripción de voz.',

      // AI Structuring fields
      introTecnica: notes || aiData?.introTecnica || undefined,
      problemaPrincipal: aiData?.problemaPrincipal || undefined,
      detalleAdicional: aiData?.detalleAdicional || undefined,
      zonasAfectadas: aiData?.zonasAfectadas || extractZonasFromText(transcription) || undefined,
      city: aiData?.city || undefined,
      postalCode: aiData?.postalCode || undefined,
      refCode: aiData?.refCode || undefined,
      price1: aiData?.price1 || undefined,
      price2: aiData?.price2 || undefined,
      price3: aiData?.price3 || undefined,
    };

    onAddQuote(newQuote);
    showToast('¡Presupuesto creado con éxito! Se ha añadido al historial.');
    
    // Clear state
    setTranscription('');
    setFileName('');
    setDetectedBirds([]);
    setDetectedSystems([]);
    setMeters(15);
    setClientName('');
    setClientAddress('');
    setNotes('');
    setAiData(null);
  };

  const handleDiscard = () => {
    setFileName('');
    setIsProcessing(false);
    setProgress(0);
    setTranscription('');
    setDetectedBirds([]);
    setDetectedSystems([]);
    setMeters(15);
    setClientName('');
    setClientAddress('');
    setNotes('');
    setAiData(null);
    showToast('Inspección descartada.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Simplified Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center md:text-left">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start">
          <span className="text-3xl">📹</span>
          Transcripción de Vídeos de Inspección
        </h1>
        <p className="text-sm text-slate-500 mt-2 font-medium">
          Sube el archivo de vídeo o audio grabado por el técnico. La aplicación extraerá el audio, lo transcribirá y rellenará el presupuesto de forma automática.
        </p>
      </div>

      {/* STEP 1: UPLOAD FILE ONLY */}
      {!transcription && !isProcessing && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-6 min-h-[320px] hover:border-[#009fe3]/50 transition-all duration-300">
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-850">Subir grabación de la inspección</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Selecciona el archivo de vídeo (MP4, WEBM) o audio (MP3, WAV, M4A) capturado en las instalaciones del cliente. El sistema autodetectará la especie, metros y soluciones.
            </p>
            <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 max-w-md mx-auto font-medium space-y-2.5">
              <div>
                ⚠️ <strong>Límite de tamaño:</strong> Máximo 4.5MB para servidores Vercel. Si tienes archivos más grandes (hasta 25MB), puedes configurar tu propia clave de API de Groq en <strong>Ajustes</strong> para subirlos directamente sin límite del servidor.
              </div>
              <div className="pt-2 border-t border-amber-200/50 flex justify-center">
                </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="audio/*,video/*"
            multiple
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-28 h-28 rounded-full bg-[#e6f4ff] hover:bg-[#cbe7ff] text-[#009fe3] flex flex-col items-center justify-center cursor-pointer active:scale-95 shadow-3xs transition-all hover:scale-105"
          >
            <span className="material-symbols-outlined text-[48px] leading-none mb-1">movie</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Subir Archivo(s)</span>
          </button>

          <span className="text-[10px] text-slate-450 font-semibold bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Puedes seleccionar varios si la grabación se cortó
          </span>
        </div>
      )}

      {/* PROCESSING STATE */}
      {isProcessing && (
        <div className="bg-slate-900 text-white rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-xl border border-slate-800">
          <div className="w-12 h-12 rounded-full border-4 border-sky-400 border-t-transparent animate-spin"></div>
          <div>
            <h3 className="text-base font-bold">Procesando archivo: {fileName}</h3>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              OpenRouter está transcribiendo y extrayendo los datos del vídeo. Por favor, espera un momento.
            </p>
          </div>
          <div className="w-full max-w-xs bg-slate-800 h-2 rounded-full overflow-hidden p-[1px]">
            <div
              className="bg-[#009fe3] h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-sky-400 font-mono font-bold">{progress}% Completado</span>
        </div>
      )}

      {/* STEP 2: CONFIRM DETAILS & STEP 3: GENERATE */}
      {transcription && (
        <div className="space-y-6">
          {/* Transcription details block */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>📝</span>
                Texto Transcrito del Vídeo
              </h3>
              <button
                onClick={() => setIsEditingText(!isEditingText)}
                className="text-[#006491] hover:text-[#009fe3] font-bold text-xs flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isEditingText ? 'save' : 'edit'}
                </span>
                {isEditingText ? 'Guardar Cambios' : 'Corregir Texto'}
              </button>
            </div>

            {isEditingText ? (
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                rows={4}
                className="w-full p-4 bg-slate-50 border border-slate-350 rounded-xl text-xs text-slate-700 focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3] outline-none font-sans leading-relaxed"
              />
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed italic">
                "{transcription}"
              </div>
            )}
          </div>

          {/* Form and parameters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span>📋</span>
              Revisar y Generar Presupuesto
            </h3>

            {/* Client Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Nombre del Cliente / Comunidad:</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Comunidad Propietarios Calle Mayor 12"
                  className="p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 bg-slate-50/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Dirección de la obra:</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Ej: Calle Mayor 12, Madrid"
                  className="p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 bg-slate-50/50"
                />
              </div>
            </div>

            {/* Removed automated meters, species and price parameters to support clean manual budgeting */}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleGenerateBorrador}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-center shadow-md shadow-emerald-100 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">post_add</span>
                Crear y Editar Presupuesto en Word
              </button>
              <button
                onClick={handleDiscard}
                className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-center transition-all active:scale-95 cursor-pointer"
              >
                Descartar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
