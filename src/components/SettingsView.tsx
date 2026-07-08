import React, { useState } from 'react';
import { SystemConfig } from '../types';

interface SettingsViewProps {
  config: SystemConfig;
  onSaveConfig: (updatedConfig: SystemConfig) => void;
}

export default function SettingsView({ config, onSaveConfig }: SettingsViewProps) {
  const [apiKey, setApiKey] = useState<string>(config.groqApiKey);
  const [url, setUrl] = useState<string>(config.baseUrl);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SystemConfig = {
      groqApiKey: apiKey,
      baseUrl: url,
      isWhisperActive: apiKey.trim().length > 10,
    };
    onSaveConfig(updated);
    showToast('¡Configuración de licencia guardada!');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-bounce border border-slate-800">
          <span className="material-symbols-outlined text-emerald-400">shield_lock</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Page Header with connection status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>⚙️</span>
            Ajustes de Conexión
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Gestiona la clave de licencia y conexión con el motor de transcripción por voz.
          </p>
        </div>

        {/* Status Indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 shadow-3xs shrink-0 font-bold text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
          <span>Licencia Activa</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Main Form */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🔑</span>
              Clave de Licencia (API OpenRouter)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Esta clave permite la comunicación con el motor de transcripción Whisper para la entrada por voz.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                CLAVE DE LICENCIA / API_KEY
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base select-none">
                  vpn_key
                </span>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Introduce tu clave de licencia"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-700 focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-base">
                    {showKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                ENDPOINT DE CONEXIÓN
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-500 focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 outline-none"
                disabled
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-[#009fe3] hover:bg-[#006491] text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">save</span>
                Guardar Ajustes
              </button>
            </div>
          </form>
        </div>

        {/* Notice Info Box */}
        <div className="md:col-span-1 bg-sky-50 border border-sky-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#006491]">
            <span>💡</span>
            <h4 className="text-xs font-bold uppercase tracking-wider">Clave preconfigurada</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            La aplicación de Alcebo <strong>ya viene configurada con una clave de licencia activa y funcional por defecto</strong>.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Tu jefa no necesita realizar ningún registro ni crear cuentas complejas. El sistema está listo para ser utilizado desde el primer minuto.
          </p>
        </div>
      </div>
    </div>
  );
}
