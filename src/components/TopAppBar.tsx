import React from 'react';
import CompanyLogo from './CompanyLogo';

interface TopAppBarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function TopAppBar({
  currentTab,
  setCurrentTab,
  searchQuery,
  setSearchQuery,
}: TopAppBarProps) {
  // Translate current tab ID into human-friendly Spanish header
  const getTabLabel = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Panel General';
      case 'presupuestos':
        return 'Gestor de Presupuestos';
      case 'plantillas':
        return 'Plantillas Base';
      case 'condicionales':
        return 'Cláusulas Condicionales';
      case 'settings':
        return 'Ajustes Técnicos';
      default:
        return 'Panel Alcebo';
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex justify-between items-center px-6 z-40">
      {/* Page Brand Indicator */}
      <div className="flex items-center gap-3">
        <div className="md:hidden block">
          <CompanyLogo height={32} isDarkBg={false} />
        </div>
        <h2 className="text-base font-black text-slate-800 sm:block hidden tracking-tight">
          {getTabLabel()}
        </h2>
        <span className="text-[10px] bg-[#e2f4ff] text-[#006491] font-black px-2.5 py-1 rounded-full border border-[#009fe3]/10 uppercase tracking-wider hidden sm:inline-block">
          Operario Activo
        </span>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-4 flex-1 justify-end">
        {/* Search Bar */}
        <div className="relative max-w-xs w-full hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs text-slate-700 focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3] outline-none transition-all placeholder-slate-400 font-medium"
            placeholder="Buscar por cliente o ID..."
          />
        </div>

        {/* Notifications Icon with active dot */}
        <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>

        {/* Settings Tab trigger */}
        <button
          onClick={() => setCurrentTab('settings')}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            currentTab === 'settings'
              ? 'text-[#009fe3] bg-slate-100 shadow-3xs'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
          title="Configuración de API"
        >
          <span className="material-symbols-outlined text-[22px]">settings</span>
        </button>

      </div>
    </header>
  );
}
