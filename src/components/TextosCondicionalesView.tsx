import React, { useState } from 'react';
import { ConditionalText } from '../types';

interface TextosCondicionalesViewProps {
  rules: ConditionalText[];
  onUpdateRule: (updatedRule: ConditionalText) => void;
  onAddRule: (newRule: ConditionalText) => void;
  onDeleteRule: (id: string) => void;
}

export default function TextosCondicionalesView({
  rules,
  onUpdateRule,
  onAddRule,
  onDeleteRule,
}: TextosCondicionalesViewProps) {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(rules[0]?.id || null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Form states
  const [formTitle, setFormTitle] = useState<string>('');
  const [formBirdType, setFormBirdType] = useState<string>('');
  const [formSystemType, setFormSystemType] = useState<string>('');
  const [formCondition, setFormCondition] = useState<string>('');
  const [formTextToInclude, setFormTextToInclude] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const activeRule = rules.find((r) => r.id === selectedRuleId);

  const startEdit = (rule: ConditionalText) => {
    setFormTitle(rule.title);
    setFormBirdType(rule.birdType || '');
    setFormSystemType(rule.systemType || '');
    setFormCondition(rule.condition);
    setFormTextToInclude(rule.textToInclude);
    setFormIsActive(rule.isActive);
    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreate = () => {
    setFormTitle('');
    setFormBirdType('');
    setFormSystemType('');
    setFormCondition('Aves = [Ave] Y Sistema = [Sistema]');
    setFormTextToInclude('Texto técnico a insertar...');
    setFormIsActive(true);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (isCreating) {
      const newRule: ConditionalText = {
        id: 'cond-' + Date.now(),
        title: formTitle || 'Nueva Regla Condicional',
        birdType: formBirdType || undefined,
        systemType: formSystemType || undefined,
        condition: formCondition,
        textToInclude: formTextToInclude,
        isActive: formIsActive,
      };
      onAddRule(newRule);
      setSelectedRuleId(newRule.id);
      setIsCreating(false);
    } else if (isEditing && activeRule) {
      const updated: ConditionalText = {
        ...activeRule,
        title: formTitle,
        birdType: formBirdType || undefined,
        systemType: formSystemType || undefined,
        condition: formCondition,
        textToInclude: formTextToInclude,
        isActive: formIsActive,
      };
      onUpdateRule(updated);
      setIsEditing(false);
    }
  };

  const toggleRuleActive = (rule: ConditionalText) => {
    onUpdateRule({
      ...rule,
      isActive: !rule.isActive,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#009fe3] text-2xl">rule</span>
            Textos Técnicos Condicionales
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Define fragmentos de texto que se auto-insertarán en la propuesta basándose en el tipo de ave o sistema seleccionado.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="bg-[#009fe3] text-white hover:bg-[#006491] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-base">add_box</span>
          Nueva Regla
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: rules list (4/12 wide) */}
        <div className="lg:col-span-4 space-y-3">
          {rules.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold">
              <span className="material-symbols-outlined text-[#009fe3] text-2xl block mb-2">rule</span>
              No hay textos condicionales creados.
              <button
                onClick={startCreate}
                className="mt-3 block w-full py-2 bg-slate-50 hover:bg-[#e6f4ff] hover:text-[#006491] border border-slate-200 rounded-xl text-[11px] font-black transition-colors cursor-pointer"
              >
                + Crear Primera Regla
              </button>
            </div>
          ) : (
            rules.map((rule) => {
              const isSelected = selectedRuleId === rule.id && !isCreating;
              return (
                <div
                  key={rule.id}
                  onClick={() => {
                    setSelectedRuleId(rule.id);
                    setIsEditing(false);
                    setIsCreating(false);
                  }}
                  className={`bg-white border rounded-2xl p-4.5 transition-all cursor-pointer hover:shadow-xs flex flex-col gap-2 relative overflow-hidden ${
                    isSelected
                      ? 'border-[#009fe3] ring-1 ring-[#009fe3]/50'
                      : 'border-slate-200/80'
                  }`}
                >
                  {/* Lateral indicator indicating if active or inactive */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  ></div>

                  <div className="flex justify-between items-start gap-2 pl-1">
                    <h3 className="text-xs font-black text-slate-800 leading-tight tracking-tight">{rule.title}</h3>
                    {/* Active Slide Switch Indicator */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRuleActive(rule);
                    }}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-white rounded-full transition-transform ${
                        rule.isActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    ></div>
                  </button>
                </div>

                <p className="text-[10px] font-mono text-slate-400 pl-1 font-bold">{rule.condition}</p>

                <p className="text-xs text-slate-500 pl-1 line-clamp-2 italic font-medium">
                  "{rule.textToInclude}"
                </p>
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
                <span className="material-symbols-outlined text-[#006491] text-lg">rule</span>
                <h2 className="font-bold text-slate-700 text-xs tracking-wide uppercase">
                  {isCreating
                    ? 'Creando Regla Dinámica'
                    : isEditing
                    ? `Editando ${formTitle}`
                    : activeRule
                    ? activeRule.title
                    : 'Cláusulas Condicionales'}
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
                  activeRule && (
                    <>
                      <button
                        onClick={() => startEdit(activeRule)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm text-[#009FE3]">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm('¿Estás seguro de que deseas eliminar esta regla?')
                          ) {
                            onDeleteRule(activeRule.id);
                            setSelectedRuleId(rules[0]?.id || null);
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
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Título descriptivo:</label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ej. Anclaje Especial de Piedra"
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sintaxis del Disparador:</label>
                      <input
                        type="text"
                        value={formCondition}
                        onChange={(e) => setFormCondition(e.target.value)}
                        placeholder="Ej. Contiene 'andamio' o 'altura'"
                        className="p-3 bg-slate-100 border border-slate-250 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro de Ave (Opcional):</label>
                      <select
                        value={formBirdType}
                        onChange={(e) => setFormBirdType(e.target.value)}
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all bg-white"
                      >
                        <option value="">Todas las aves</option>
                        <option value="Palomas">Palomas</option>
                        <option value="Golondrinas">Golondrinas</option>
                        <option value="Urracas">Urracas</option>
                        <option value="Gaviotas">Gaviotas</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro de Sistema (Opcional):</label>
                      <select
                        value={formSystemType}
                        onChange={(e) => setFormSystemType(e.target.value)}
                        className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all bg-white"
                      >
                        <option value="">Todos los sistemas</option>
                        <option value="Red">Red</option>
                        <option value="Varillas">Varillas</option>
                        <option value="Eléctrico">Eléctrico</option>
                        <option value="Capturas">Capturas</option>
                      </select>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-3 py-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado de la Regla:</label>
                    <button
                      onClick={() => setFormIsActive(!formIsActive)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        formIsActive ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          formIsActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      ></div>
                    </button>
                    <span className="text-xs font-bold text-slate-600">
                      {formIsActive ? 'Activa (Se insertará si cumple)' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cláusula Técnica a Insertar:</label>
                    <textarea
                      value={formTextToInclude}
                      onChange={(e) => setFormTextToInclude(e.target.value)}
                      rows={4}
                      placeholder="Escribe el texto descriptivo del material o la metodología que se agregará..."
                      className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#009fe3] focus:ring-1 focus:ring-[#009fe3]/30 transition-all font-sans resize-none"
                    />
                  </div>
                </div>
              ) : activeRule ? (
                // DISPLAY RULE DETAILS
                <div className="space-y-6 text-sm text-slate-600">
                  <div className="flex justify-between items-center bg-slate-50/80 border border-slate-200 rounded-2xl p-4.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gatillo / Condición</span>
                      <p className="text-xs font-mono font-bold text-[#006491] mt-1 bg-slate-100/80 px-2 py-1 rounded-md">
                        {activeRule.condition}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado Regla</span>
                      <span
                        className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                          activeRule.isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {activeRule.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ave Filtrada</span>
                      <p className="text-xs font-bold text-slate-700 mt-1">
                        {activeRule.birdType || 'Cualquiera'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sistema Relacionado</span>
                      <p className="text-xs font-bold text-slate-700 mt-1">
                        {activeRule.systemType || 'Cualquiera'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-[#009fe3]">description</span>
                      Cláusula técnica de inserción
                    </h4>
                    <div className="bg-[#f9f9fa] border-l-4 border-[#009FE3] p-4.5 rounded-r-2xl text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 border border-slate-200 border-l-4">
                      "{activeRule.textToInclude}"
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-12">
                  Selecciona una regla condicional o crea una nueva para empezar.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
