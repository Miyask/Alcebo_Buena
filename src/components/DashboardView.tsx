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
    setProgress(15);
    setTranscription('');
    setClientName('');
    setClientAddress('');
    setNotes('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Uri = reader.result as string;
        setProgress(40);

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Uri,
              name: file.name,
              apiKey: config?.groqApiKey,
            }),
          });

          setProgress(85);

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || errData.details || 'Error al transcribir el archivo.');
          }

          const data = await response.json();

          setProgress(100);
          setTimeout(() => {
            setIsProcessing(false);
            setTranscription(data.text);
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
    } catch (error) {
      console.error('File reading failed:', error);
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

    // Estimated price
    const pricePerMeter = detectedSystems.includes('Red') && detectedSystems.includes('Varillas')
      ? 45.00
      : detectedSystems.includes('Red')
      ? 35.00
      : 18.50;

    const baseMeters = meters > 0 ? meters : 15;
    const calculatedCost = baseMeters * pricePerMeter;

    const newQuote: Quote = {
      id: 'q-' + Date.now(),
      title: clientName ? `Presupuesto ${clientName}` : `Presupuesto Automático ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Borrador',
      text: transcription,
      birds: detectedBirds.length > 0 ? detectedBirds : ['Palomas'],
      systems: detectedSystems.length > 0 ? detectedSystems : ['Red'],
      estimationLineal: baseMeters,
      totalCost: parseFloat(calculatedCost.toFixed(2)),
      clientName: clientName || 'Comunidad Vecinos Pendiente',
      clientAddress: clientAddress || 'Sin dirección registrada',
      notes: notes || 'Presupuesto generado de manera automatizada a partir de transcripción de voz.',
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

            {/* Meters and species */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              
              {/* Meters Counter */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-bold text-slate-600">Metros estimados de instalación:</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMeters(prev => Math.max(1, prev - 5))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base cursor-pointer flex items-center justify-center active:scale-95 select-none"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={meters}
                    onChange={(e) => setMeters(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 max-w-[120px] p-2.5 border border-slate-200 rounded-xl text-center text-sm font-bold bg-slate-50"
                  />
                  <button
                    onClick={() => setMeters(prev => prev + 5)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base cursor-pointer flex items-center justify-center active:scale-95 select-none"
                  >
                    +
                  </button>
                  <span className="text-xs font-bold text-slate-500">metros</span>
                </div>
              </div>

              {/* Plaga and system chips */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Tipo de Ave:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Palomas', 'Golondrinas', 'Urracas', 'Gaviotas', 'Gorriones', 'Cotorras', 'Cigüeñas'].map((bird) => {
                      const isChecked = detectedBirds.includes(bird);
                      return (
                        <button
                          key={bird}
                          onClick={() => toggleBird(bird)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            isChecked
                              ? 'border-[#009fe3] bg-[#e2f4ff] text-[#004b73]'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                          }`}
                        >
                          {bird}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">2. Sistema Protector:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Red', 'Varillas', 'Eléctrico', 'Capturas'].map((sys) => {
                      const isChecked = detectedSystems.includes(sys);
                      return (
                        <button
                          key={sys}
                          onClick={() => toggleSystem(sys)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            isChecked
                              ? 'border-[#009fe3] bg-[#e2f4ff] text-[#004b73]'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                          }`}
                        >
                          {sys}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Estimated price card */}
            <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-4 flex justify-between items-center text-emerald-800 shadow-3xs">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Presupuesto Estimado Alcebo</span>
                <span className="text-xs font-semibold text-emerald-700 mt-1">
                  Sistemas: {detectedSystems.join(' + ') || 'Falta seleccionar sistema'}
                </span>
              </div>
              <span className="text-lg font-black text-emerald-800 font-mono">
                {((meters > 0 ? meters : 15) * 
                  (detectedSystems.includes('Red') && detectedSystems.includes('Varillas')
                    ? 45.0
                    : detectedSystems.includes('Red')
                    ? 35.0
                    : 18.5)).toFixed(2)} €
              </span>
            </div>

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
