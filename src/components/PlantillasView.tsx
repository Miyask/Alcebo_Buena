import React, { useState } from 'react';
import { Template } from '../types';

interface PlantillasViewProps {
  templates: Template[];
  onUpdateTemplate: (updatedTemplate: Template) => void;
  onAddTemplate: (newTemplate: Template) => void;
  onDeleteTemplate: (id: string) => void;
}

export default function PlantillasView({
  templates,
  onUpdateTemplate,
  onAddTemplate,
  onDeleteTemplate,
}: PlantillasViewProps) {
  const [selectedTempId, setSelectedTempId] = useState<string | null>(templates[0]?.id || null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Form states for creating/editing
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSystems, setFormSystems] = useState<string[]>([]);
  const [formBasePrice, setFormBasePrice] = useState<number>(0);
  const [formIntroText, setFormIntroText] = useState<string>('');
  const [formFooterText, setFormFooterText] = useState<string>('');

  const activeTemplate = templates.find((t) => t.id === selectedTempId);

  const startEdit = (temp: Template) => {
    setFormName(temp.name);
    setFormDescription(temp.description);
    setFormSystems(temp.systems);
    setFormBasePrice(temp.basePricePerMeter);
    setFormIntroText(temp.introText);
    setFormFooterText(temp.footerText);
    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormSystems([]);
    setFormBasePrice(25.00);
    setFormIntroText('En respuesta a su solicitud de cotización...');
    setFormFooterText('La garantía de los materiales es de 3 años...');
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (isCreating) {
      const newTemp: Template = {
        id: 'temp-' + Date.now(),
        name: formName || 'Nueva Plantilla Técnica',
        description: formDescription || 'Descripción de la plantilla',
        systems: formSystems.length > 0 ? formSystems : ['Red'],
        basePricePerMeter: formBasePrice,
        introText: formIntroText,
        footerText: formFooterText,
      };
      onAddTemplate(newTemp);
      setSelectedTempId(newTemp.id);
      setIsCreating(false);
    } else if (isEditing && activeTemplate) {
      const updated: Template = {
        ...activeTemplate,
        name: formName,
        description: formDescription,
        systems: formSystems,
        basePricePerMeter: formBasePrice,
        introText: formIntroText,
        footerText: formFooterText,
      };
      onUpdateTemplate(updated);
      setIsEditing(false);
    }
  };

  const toggleFormSystem = (sys: string) => {
    setFormSystems((prev) =>
      prev.includes(sys) ? prev.filter((s) => s !== sys) : [...prev, sys]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#009fe3] text-2xl">style</span>
            Plantillas Técnicas de Trabajo
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Gestiona los textos comerciales predeterminados, cláusulas de garantía y tarifas base por metro lineal de exclusión.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="bg-[#009fe3] text-white hover:bg-[#006491] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Nueva Plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: templates list (4/12 wide) */}
        <div className="lg:col-span-4 space-y-3">
          {templates.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold">
              <span className="material-symbols-outlined text-[#009fe3] text-2xl block mb-2">style</span>
              No hay plantillas técnicas creadas.
              <button
                onClick={startCreate}
                className="mt-3 block w-full py-2 bg-slate-50 hover:bg-[#e6f4ff] hover:text-[#006491] border border-slate-200 rounded-xl text-[11px] font-black transition-colors cursor-pointer"
              >
                + Crear Primera Plantilla
              </button>
            </div>
          ) : (
            templates.map((temp) => {
              const isSelected = selectedTempId === temp.id && !isCreating;
              return (
                <div
                  key={temp.id}
                  onClick={() => {
                    setSelectedTempId(temp.id);
                    setIsEditing(false);
                    setIsCreating(false);
                  }}
                  className={`bg-white border rounded-2xl p-4.5 transition-all cursor-pointer hover:shadow-xs relative ${
                    isSelected
                      ? 'border-[#009fe3] ring-1 ring-[#009fe3]/50'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-xs font-black text-slate-800 leading-tight tracking-tight">{temp.name}</h3>
                    <span className="text-[11px] font-mono font-bold text-[#006491] bg-[#e6f4ff] px-2 py-0.5 rounded-md shrink-0">
                      {temp.basePricePerMeter} €/m
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 font-medium">{temp.description}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {temp.systems.map((s) => (
                      <span
                        key={s}
                        className="text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right column: workspace details (8/12 wide) */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[420px]">
            {/* Toolbar Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006491] text-lg">tactic</span>
                <h2 className="font-bold text-slate-700 text-xs tracking-wide uppercase">
                  {isCreating
                    ? 'Creando Nueva Plantilla'
                    : isEditing
                    ? `Editando ${formName}`
                    : activeTemplate
                    ? activeTemplate.name
                    : 'Detalles de Plantilla'}
                </h2>
              </div>
              <div className="flex gap-2">
                {isCreating || isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setIsCreating(false);
                      }}
                      className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  activeTemplate && (
                    <>
                      <button
                        onClick={() => startEdit(activeTemplate)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm text-[#009FE3]">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm('¿Estás seguro de que deseas eliminar esta plantilla?')
                          ) {
                            onDeleteTemplate(activeTemplate.id);
                            setSelectedTempId(templates[0]?.id || null);
                          }
                        }}
                        className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Eliminar
                      </button>
                    </>
                  )
                )}
              </div>
            </div>

            {/* Content Form / Display */}
            <div className="p-6 flex-1 space-y-4">
              {isCreating || isEditing ? (
                // EDIT OR CREATE FORM
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre de la Plantilla:</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Ej. Control Completo de Fachadas"
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Precio Base por Metro (€):</label>
                      <input
                        type="number"
                        value={formBasePrice}
                        onChange={(e) => setFormBasePrice(parseFloat(e.target.value) || 0)}
                        placeholder="Ej. 35.00"
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Breve Descripción Comercial:</label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Ej. Protección integral con redes y limpieza profunda..."
                      className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                    />
                  </div>

                  {/* Systems checkboxes */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Sistemas Físicos Asociados:
                    </label>
                    <div className="flex flex-wrap gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {['Red', 'Varillas', 'Eléctrico', 'Capturas'].map((sys) => {
                        const isChecked = formSystems.includes(sys);
                        return (
                          <label
                            key={sys}
                            onClick={() => toggleFormSystem(sys)}
                            className="flex items-center gap-2 text-xs font-bold cursor-pointer text-slate-700 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-[#009fe3] focus:ring-[#009fe3]"
                            />
                            {sys}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Párrafo de Introducción Comercial:</label>
                    <textarea
                      value={formIntroText}
                      onChange={(e) => setFormIntroText(e.target.value)}
                      rows={3}
                      placeholder="Texto que inicia la propuesta formal enviada al cliente..."
                      className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all font-sans resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cláusula de Garantía / Pie de Página:</label>
                    <textarea
                      value={formFooterText}
                      onChange={(e) => setFormFooterText(e.target.value)}
                      rows={2}
                      placeholder="Ej. Garantía de los materiales de 5 años..."
                      className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all font-sans resize-none"
                    />
                  </div>
                </div>
              ) : activeTemplate ? (
                // DISPLAY ACTIVE DETAILS
                <div className="space-y-6 text-sm text-slate-600">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarifa Establecida</span>
                      <p className="text-xl font-black text-[#006491] mt-1">
                        {activeTemplate.basePricePerMeter.toFixed(2)} € <span className="text-xs font-medium text-slate-400">/ metro lineal</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sistemas Incorporados</span>
                      <div className="flex gap-1 mt-1 justify-end">
                        {activeTemplate.systems.map((s) => (
                          <span
                            key={s}
                            className="text-[9px] bg-white border border-slate-200 text-slate-600 font-bold px-2.5 py-0.5 rounded-lg"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descripción de la Categoría</h4>
                    <p className="text-slate-700 font-bold text-xs">{activeTemplate.description}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-[#009fe3]">format_quote</span>
                      Párrafo Introductorio para el Cliente
                    </h4>
                    <p className="text-xs italic text-slate-600 bg-white p-3.5 rounded-xl border border-slate-150 leading-relaxed font-medium">
                      "{activeTemplate.introText}"
                    </p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-emerald-500">verified_user</span>
                      Cláusula de Garantía y Post-Servicio
                    </h4>
                    <p className="text-xs text-slate-600 bg-white p-3.5 rounded-xl border border-slate-150 leading-relaxed font-medium">
                      {activeTemplate.footerText}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-12">
                  Selecciona una plantilla técnica o crea una nueva para empezar.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
