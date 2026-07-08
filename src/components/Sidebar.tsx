import React, { useState } from 'react';
import CompanyLogo from './CompanyLogo';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  const mainItems = [
    { id: 'dashboard', name: '🎤 Crear Presupuesto', icon: 'mic', desc: 'Por voz o audio' },
    { id: 'presupuestos', name: '📂 Ver Presupuestos', icon: 'description', desc: 'Historial y editor' },
    { id: 'settings', name: '⚙️ Ajustes', icon: 'settings', desc: 'Clave de licencia' },
  ];

  const advancedItems = [
    { id: 'plantillas', name: '📝 Plantillas Word', icon: 'auto_stories', desc: 'Editar textos base' },
    { id: 'condicionales', name: '🔀 Reglas de Texto', icon: 'article_shortcut', desc: 'Textos por especie' },
  ];

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-white border-r border-slate-200/80 py-6 px-4 z-50 text-slate-700">
      {/* Brand Header */}
      <div className="flex items-center mb-8 px-1">
        <CompanyLogo height={42} isDarkBg={false} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1.5">
        {mainItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex items-start gap-3.5 px-4 py-3 rounded-xl transition-all duration-150 text-left active:scale-[0.98] cursor-pointer group relative ${
                isActive
                  ? 'bg-[#e6f4ff]/75 text-[#006491] font-bold shadow-3xs'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#009fe3] rounded-r-lg" />
              )}
              <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-105 ${
                isActive ? 'text-[#009fe3]' : 'text-slate-400 group-hover:text-slate-600'
              }`}>{item.icon}</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-wide">{item.name}</span>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-500 mt-0.5">{item.desc}</span>
              </div>
            </button>
          );
        })}

        {/* Divider */}
        <div className="h-[1px] bg-slate-100 my-4" />

        {/* Collapsible Advanced Toggle Button */}
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer w-full text-left uppercase tracking-wider"
        >
          <span>Opciones Avanzadas</span>
          <span className="material-symbols-outlined text-base">
            {isAdvancedOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {/* Advanced Menu Items */}
        {isAdvancedOpen && (
          <div className="flex flex-col gap-1 mt-1 pl-2 animate-fade-in">
            {advancedItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left active:scale-[0.98] cursor-pointer group relative ${
                    isActive
                      ? 'bg-slate-100 text-slate-800 font-bold'
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${
                    isActive ? 'text-[#009fe3]' : 'text-slate-400'
                  }`}>{item.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{item.name}</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom Footer Credits */}
      <div className="border-t border-slate-100 pt-5 px-2 mt-auto">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 relative flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          </span>
          <p className="text-xs text-slate-500 font-bold">Servidor Activo (Local)</p>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 font-medium">© 2026 Alcebo Control Plagas</p>
      </div>
    </aside>
  );
}
