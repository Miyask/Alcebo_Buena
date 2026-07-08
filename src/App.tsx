import React, { useState, useEffect } from 'react';
import { Quote, Template, ConditionalText, SystemConfig } from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_TEMPLATES,
  DEFAULT_CONDITIONAL_TEXTS,
  DEFAULT_QUOTES,
} from './data/defaults';

// Components
import Sidebar from './components/Sidebar';
import TopAppBar from './components/TopAppBar';
import DashboardView from './components/DashboardView';
import PresupuestosView from './components/PresupuestosView';
import DocumentEditor from './components/DocumentEditor';
import PlantillasView from './components/PlantillasView';
import TextosCondicionalesView from './components/TextosCondicionalesView';
import SettingsView from './components/SettingsView';

export default function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Domain States (Initialized with localStorage or sensible defaults)
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const stored = localStorage.getItem('alcebo_quotes');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Remove any example budgets to keep the delivery clean
      return parsed.filter((q: Quote) => q.id !== 'q-example-1');
    }
    return [];
  });

  const [templates, setTemplates] = useState<Template[]>(() => {
    const stored = localStorage.getItem('alcebo_templates');
    return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
  });

  const [rules, setRules] = useState<ConditionalText[]>(() => {
    const stored = localStorage.getItem('alcebo_rules');
    return stored ? JSON.parse(stored) : DEFAULT_CONDITIONAL_TEXTS;
  });

  const [config, setConfig] = useState<SystemConfig>(() => {
    const stored = localStorage.getItem('alcebo_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Force reset to Groq if using old OpenRouter key or empty format
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

  const [draftQuote, setDraftQuote] = useState<Quote>(getNewBlankQuote);

  // Persist States to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('alcebo_quotes', JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem('alcebo_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('alcebo_rules', JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem('alcebo_config', JSON.stringify(config));
  }, [config]);

  // Callbacks for Quotes
  const handleAddQuote = (newQuote: Quote) => {
    setQuotes((prev) => [newQuote, ...prev]);
    setCurrentTab('presupuestos'); // Shift user to the budgets screen to inspect the new entry
  };

  const handleUpdateQuote = (updatedQuote: Quote) => {
    setQuotes((prev) => prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)));
  };

  const handleDeleteQuote = (id: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  // Callbacks for Templates
  const handleAddTemplate = (newTemp: Template) => {
    setTemplates((prev) => [...prev, newTemp]);
  };

  const handleUpdateTemplate = (updatedTemp: Template) => {
    setTemplates((prev) => prev.map((t) => (t.id === updatedTemp.id ? updatedTemp : t)));
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // Callbacks for Rules
  const handleAddRule = (newRule: ConditionalText) => {
    setRules((prev) => [...prev, newRule]);
  };

  const handleUpdateRule = (updatedRule: ConditionalText) => {
    setRules((prev) => prev.map((r) => (r.id === updatedRule.id ? updatedRule : r)));
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Callbacks for Config
  const handleSaveConfig = (updatedConfig: SystemConfig) => {
    setConfig(updatedConfig);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased">
      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-h-screen w-full">
        {/* Content viewport area */}
        <main className="flex-1 w-full pt-6 pb-10 px-4 md:px-8 bg-slate-50 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            <DocumentEditor
              quote={draftQuote}
              onSaveQuote={(updatedQuote) => {
                setDraftQuote(updatedQuote);
              }}
              onCancel={() => {
                if (confirm('¿Deseas vaciar los datos del presupuesto actual para crear uno nuevo?')) {
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
    </div>
  );
}
