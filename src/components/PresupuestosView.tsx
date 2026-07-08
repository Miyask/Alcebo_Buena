import React, { useState } from 'react';
import { Quote, Template, ConditionalText } from '../types';
import DocumentEditor from './DocumentEditor';

interface PresupuestosViewProps {
  quotes: Quote[];
  searchQuery: string;
  onUpdateQuote: (updatedQuote: Quote) => void;
  onDeleteQuote: (id: string) => void;
  templates?: Template[];
  rules?: ConditionalText[];
}

export default function PresupuestosView({
  quotes,
  searchQuery,
  onUpdateQuote,
  onDeleteQuote,
  templates,
  rules,
}: PresupuestosViewProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quotes[0]?.id || null);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Selected quote details
  const activeQuote = quotes.find((q) => q.id === selectedQuoteId);

  // Edit form state
  const [editClientName, setEditClientName] = useState<string>('');
  const [editClientAddress, setEditClientAddress] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editStatus, setEditStatus] = useState<Quote['status']>('Borrador');
  const [editCost, setEditCost] = useState<number>(0);
  const [editMeters, setEditMeters] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editText, setEditText] = useState<string>('');

  // Start edit mode
  const handleStartEdit = (quote: Quote) => {
    setEditClientName(quote.clientName);
    setEditClientAddress(quote.clientAddress);
    setEditTitle(quote.title);
    setEditStatus(quote.status);
    setEditCost(quote.totalCost);
    setEditMeters(quote.estimationLineal);
    setEditNotes(quote.notes);
    setEditText(quote.text);
    setIsEditing(true);
  };

  // Save changes
  const handleSaveEdit = () => {
    if (!activeQuote) return;
    const updated: Quote = {
      ...activeQuote,
      clientName: editClientName,
      clientAddress: editClientAddress,
      title: editTitle,
      status: editStatus,
      totalCost: editCost,
      estimationLineal: editMeters,
      notes: editNotes,
      text: editText,
    };
    onUpdateQuote(updated);
    setIsEditing(false);
  };

  // Filter quotes by search and status
  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.clientAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'All' || q.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Quote['status']) => {
    switch (status) {
      case 'Borrador':
        return 'bg-blue-50 text-blue-700 border-blue-200/60';
      case 'Enviado':
        return 'bg-amber-50 text-amber-700 border-amber-200/60';
      case 'Aprobado':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'Descartado':
        return 'bg-slate-50 text-slate-700 border-slate-200/60';
      default:
        return 'bg-slate-50 text-slate-700';
    }
  };

  if (isEditing && activeQuote) {
    return (
      <DocumentEditor
        quote={activeQuote}
        onSaveQuote={(updatedQuote) => {
          onUpdateQuote(updatedQuote);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
        templates={templates}
        rules={rules}
      />
    );
  }

  const triggerNotification = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 4500);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-800 z-50 flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-bold">{showNotification}</span>
        </div>
      )}

      {/* View Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-[#009fe3] text-2xl">receipt_long</span>
          Historial de Presupuestos Emitidos
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Control, seguimiento de firmas de clientes y consulta técnica de presupuestos generados por Alcebo.
        </p>
      </div>

      {/* Filter and Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Filters and Budget List (5/12 width if selection is open) */}
        <div className={`${activeQuote ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-4`}>
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            {['All', 'Borrador', 'Enviado', 'Aprobado', 'Descartado'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === status
                    ? 'bg-white text-[#009FE3] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'All' ? 'Todos' : status}
              </button>
            ))}
          </div>

          {/* Budgets List */}
          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredQuotes.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-medium">
                No se encontraron presupuestos en esta categoría.
              </div>
            ) : (
              filteredQuotes.map((quote) => {
                const isSelected = selectedQuoteId === quote.id;
                return (
                  <div
                    key={quote.id}
                    onClick={() => {
                      setSelectedQuoteId(quote.id);
                      setIsEditing(false);
                    }}
                    className={`bg-white border rounded-2xl p-4.5 transition-all cursor-pointer hover:shadow-xs relative overflow-hidden flex flex-col gap-3 ${
                      isSelected
                        ? 'border-[#009fe3] ring-1 ring-[#009fe3]/50'
                        : 'border-slate-200/80'
                    }`}
                  >
                    {/* Visual indicators based on control systems */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#009fe3]"></div>

                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="text-xs font-black text-slate-800 leading-tight tracking-tight">
                          {quote.clientName}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono font-bold">{quote.date}</p>
                      </div>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 border rounded-lg ${getStatusColor(
                          quote.status
                        )}`}
                      >
                        {quote.status}
                      </span>
                    </div>

                    {/* Overview text preview */}
                    <p className="text-xs text-slate-500 line-clamp-2 italic font-medium">
                      "{quote.text}"
                    </p>

                    {/* Metadata chips */}
                    <div className="flex justify-between items-center pt-3.5 border-t border-slate-100">
                      <div className="flex flex-wrap gap-1">
                        {quote.birds.map((b) => (
                          <span
                            key={b}
                            className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md"
                          >
                            {b}
                          </span>
                        ))}
                        {quote.systems.map((s) => (
                          <span
                            key={s}
                            className="text-[9px] bg-[#e6f4ff] text-[#006491] font-bold px-1.5 py-0.5 rounded-md"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs font-black text-[#006491] font-mono">
                        {quote.totalCost.toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Selected Budget Workspace Details (7/12 width) */}
        {activeQuote && (
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[450px]">
              {/* Workspace Header */}
              <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006491] text-lg">receipt_long</span>
                  <h2 className="font-bold text-slate-700 text-xs tracking-wide uppercase">Ficha Técnica de Presupuesto</h2>
                </div>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => handleStartEdit(activeQuote)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm text-[#009FE3]">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm('¿Estás seguro de que deseas eliminar este presupuesto?')
                          ) {
                            onDeleteQuote(activeQuote.id);
                            setSelectedQuoteId(quotes[0]?.id || null);
                          }
                        }}
                        className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Eliminar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">save</span>
                        Guardar
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* View/Edit content */}
              <div className="p-6 flex-1 space-y-6">
                {isEditing ? (
                  // EDIT MODE
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente / Entidad:</label>
                        <input
                          type="text"
                          value={editClientName}
                          onChange={(e) => setEditClientName(e.target.value)}
                          className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Título Presupuesto:</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado:</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as Quote['status'])}
                          className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                        >
                          <option value="Borrador">Borrador</option>
                          <option value="Enviado">Enviado</option>
                          <option value="Aprobado">Aprobado</option>
                          <option value="Descartado">Descartado</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metros Lineales:</label>
                        <input
                          type="number"
                          value={editMeters}
                          onChange={(e) => setEditMeters(parseInt(e.target.value, 10) || 0)}
                          className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Costo Estimado (€):</label>
                        <input
                          type="number"
                          value={editCost}
                          onChange={(e) => setEditCost(parseFloat(e.target.value) || 0)}
                          className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dirección del Servicio:</label>
                      <input
                        type="text"
                        value={editClientAddress}
                        onChange={(e) => setEditClientAddress(e.target.value)}
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                        placeholder="Ej. Calle Principal, Madrid"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Texto de Transcripción:</label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all font-sans resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas Internas:</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all font-sans resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  // DISPLAY MODE
                  <div className="space-y-6">
                    {/* Top client detail summary banner */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente / Facturado a</h4>
                        <p className="text-base font-black text-slate-800 mt-1">{activeQuote.clientName}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                          <span className="material-symbols-outlined text-[15px] text-[#009FE3]">pin_drop</span>
                          {activeQuote.clientAddress}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Presupuestado</span>
                        <span className="text-xl font-black text-[#006491] block mt-1 font-mono">
                          {activeQuote.totalCost.toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Core parameters extraction */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Metros</span>
                        <span className="text-sm font-black text-slate-800 block mt-1 font-mono">
                          {activeQuote.estimationLineal} m
                        </span>
                      </div>
                      <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha</span>
                        <span className="text-xs font-bold text-slate-800 block mt-1.5 font-mono">
                          {activeQuote.date}
                        </span>
                      </div>
                      <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 text-center col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Medidas Técnicas</span>
                        <div className="flex gap-1 justify-center mt-1.5 flex-wrap">
                          {activeQuote.systems.map((sys) => (
                            <span
                              key={sys}
                              className="text-[9px] bg-[#e6f4ff] text-[#006491] font-bold px-2 py-0.5 rounded-lg border border-sky-100"
                            >
                              {sys}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Transcription block */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Transcripción de Inspección de Campo
                      </h4>
                      <div className="bg-slate-50/50 border-l-4 border-[#009fe3] p-4.5 rounded-r-2xl text-xs text-slate-600 italic leading-relaxed font-medium border border-slate-200">
                        "{activeQuote.text}"
                      </div>
                    </div>

                    {/* Conditional rules triggered block */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Especificación Técnica Sugerida
                      </h4>
                      <div className="bg-slate-50/50 rounded-2xl p-4.5 border border-slate-200 space-y-2.5 text-xs text-slate-600 leading-relaxed font-medium">
                        <p className="font-bold text-[#006491] flex items-center gap-1 text-xs uppercase tracking-wide">
                          <span className="material-symbols-outlined text-base">verified</span>
                          Análisis Técnico Alcebo
                        </p>
                        <p className="text-[11px]">
                          Basado en los hallazgos de <strong>{activeQuote.birds.join(', ')}</strong> y las directrices prescritas, se determina la aplicación de:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
                          {activeQuote.systems.includes('Red') && (
                            <li>
                              <strong>Red Perimetral Alcebo:</strong> Red de polietileno de 50mm para palomas, instalada con tensores de acero inoxidables anclados a la cornisa del edificio.
                            </li>
                          )}
                          {activeQuote.systems.includes('Varillas') && (
                            <li>
                              <strong>Varillas Disuasorias Alcebo:</strong> Púas de acero inoxidable AISI 302 fijadas con polímero neutro en las repisas y molduras inferiores.
                            </li>
                          )}
                          {activeQuote.text.toLowerCase().includes('guano') && (
                            <li>
                              <strong>Saneamiento de Guano:</strong> Limpieza mecánica preventiva previa, higienización biológica con desinfectante de amplio espectro.
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Field Notes */}
                    {activeQuote.notes && (
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Notas Internas del Técnico
                        </h4>
                        <p className="text-xs text-slate-500 font-medium bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl">
                          {activeQuote.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PDF Print/Export Preview Footer */}
              {!isEditing && (
                <div className="bg-slate-50 border-t border-slate-200/80 px-6 py-4 flex justify-between items-center text-xs text-slate-400 font-bold">
                  <span>ID Registro: {activeQuote.id}</span>
                  <button
                    onClick={() => {
                      triggerNotification(`Propuesta para ${activeQuote.clientName} enviada con éxito.`);
                    }}
                    className="bg-[#009fe3] text-white hover:bg-[#006491] font-black text-xs px-4.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-[#009fe3]/10 hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-sm">download_for_offline</span>
                    Enviar Propuesta Comercial
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
