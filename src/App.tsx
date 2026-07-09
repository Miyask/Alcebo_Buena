import React, { useState, useEffect } from 'react';
import { Quote, Template, ConditionalText, SystemConfig } from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_TEMPLATES,
  DEFAULT_CONDITIONAL_TEXTS,
} from './data/defaults';

// Components
import DocumentEditor from './components/DocumentEditor';

export default function App() {
  // Domain States (Initialized with localStorage or sensible defaults)
  const [templates] = useState<Template[]>(() => {
    const stored = localStorage.getItem('alcebo_templates');
    return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
  });

  const [rules] = useState<ConditionalText[]>(() => {
    const stored = localStorage.getItem('alcebo_rules');
    return stored ? JSON.parse(stored) : DEFAULT_CONDITIONAL_TEXTS;
  });

  const [config] = useState<SystemConfig>(() => {
    const stored = localStorage.getItem('alcebo_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!parsed.groqApiKey || !parsed.groqApiKey.startsWith('gsk_')) {
        return DEFAULT_CONFIG;
      }
      return parsed;
    }
    return DEFAULT_CONFIG;
  });

  // Helper to generate a fresh new empty quote
  const getNewBlankQuote = (): Quote => ({
    id: 'q-new-' + Date.now(),
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
    notes: '',
    images: []
  });

  const [draftQuote, setDraftQuote] = useState<Quote>(() => {
    const stored = localStorage.getItem('alcebo_current_quote');
    return stored ? JSON.parse(stored) : getNewBlankQuote();
  });

  // Persist current draft quote state to localStorage
  useEffect(() => {
    localStorage.setItem('alcebo_current_quote', JSON.stringify(draftQuote));
  }, [draftQuote]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased justify-center">
      {/* Content viewport area */}
      <main className="flex-1 w-full pt-10 pb-10 px-4 md:px-8 bg-slate-50 overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto">
          <DocumentEditor
            quote={draftQuote}
            onSaveQuote={(updatedQuote) => {
              setDraftQuote(updatedQuote);
            }}
            onCancel={() => {
              if (confirm('¿Deseas vaciar todos los datos de este documento de Word para crear uno nuevo desde cero?')) {
                setDraftQuote(getNewBlankQuote());
              }
            }}
            templates={templates}
            rules={rules}
            config={config}
          />
        </div>
      </main>
    </div>
  );
}
