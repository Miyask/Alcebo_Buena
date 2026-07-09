import React, { useState, useEffect } from 'react';
import { Quote, Template, ConditionalText, SystemConfig } from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_TEMPLATES,
  DEFAULT_CONDITIONAL_TEXTS,
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

  useEffect(() => {
    localStorage.setItem('alcebo_current_quote', JSON.stringify(draftQuote));
  }, [draftQuote]);

  // Callbacks for Quotes
  const handleAddQuote = (newQuote: Quote) => {
    setQuotes((prev) => [newQuote, ...prev]);
    setDraftQuote(newQuote);
    setCurrentTab('editor'); // Go directly to the editor for this quote
  };

  const handleUpdateQuote = (updatedQuote: Quote) => {
    setQuotes((prev) => prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)));
    setDraftQuote(updatedQuote);
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
      {/* Sidebar navigation: hide in editor tab to prevent squeezing the layout */}
      {currentTab !== 'editor' && (
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      )}
      
      {/* Main Workspace Frame: remove left margin when sidebar is hidden */}
      <div className={`flex-1 flex flex-col min-h-screen w-full ${currentTab !== 'editor' ? 'md:pl-64' : ''}`}>
        {/* Top App Bar: hide in editor tab */}
        {currentTab !== 'editor' && (
          <TopAppBar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
        
        {/* Content viewport area: offset top padding when fixed header is active */}
        <main className={`flex-1 w-full pb-10 px-4 md:px-8 bg-slate-50 overflow-x-hidden ${currentTab !== 'editor' ? 'pt-24' : 'pt-6'}`}>
          <div className={`${currentTab === 'editor' ? 'max-w-none' : 'max-w-7xl'} mx-auto w-full`}>
            {currentTab === 'dashboard' && (
              <DashboardView onAddQuote={handleAddQuote} config={config} />
            )}
            
            {currentTab === 'presupuestos' && (
              <PresupuestosView
                quotes={quotes}
                searchQuery={searchQuery}
                onUpdateQuote={handleUpdateQuote}
                onDeleteQuote={handleDeleteQuote}
                templates={templates}
                rules={rules}
              />
            )}
            
            {currentTab === 'editor' && (
              <DocumentEditor
                quote={draftQuote}
                onSaveQuote={(updatedQuote) => {
                  handleUpdateQuote(updatedQuote);
                }}
                onCancel={() => {
                  setCurrentTab('presupuestos'); // Return to list of budgets
                }}
                templates={templates}
                rules={rules}
                config={config}
              />
            )}
            
            {currentTab === 'settings' && (
              <SettingsView config={config} onSaveConfig={handleSaveConfig} />
            )}
            
            {currentTab === 'plantillas' && (
              <PlantillasView
                templates={templates}
                onAddTemplate={handleAddTemplate}
                onUpdateTemplate={handleUpdateTemplate}
                onDeleteTemplate={handleDeleteTemplate}
              />
            )}
            
            {currentTab === 'condicionales' && (
              <TextosCondicionalesView
                rules={rules}
                onAddRule={handleAddRule}
                onUpdateRule={handleUpdateRule}
                onDeleteRule={handleDeleteRule}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
