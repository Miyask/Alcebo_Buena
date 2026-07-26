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

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<any, any> {
  state: any;
  props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', background: '#fef2f2', border: '2px solid #fee2e2', borderRadius: '16px', margin: '40px auto', maxWidth: '600px', fontFamily: 'sans-serif', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#991b1b', marginTop: 0, fontSize: '20px', fontWeight: 'bold' }}>⚠️ Ha ocurrido un error en la aplicación</h2>
          <p style={{ color: '#7f1d1d', fontSize: '13px', lineHeight: '1.5' }}>
            La base de datos local del navegador contiene algún presupuesto dañado debido a los cuelgues anteriores. Para solucionar esto y volver a entrar a la aplicación de inmediato, haz clic en el botón de abajo para reiniciar tu base de datos local:
          </p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ background: '#dc2626', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', marginTop: '10px', boxShadow: '0 4px 6px -1px rgba(220,38,38,0.2)', transition: 'all 0.2s' }}
          >
            Limpiar Datos y Reiniciar
          </button>
          <div style={{ marginTop: '25px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Detalles técnicos del error:</span>
            <pre style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', overflowX: 'auto', border: '1px solid #e2e8f0', fontSize: '11px', color: '#334155', marginTop: '5px', maxHeight: '200px' }}>
              {this.state.error?.toString()}<br/>
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Domain States (Initialized with localStorage or sensible defaults)
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    try {
      const stored = localStorage.getItem('alcebo_quotes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((q: Quote) => q && q.id && q.id !== 'q-example-1');
        }
      }
    } catch (e) {
      console.error('Error parsing alcebo_quotes from localStorage:', e);
    }
    return [];
  });

  const [templates, setTemplates] = useState<Template[]>(() => {
    try {
      const stored = localStorage.getItem('alcebo_templates');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error parsing alcebo_templates from localStorage:', e);
    }
    return DEFAULT_TEMPLATES;
  });

  const [rules, setRules] = useState<ConditionalText[]>(() => {
    try {
      const stored = localStorage.getItem('alcebo_rules');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error parsing alcebo_rules from localStorage:', e);
    }
    return DEFAULT_CONDITIONAL_TEXTS;
  });

  const [config, setConfig] = useState<SystemConfig>(() => {
    try {
      const stored = localStorage.getItem('alcebo_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Error parsing alcebo_config from localStorage:', e);
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
    try {
      const stored = localStorage.getItem('alcebo_current_quote');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Error parsing alcebo_current_quote from localStorage:', e);
    }
    return getNewBlankQuote();
  });

  // Persist States to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('alcebo_quotes', JSON.stringify(quotes));
    } catch (e) {
      console.error('Error saving alcebo_quotes to localStorage:', e);
    }
  }, [quotes]);

  useEffect(() => {
    try {
      localStorage.setItem('alcebo_templates', JSON.stringify(templates));
    } catch (e) {
      console.error('Error saving alcebo_templates to localStorage:', e);
    }
  }, [templates]);

  useEffect(() => {
    try {
      localStorage.setItem('alcebo_rules', JSON.stringify(rules));
    } catch (e) {
      console.error('Error saving alcebo_rules to localStorage:', e);
    }
  }, [rules]);

  useEffect(() => {
    try {
      localStorage.setItem('alcebo_config', JSON.stringify(config));
    } catch (e) {
      console.error('Error saving alcebo_config to localStorage:', e);
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem('alcebo_current_quote', JSON.stringify(draftQuote));
    } catch (e) {
      console.error('Error saving alcebo_current_quote to localStorage:', e);
    }
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
