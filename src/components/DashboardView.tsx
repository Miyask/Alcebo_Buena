import React, { useState, useEffect, useRef } from 'react';
import { Quote, SystemConfig } from '../types';

interface DashboardViewProps {
  onAddQuote: (newQuote: Quote) => void;
  config: SystemConfig;
}

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
    if (textLower.includes('urraca')) birds.push('Urracas');
    if (textLower.includes('gaviota')) birds.push('Gaviotas');
    if (textLower.includes('gorrion') || textLower.includes('gorrión')) birds.push('Gorriones');
    if (textLower.includes('cotorra')) birds.push('Cotorras');
    if (textLower.includes('cigueña') || textLower.includes('cigüeña')) birds.push('Cigüeñas');
    if (birds.length > 0) setDetectedBirds(birds);

    // 2. Systems detection
    const systems: string[] = [];
    if (textLower.includes('red') || textLower.includes('malla')) systems.push('Red');
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

  // File Upload flow
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setProgress(10);
    setTranscription('');
    setClientName('');
    setClientAddress('');
    setNotes('');

    try {
      const userKey = config?.groqApiKey?.trim();
      const userLlmKey = config?.llmApiKey?.trim();

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Uri = reader.result as string;

        try {
          let data: { text: string; aiParsed?: any } = { text: '' };

          const callProxyServer = async (uri: string, filename: string, key?: string, llmKey?: string) => {
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                file: uri,
                name: filename,
                apiKey: key,
                llmApiKey: llmKey,
              }),
            });

            const rawText = await response.text().catch(() => '');
            if (!response.ok) {
              let errMsg = 'Error al transcribir el archivo.';
              if (response.status === 413 || rawText.includes('Too Large') || rawText.includes('Request Entity')) {
                throw new Error('El archivo es demasiado grande para el servidor de Vercel (límite de 4.5MB en Base64).\n\nPara solucionar esto:\n1. Introduce una clave de API de Groq en "Ajustes" para subir archivos de hasta 25MB directamente desde tu navegador.\n2. O bien sube un archivo de AUDIO (.mp3, .m4a) que son mucho más ligeros y no fallan.');
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
              const fileBlob = await (await fetch(base64Uri)).blob();
              const formData = new FormData();
              formData.append('file', fileBlob, file.name);
              formData.append('model', 'whisper-large-v3');
              formData.append('language', 'es');

              const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${userKey}`
                },
                body: formData
              });

              if (!whisperRes.ok) {
                const textErr = await whisperRes.text();
                throw new Error(`Groq Whisper falló: ${textErr}`);
              }

              const whisperData = await whisperRes.json();
              const transcriptionText = whisperData.text;

              setProgress(65);

              const prompt = `Analiza la siguiente transcripción de una visita técnica para control de aves y extrae la información en un objeto JSON con el siguiente formato estricto. No incluyas explicaciones ni formato markdown (como backticks o la palabra json), devuelve únicamente un objeto JSON válido.

JSON keys:
- "detectedBird": Debe ser uno de los siguientes valores exactos en español: "Palomas", "Gorriones", "Cigüeñas", "Gaviotas", "Cotorras", "Golondrinas", "Urracas".
- "detectedSystems": Array de strings que contengan los sistemas de control propuestos. Valores válidos: "Red", "Varillas", "Eléctrico", "Capturas".
- "clientName": Nombre formal de la comunidad de propietarios en MAYÚSCULAS, ej. "COMUNIDAD DE PROPIETARIOS PRINCESA 28".
- "clientAddress": Dirección de la obra limpia, ej. "Calle de la Princesa 28, Madrid".
- "postalCode": Código postal de 5 dígitos si se menciona, ej. "28008".
- "meters": Metros lineales o cantidad numérica estimada que se mencione (número entero).
- "introTecnica": Resumen técnico profesional redactado en tercera persona del plural ("pudimos comprobar cómo..."). IMPORTANTE: Debes REESCRIBIR y RESUMIR de forma profesional la descripción coloquial del técnico. Corrige la gramática, elimina muletillas, repeticiones, fechas de la visita y direcciones. El texto resultante debe ser formal, técnico y fluido al concatenarse con "Durante la visita realizada pudimos comprobar cómo...". Ejemplo: "las aves anidan de manera recurrente en los aleros principales, acumulando residuos orgánicos y dañando la estética de la fachada".
- "problemaPrincipal": Resumen profesional redactado en tercera persona del singular. IMPORTANTE: Debes REESCRIBIR de forma concisa y técnica el problema central expresado en el audio. El texto resultante debe fluir perfectamente al concatenarse con "El problema principal...". Ejemplo: "radica en la acumulación de excrementos ácidos en las cornisas de la fachada, deteriorando los materiales y obstruyendo las bajantes de pluviales".
- "detalleAdicional": Resumen profesional de cualquier detalle adicional sobre accesos, andamios, requisitos de llaves, etc. IMPORTANTE: Reorganiza y sintetiza la información coloquial de forma estructurada. Ejemplo: "se requiere acceso a la terraza comunitaria y la colocación de líneas de vida para realizar los trabajos de instalación de varillas en la cornisa superior".
- "price1": Precio de la primera opción de presupuesto formateado (ej. "450 €").
- "price2": Precio de la segunda opción o lote completo de presupuesto formateado (ej. "1.090 €").
- "price3": Precio total sugerido o de la opción elegida formateado (ej. "1.090 €").
- "refCode": Código de referencia del presupuesto si se menciona (ej. "Ref-ALC-L-2026-0-589").

Transcripción:
"${transcriptionText}"`;

              const finalLlmKey = userLlmKey || userKey;
              const isLlmGroq = finalLlmKey.startsWith('gsk_');
              const llmUrl = isLlmGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
              const llmModel = isLlmGroq ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-3.3-70b-instruct';

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

              data = { text: transcriptionText, aiParsed };
            } catch (directErr) {
              console.warn('Llamada directa a Groq falló, recurriendo al servidor proxy...', directErr);
              data = await callProxyServer(base64Uri, file.name, userKey, userLlmKey);
            }
          } else {
            data = await callProxyServer(base64Uri, file.name, userKey, userLlmKey);
          }

          const ai = data.aiParsed;
          setProgress(100);
          setTimeout(() => {
            setIsProcessing(false);
            setTranscription(data.text);
            if (ai) {
              setAiData(ai);
              if (ai.clientName) setClientName(ai.clientName);
              if (ai.clientAddress) setClientAddress(ai.clientAddress);
              if (ai.detectedBird) setDetectedBirds([ai.detectedBird]);
              if (ai.detectedSystems) setDetectedSystems(ai.detectedSystems);
              if (ai.meters) setMeters(ai.meters);
              if (ai.introTecnica) setNotes(ai.introTecnica);
            }
            showToast('¡Vídeo/Audio transcrito con éxito!');
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
    } catch (error: any) {
      console.error('File reading failed:', error);
      alert(`Error al procesar el archivo:\n${error.message}`);
      setIsProcessing(false);
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

    const newQuote: Quote = {
      id: 'q-' + Date.now(),
      title: clientName ? `Presupuesto ${clientName}` : `Presupuesto Automático ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString().split('T')[0],
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
            <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2 max-w-md mx-auto font-medium">
              ⚠️ <strong>Límite de tamaño:</strong> Máximo 4.5MB para servidores Vercel. Si tienes archivos más grandes (hasta 25MB), puedes configurar tu propia clave de API de Groq en <strong>Ajustes</strong> para subirlos directamente sin límite del servidor.
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="audio/*,video/*"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-28 h-28 rounded-full bg-[#e6f4ff] hover:bg-[#cbe7ff] text-[#009fe3] flex flex-col items-center justify-center cursor-pointer active:scale-95 shadow-3xs transition-all hover:scale-105"
          >
            <span className="material-symbols-outlined text-[48px] leading-none mb-1">movie</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Subir Archivo</span>
          </button>

          <span className="text-[10px] text-slate-450 font-semibold bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Formatos de vídeo y audio compatibles
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
