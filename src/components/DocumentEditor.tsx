import React, { useState, useEffect, useRef } from 'react';
import logoUrl from '../assets/logo.png';
import { Quote, Template, ConditionalText, SystemConfig } from '../types';
import { DEFAULT_CONDITIONAL_TEXTS, DEFAULT_TEMPLATES } from '../data/defaults';
import ImageAnnotator from './ImageAnnotator';
import { WORD_TEMPLATE_HTML } from '../data/wordTemplateHtml';
import { WATERMARK_BASE64 } from '../data/watermarkBase64';
import PizZip from 'pizzip';
import { WORD_TEMPLATE_BASE64 } from '../data/wordTemplateBase64';
import { BIRDS_DATA } from '../data/birdsData';
import { extractAudioFromMediaFile } from '../utils/audioCompressor';

const escapeXml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Extract base64 images from template HTML on module load
let IMAGE_RED_BASE64 = '';
let IMAGE_VARILLAS_BASE64 = '';

const matchRed = WORD_TEMPLATE_HTML.match(/RED NETWORK ANTI-PALOMAS[\s\S]*?<img src="data:image\/jpeg;base64,([^"]+)"/i);
if (matchRed && matchRed[1]) IMAGE_RED_BASE64 = 'data:image/jpeg;base64,' + matchRed[1];

const matchVarillas = WORD_TEMPLATE_HTML.match(/VARILLAS AVIPOINT[\s\S]*?<img src="data:image\/jpeg;base64,([^"]+)"/i);
if (matchVarillas && matchVarillas[1]) IMAGE_VARILLAS_BASE64 = 'data:image/jpeg;base64,' + matchVarillas[1];

interface PriceItem {
  label: string;
  amount: string;
}

const DEFAULT_PRICE_ITEMS: PriceItem[] = [
  { label: 'Protección canalones del tejado (Red Paloma)', amount: '300.00' },
  { label: 'Protección de huecos de ventilación.', amount: '150.00' },
  { label: 'Protección de las 2 cornisas superiores (Red y Varilla)', amount: '450.00' },
];

const getPriceLinesHtml = (items: PriceItem[]): string => {
  return items.map(item =>
    `<p>- <span class="price-label-field">${escapeXml(item.label)}</span> .......... <strong><span class="price-amount-field">${escapeXml(item.amount)}</span></strong> €</p>`
  ).join('');
};

// Matches the 3 fixed budget lines as they originally appear in WORD_TEMPLATE_HTML, so they can be
// swapped for a dynamic (variable-length) price block.
const FIXED_PRICE_LINES_REGEX = /<p>- Protección canalones del tejado \(Red Paloma\)[\s\S]*?<strong>\[PRECIO_1\]<\/strong> €<\/p><p>- Protección de huecos de ventilación\.[\s\S]*?<strong>\[PRECIO_2\]<\/strong> €<\/p><p>- Protección de las 2 cornisas superiores \(Red y Varilla\)[\s\S]*?<strong>\[PRECIO_3\]<\/strong> €<\/p>/;

// Matches the same 3 lines once already rendered (old saved documents, before price lines had their
// own dynamic label/amount spans), so they can be migrated into the new dynamic block wrapper.
const RENDERED_FIXED_PRICE_LINES_REGEX = /<p>-\s*Protección canalones del tejado \(Red Paloma\)[\s\S]*?<span class="price-field-1">[\s\S]*?<\/p>\s*<p>-\s*Protección de huecos de ventilación\.[\s\S]*?<span class="price-field-2">[\s\S]*?<\/p>\s*<p>-\s*Protección de las 2 cornisas superiores \(Red y Varilla\)[\s\S]*?<span class="price-field-3">[\s\S]*?<\/p>/;

// The small company-stamp image near the signature block sits as a bare, unwrapped <img> in the raw
// template — with no <p> wrapper it loses its intended right-aligned position on export (ends up
// treated as a generic loose image like an inspection photo). Wrap it in a right-aligned paragraph.
const SIGNATURE_STAMP_IMG_REGEX = /<img style="width:160px;[^"]*"[^>]*\/>/;

interface DocumentEditorProps {
  quote: Quote;
  onSaveQuote: (updatedQuote: Quote) => void;
  onCancel: () => void;
  templates?: Template[];
  rules?: ConditionalText[];
  config?: SystemConfig;
}

export default function DocumentEditor({ quote, onSaveQuote, onCancel, templates = DEFAULT_TEMPLATES, rules = DEFAULT_CONDITIONAL_TEXTS, config }: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  
  const [editorHtml, setEditorHtml] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  
  // Selection/editing image states
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string>('');
  
  // Selectors/parameters state for video extraction fallback bindings
  const [selectedBirds, setSelectedBirds] = useState<string[]>(quote.birds && quote.birds.length > 0 ? quote.birds : ['Palomas']);
  const selectedBird = selectedBirds.join(', ') || 'Palomas';
  const primaryBird = selectedBird;
  const [selectedSystems, setSelectedSystems] = useState<string[]>(quote.systems && quote.systems.length > 0 ? quote.systems : ['Red']);
  const selectedSystem = selectedSystems[0] || 'Red';
  const [meters, setMeters] = useState<number>(quote.estimationLineal || 15);
  
  const [quoteDate, setQuoteDate] = useState<string>(quote.date || new Date().toISOString().split('T')[0]);
  
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [customText, setCustomText] = useState<string>(quote.text || '');
  
  // Feature 5: Template selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(quote.templateId || templates[0]?.id || 'temp-red');
  
  // Feature 3: Auto-save status state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');



  const cleanIntroText = (text: string): string => {
    if (!text) return '';
    let cleaned = text
      .replace(/^(Durante la visita realizada pudimos comprobar cómo|Durante la visita pudimos comprobar cómo|Durante la visita realizada pudimos comprobar que|Durante la visita pudimos comprobar que|Durante la visita realizada,? pudimos comprobar cómo|Durante la visita,? pudimos comprobar cómo|Durante la visita realizada|Durante la visita|pudimos comprobar cómo|pudimos comprobar que)\s*/gi, '')
      .trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    }
    return cleaned;
  };

  const cleanProblemText = (text: string): string => {
    if (!text) return '';
    let cleaned = text
      .replace(/^(El problema principal consiste en que|El problema principal radica en que|El problema principal consiste en|El problema principal radica en|El problema principal es que|El problema principal es|El problema principal)\s*/gi, '')
      .trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    }
    return cleaned;
  };

  const wrapImagesInEditor = (html: string): string => {
    const imgRegex = /<img\s+src="data:image\/(jpeg|png);base64,([^"]+)"\s*\/?>/gi;
    let idx = 0;
    return html.replace(imgRegex, (match, type, base64) => {
      idx++;
      if (idx === 1) return match; // Skip logo
      const imgId = `img_template_${idx}`;
      const filename = idx === 2 ? 'Foto_Inspeccion_1.jpg' : idx === 3 ? 'Foto_Inspeccion_2.jpg' : 'Propuesta_Tecnica.jpg';
      
      return `
        <div class="image-container-block no-print-border" style="text-align: center; margin: 20px auto; padding: 12px; border: 2px dashed rgba(0,159,227,0.3); border-radius: 12px; position: relative; display: block; max-width: 580px;" contenteditable="false">
          <div class="image-toolbar no-print" style="display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:10px; background:rgba(15,23,42,0.95); padding:8px 16px; border-radius:10px; width:max-content; margin-left:auto; margin-right:auto; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); color:white; font-family:sans-serif; font-size:11px;">
            <button type="button" onclick="window.drawOnImage('${imgId}')" style="background:#009FE3; color:white; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-family:sans-serif; transition:all 0.2s;">
              🎨 Dibujar
            </button>
            <div style="display:flex; align-items:center; gap:6px; border-left:1px solid rgba(255,255,255,0.2); border-right:1px solid rgba(255,255,255,0.2); padding:0 10px;">
              <span style="font-weight:bold;">Tamaño:</span>
              <input type="range" min="150" max="650" step="5" value="280" oninput="window.resizeImageDOM('${imgId}', this.value)" onchange="window.resizeImageSync('${imgId}', this.value)" style="width:80px; accent-color:#009FE3; cursor:pointer; height:4px; border-radius:2px;" />
            </div>
          </div>
          <img src="data:image/${type};base64,${base64}" class="document-image" data-img-id="${imgId}" style="width:280px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
          <div class="no-print" style="font-size:11px; color:#64748B; font-style:italic; margin-top:8px; text-align:center; font-family:sans-serif; padding:2px 0;">
            Pulsa "Dibujar" para hacer anotaciones.
          </div>
        </div>
      `;
    });
  };

  // Manual input fields that sync with document in real-time
  const [clientNameInput, setClientNameInput] = useState<string>(quote.clientName || 'COMUNIDAD DE VECINOS');
  const [clientAddressInput, setClientAddressInput] = useState<string>(quote.clientAddress || 'Calle Principal s/n');
  const [clientEmailInput, setClientEmailInput] = useState<string>(quote.clientEmail || '');

  useEffect(() => {
    setSelectedBirds(quote.birds && quote.birds.length > 0 ? quote.birds : ['Palomas']);
    setSelectedSystems(quote.systems && quote.systems.length > 0 ? quote.systems : ['Red']);
    setMeters(quote.estimationLineal || 15);
    setCustomText(quote.text || '');
    setClientNameInput(quote.clientName || 'COMUNIDAD DE VECINOS');
    setClientAddressInput(quote.clientAddress || 'Calle Principal s/n');
    setClientEmailInput(quote.clientEmail || '');
  }, [quote]);
  const getSystemsHtml = (activeSystems: string[]): string => {
    let html = '';
    if (activeSystems.includes('Red')) {
      html += `
        <p><strong class="sistema-titulo-field" style="background-color: #fef08a; padding: 1px 4px; border-radius: 2px;">RED NETWORK ANTI-PALOMAS:</strong> sus características generales son las siguientes:</p>
        <ul>
          <li>Base de polietileno trenzado pretratado contra la radiación U.V.</li>
          <li>Fijación de la red sobre cable de 2mm. de diámetro con puntos de anclaje de seguridad y pasadores, todos de acero galvanizado.</li>
          <li>Cada hebra se forma por 3 filamentos dobles, confiriendo una resistencia muy superior a la necesaria y un diámetro de fibras que impide a las palomas posarse sobre la red.</li>
          <li>El diámetro del rombo de la red de paloma (50 mm.) impide que las palomas pasen a su través sin disminuir la luminosidad ni la ventilación natural.</li>
        </ul>
        <img src="${IMAGE_RED_BASE64}" class="document-image" data-img-id="img_system_red" style="width:280px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
      `;
    }
    if (activeSystems.includes('Varillas')) {
      html += `
        <p><strong class="sistema-titulo-field" style="background-color: #fef08a; padding: 1px 4px; border-radius: 2px;">VARILLAS AVIPOINT :</strong> sus características son las siguientes:</p>
        <ul>
          <li>Alambre de acero inoxidable 302 de 1,4 mm. Diámetro emportado en una base de policarbonato protegido contra la luz ultravioleta.</li>
          <li>Punta roma de baja reflectancia que no daña a las aves pero impide su posado.</li>
          <li>Fijación con adhesivo sellador de poliuretano de exteriores.</li>
        </ul>
        <img src="${IMAGE_VARILLAS_BASE64}" class="document-image" data-img-id="img_system_varillas" style="width:280px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
      `;
    }
    if (activeSystems.includes('Eléctrico')) {
      html += `
        <p><strong class="sistema-titulo-field" style="background-color: #fef08a; padding: 1px 4px; border-radius: 2px;">SISTEMA ELECTROESTÁTICO DISUASORIO (ELÉCTRICO):</strong> sus características son las siguientes:</p>
        <ul>
          <li>Solución de alta discreción visual, ideal para edificios catalogados o zonas de alto valor estético.</li>
          <li>Emisión de impulsos electroestáticos de baja frecuencia y baja intensidad, completamente inocuos para las aves pero altamente disuasorios.</li>
          <li>Línea perimetral de conductores de acero inoxidable fijados sobre aisladores de policarbonato estabilizado.</li>
        </ul>
      `;
    }
    if (activeSystems.includes('Capturas')) {
      html += `
        <p><strong class="sistema-titulo-field" style="background-color: #fef08a; padding: 1px 4px; border-radius: 2px;">PLAN DE CAPTURAS SELECTIVAS:</strong> sus características son las siguientes:</p>
        <ul>
          <li>Instalación de jaulas trampa homologadas dotadas de comederos, bebederos y sombreado para garantizar el bienestar animal.</li>
          <li>Revisiones y mantenimiento periódico por técnicos autorizados para control de capturas, retirada selectiva y cebado.</li>
          <li>Retirada y traslado humanitario de los ejemplares de acuerdo con la legislación autonómica de protección y sanidad animal.</li>
        </ul>
      `;
    }
    return html;
  };

  const getBirdsHtml = (birdsList: string[]): string => {
    if (!birdsList || birdsList.length === 0) return '';
    let html = '';
    birdsList.forEach(key => {
      const bird = BIRDS_DATA.find(b => b.key.toLowerCase() === key.toLowerCase() || b.name.toLowerCase() === key.toLowerCase());
      if (bird) {
        html += `<div style="margin-bottom: 22px; padding-bottom: 10px; border-bottom: 1px dashed #cbd5e1;">`;
        html += `<h3 style="color: #009FE3; margin-top: 10px; margin-bottom: 8px; font-size: 13pt; font-weight: bold;">${bird.title}</h3>`;
        const paragraphs = bird.text.split('\n\n').filter(p => p.trim());
        const firstImage = bird.images && bird.images.length > 0 ? bird.images[0] : null;
        paragraphs.forEach((p, idx) => {
          // Float the bird's photo to the left of the first paragraph so the text wraps to its
          // right, instead of the image sitting in its own block before/after the text.
          const imgTag = idx === 0 && firstImage
            ? `<img class="bird-float-img" src="data:${firstImage.mime};base64,${firstImage.base64}" alt="${bird.name}" style="width:150px; height:auto; border-radius: 6px; float: left; margin: 0 12px 8px 0;" />`
            : '';
          html += `<p style="margin-bottom: 8px; text-align: justify; line-height: 1.6; font-size: 11pt; color: #334155;">${imgTag}${p.trim()}</p>`;
        });
        // Any extra photos beyond the first still render centered below the text.
        if (bird.images && bird.images.length > 1) {
          bird.images.slice(1).forEach((img) => {
            html += `<div class="bird-image-block" style="text-align: center; margin: 14px auto;"><img src="data:${img.mime};base64,${img.base64}" alt="${bird.name}" style="width:220px; max-width:100%; height:auto; border-radius: 6px;" /></div>`;
          });
        }
        html += `</div>`;
      } else {
        const rule = (rules && rules.length > 0 ? rules : DEFAULT_CONDITIONAL_TEXTS).find(r => r.birdType?.toLowerCase() === key.toLowerCase());
        if (rule) {
          html += `<div style="margin-bottom: 16px;"><p style="text-align: justify; line-height: 1.6;">${rule.textToInclude}</p></div>`;
        }
      }
    });
    return html;
  };

  const handleDateChange = (val: string) => {
    setQuoteDate(val);
    if (!val) return;
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const dayStr = d.getDate().toString().padStart(2, '0');
      const monthStr = monthNames[d.getMonth()];
      const yearStr = d.getFullYear().toString().substring(2);

      if (editorRef.current) {
        editorRef.current.querySelectorAll('.day-field').forEach(el => { el.textContent = dayStr; });
        editorRef.current.querySelectorAll('.month-field').forEach(el => { el.textContent = monthStr; });
        editorRef.current.querySelectorAll('.year-field').forEach(el => { el.textContent = yearStr; });
      }
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      const desPlagaEl = editorRef.current.querySelector('.des-plaga-block');
      if (desPlagaEl) {
        desPlagaEl.innerHTML = getBirdsHtml(selectedBirds);
      }
      
      editorRef.current.querySelectorAll('.plaga-field').forEach(el => {
        el.textContent = primaryBird;
      });

      const sistemasEl = editorRef.current.querySelector('.sistemas-block');
      if (sistemasEl) {
        sistemasEl.innerHTML = wrapImagesInEditor(getSystemsHtml(selectedSystems));
      }
      
      const priSys = selectedSystems[0] || 'Red';
      const z1 = priSys === 'Red' ? 'Canalones y alféizares principales' : 'Cornisas principales de posado';
      const z2 = priSys === 'Red' ? 'Huecos de ventilación del ático' : 'Zonas comunes y repisas de ventanas';
      const z3 = priSys === 'Varillas' ? 'Cornisa superior trasera' : 'Zonas estructurales secundarias';
      
      const sistemasNombresEl = editorRef.current.querySelector('.sistemas-nombres-field');
      if (sistemasNombresEl) {
        const sysNamesMap: Record<string, string> = {
          'Red': 'Red Network anti-palomas',
          'Varillas': 'Varillas Avipoint',
          'Eléctrico': 'Sistema Electroestático Disuasorio',
          'Capturas': 'Plan de Capturas Selectivas'
        };
        sistemasNombresEl.textContent = selectedSystems.map(s => sysNamesMap[s] || s).join(', ');
      }

      editorRef.current.querySelectorAll('.zona-1-field').forEach(el => { el.textContent = z1; });
      editorRef.current.querySelectorAll('.zona-2-field').forEach(el => { el.textContent = z2; });
      editorRef.current.querySelectorAll('.zona-3-field').forEach(el => { el.textContent = z3; });
      
      editorRef.current.querySelectorAll('.zonas-afectadas-field').forEach(el => {
        el.textContent = priSys === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas';
      });

      setEditorHtml(editorRef.current.innerHTML);
      setSaveStatus('dirty');
    }
  }, [selectedBirds, selectedSystems]);

  const [priceItems, setPriceItems] = useState<PriceItem[]>(() => {
    if (quote.priceItems && quote.priceItems.length > 0) return quote.priceItems;
    if (quote.price1 || quote.price2 || quote.price3) {
      return [
        { label: 'Protección canalones del tejado (Red Paloma)', amount: quote.price1 || '300.00' },
        { label: 'Protección de huecos de ventilación.', amount: quote.price2 || '150.00' },
        { label: 'Protección de las 2 cornisas superiores (Red y Varilla)', amount: quote.price3 || '450.00' },
      ];
    }
    return DEFAULT_PRICE_ITEMS;
  });

  // Debounced auto-save effect
  useEffect(() => {
    if (saveStatus !== 'dirty') return;

    const timer = setTimeout(() => {
      setSaveStatus('saving');
      handleSaveAndSync(true);
      setSaveStatus('saved');
    }, 3000); // Auto-save 3 seconds after user stops modifying

    return () => clearTimeout(timer);
  }, [editorHtml, saveStatus]);

  // Track state changes to mark document as dirty
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Check if the change is a real modification compared to the quote prop
    const isNameChanged = clientNameInput !== (quote.clientName || 'COMUNIDAD DE VECINOS');
    const isAddressChanged = clientAddressInput !== (quote.clientAddress || 'Calle Principal s/n');
    const isEmailChanged = clientEmailInput !== (quote.clientEmail || '');
    const isMetersChanged = meters !== (quote.estimationLineal || 15);
    const isDateChanged = quoteDate !== (quote.date || new Date().toISOString().split('T')[0]);
    const isTextChanged = customText !== (quote.text || '');
    const isTemplateChanged = selectedTemplateId !== (quote.templateId || 'temp-red');
    
    const isPriceItemsChanged = JSON.stringify(priceItems) !== JSON.stringify(quote.priceItems || []);

    const areBirdsChanged = JSON.stringify(selectedBirds) !== JSON.stringify(quote.birds || ['Palomas']);
    const areSystemsChanged = JSON.stringify(selectedSystems) !== JSON.stringify(quote.systems || ['Red']);

    if (
      isNameChanged ||
      isAddressChanged ||
      isEmailChanged ||
      isMetersChanged ||
      isDateChanged ||
      isTextChanged ||
      isTemplateChanged ||
      isPriceItemsChanged ||
      areBirdsChanged ||
      areSystemsChanged
    ) {
      setSaveStatus('dirty');
    }
  }, [selectedBirds, selectedSystems, meters, quoteDate, clientNameInput, clientAddressInput, clientEmailInput, priceItems, customText, selectedTemplateId, quote]);

  // Feature 5: Apply base template to editor DOM fields
  const handleApplyTemplate = (tempId: string) => {
    const temp = templates.find(t => t.id === tempId);
    if (!temp) return;
    
    setSelectedTemplateId(tempId);
    setSelectedSystems(temp.systems);
    
    if (editorRef.current) {
      const introEl = editorRef.current.querySelector('.transcription-field');
      if (introEl) {
        introEl.textContent = temp.introText;
      }
      
      const footerEl = editorRef.current.querySelector('.detalle-adicional-field');
      if (footerEl) {
        footerEl.textContent = temp.footerText;
      }
      
      setEditorHtml(editorRef.current.innerHTML);
      setSaveStatus('dirty');
    }
    showToast(`Plantilla "${temp.name}" aplicada al documento.`);
  };

  const handleClientNameChange = (val: string) => {
    setClientNameInput(val);
    if (editorRef.current) {
      editorRef.current.querySelectorAll('.client-name-field').forEach(el => {
        el.textContent = val.toUpperCase();
      });
    }
  };

  const handleClientAddressChange = (val: string) => {
    setClientAddressInput(val);
    if (editorRef.current) {
      editorRef.current.querySelectorAll('.client-address-field').forEach(el => {
        el.textContent = val;
      });
    }
  };

  const rebuildPriceLinesDOM = (items: PriceItem[]) => {
    if (editorRef.current) {
      const block = editorRef.current.querySelector('.precio-lineas-block');
      if (block) {
        block.innerHTML = getPriceLinesHtml(items);
      }
    }
  };

  const handlePriceLabelChange = (idx: number, val: string) => {
    setPriceItems(prev => prev.map((it, i) => i === idx ? { ...it, label: val } : it));
    if (editorRef.current) {
      const el = editorRef.current.querySelectorAll('.price-label-field')[idx];
      if (el) el.textContent = val;
    }
  };

  const handlePriceAmountChange = (idx: number, val: string) => {
    setPriceItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: val } : it));
    if (editorRef.current) {
      const el = editorRef.current.querySelectorAll('.price-amount-field')[idx];
      if (el) el.textContent = val;
    }
  };

  const handleAddPriceItem = () => {
    setPriceItems(prev => {
      const next = [...prev, { label: 'Nueva partida', amount: '0.00' }];
      rebuildPriceLinesDOM(next);
      return next;
    });
  };

  const handleRemovePriceItem = (idx: number) => {
    setPriceItems(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      rebuildPriceLinesDOM(next);
      return next;
    });
  };

  // Initialize document content on mount
  useEffect(() => {
    setClientNameInput(quote.clientName || 'COMUNIDAD DE VECINOS');
    setClientAddressInput(quote.clientAddress || 'Calle Principal s/n');
    setClientEmailInput(quote.clientEmail || '');
    setSelectedBirds(quote.birds && quote.birds.length > 0 ? quote.birds : ['Palomas']);
    setSelectedSystems(quote.systems && quote.systems.length > 0 ? quote.systems : ['Red']);
    setMeters(quote.estimationLineal || 15);
    if (quote.priceItems && quote.priceItems.length > 0) {
      setPriceItems(quote.priceItems);
    } else if (quote.price1 || quote.price2 || quote.price3) {
      setPriceItems([
        { label: 'Protección canalones del tejado (Red Paloma)', amount: quote.price1 || '300.00' },
        { label: 'Protección de huecos de ventilación.', amount: quote.price2 || '150.00' },
        { label: 'Protección de las 2 cornisas superiores (Red y Varilla)', amount: quote.price3 || '450.00' },
      ]);
    } else {
      setPriceItems(DEFAULT_PRICE_ITEMS);
    }
    setQuoteDate(quote.date || new Date().toISOString().split('T')[0]);
    setSelectedTemplateId(quote.templateId || 'temp-red');

    if (quote.documentHtml && quote.documentHtml.length > 50 && (quote.documentHtml.includes('CONTENIDO') || quote.documentHtml.includes('1.-') || quote.documentHtml.includes('CONTROL DE AVES'))) {
      let docHtml = quote.documentHtml
        .replace(/src="\$\{logoUrl\}"/g, `src="${logoUrl}"`)
        .replace(/src="undefined"/g, `src="${logoUrl}"`);

      const finalRefCode = quote.refCode || (quote.id.startsWith('q-new') ? 'Ref-ALC-[RELLENAR]' : quote.id);

      // Clean up any duplicate cover-page-wrapper that resulted from the previous bug
      if (docHtml.includes('cover-page-wrapper') && (docHtml.match(/cover-page-wrapper/g) || []).length > 1) {
        docHtml = docHtml.replace(
          /<\/div><hr class="page-break" \/><p><strong>CONTENIDO<\/strong><\/p><div class="cover-page-wrapper"[^>]*><p[^>]*><strong>PRESUPUESTO<\/strong><\/p>/gi,
          '</div><hr class="page-break" /><p><strong>CONTENIDO</strong></p><p><strong>presupuesto</strong></p>'
        );
      }
      
      // Patch old drafts that don't have .des-plaga-block
      if (!docHtml.includes('des-plaga-block')) {
        const plagaParagraphRegex = /<p>Las estimaciones indican que una ciudad media mediterránea posee una población de más de 1500 palomas por kilómetro cuadrado[\s\S]*?aprovechar los desechos animales\.\s*<\/p>/gi;
        const heading1Regex = /(<p[^>]*><strong>1\.-  CONTROL DE AVES URBANAS: CUÁLES Y POR QUÉ<\/strong><\/p>)/i;
        if (plagaParagraphRegex.test(docHtml)) {
          docHtml = docHtml.replace(plagaParagraphRegex, '<div class="des-plaga-block"></div>');
        } else if (docHtml.includes('aprovechar los desechos animales.')) {
          docHtml = docHtml.replace(/en zonas rurales se concentran junto a explotaciones ganaderas para aprovechar los desechos animales\.\s*<\/p>/gi, 
            '<div class="des-plaga-block"></div>');
        } else if (heading1Regex.test(docHtml)) {
          docHtml = docHtml.replace(heading1Regex, '$1<div class="des-plaga-block"></div>');
        } else {
          docHtml = '<div class="des-plaga-block"></div>' + docHtml;
        }
      }
      
      // Patch old drafts that don't have .sistemas-block
      if (!docHtml.includes('sistemas-block')) {
        const systemBlockRegex = /<ul><li><strong>RED NETWORK ANTI-PALOMAS[\s\S]*?Fijación con adhesivo sellador de poliuretano de exteriores\.<\/li><\/ul>/i;
        const heading5Regex = /(<p[^>]*><strong>5\.- PROPUESTA DE SOLUCIÓN<\/strong><\/p>)/i;
        if (systemBlockRegex.test(docHtml)) {
          docHtml = docHtml.replace(systemBlockRegex, '<div class="sistemas-block"></div>');
        } else if (heading5Regex.test(docHtml)) {
          docHtml = docHtml.replace(heading5Regex, '$1<div class="sistemas-block"></div>');
        } else {
          docHtml = docHtml.replace(/<p><strong>6\.- PRESUPUESTO/gi, '<div class="sistemas-block"></div><p><strong>6.- PRESUPUESTO');
        }
      }

      // Patch old drafts that don't have cover-page-wrapper
      if (!docHtml.includes('cover-page-wrapper')) {
        docHtml = docHtml
          .replace(/<p><strong>presupuesto<\/strong><\/p>/i, `<div class="cover-page-wrapper" style="text-align: center; padding: 20px 0; font-family: 'Verdana', sans-serif;">
          <div style="border: 2px solid #000; padding: 25px; margin-bottom: 25px; display: inline-block; width: 100%; max-width: 520px; box-sizing: border-box; background: #fff;">
            <img src="${logoUrl}" alt="Alcebo Control de Aves" style="max-width: 320px; height: auto;" />
          </div>
          <div style="margin-bottom: 25px;">
            <div style="border: 2px solid #000; padding: 6px 30px; display: inline-block; background: #fff;">
              <h1 style="font-size: 20pt; font-weight: bold; margin: 0; text-decoration: underline; color: #000;">Informe Técnico</h1>
            </div>
          </div>
          <div style="border: 2px solid #000; padding: 15px 20px; text-align: left; position: relative; max-width: 520px; margin: 0 auto; box-sizing: border-box; min-height: 140px; background: #fff;">
            <div style="font-size: 11pt; font-weight: bold; margin-bottom: 10px; color: #000;">Presupuesto para</div>
            <div style="font-size: 9.5pt; line-height: 1.6; margin-left: 30px; color: #000;">
              <div>Com. Prop. <strong class="client-name-field">${escapeXml(clientNameInput.toUpperCase())}</strong></div>
              <div>C/ <span class="client-address-field">${escapeXml(clientAddressInput)}</span></div>
              <div><span class="postal-code-prefix-field">280</span><span class="postal-code-field">01</span> Madrid</div>
              <div style="margin-top: 6px;">Att: D. <span class="att-name-field">Presidente / Administrador de Fincas</span></div>
            </div>
            <div style="position: absolute; right: 10px; bottom: 10px; border: 1px solid #000; padding: 2px 8px; font-size: 8pt; background: #fff; color: #000;">
              Ref: <span class="ref-code-field">${escapeXml(finalRefCode)}</span>
            </div>
          </div>
        </div>`)
          .replace(/<p><strong>CONTENIDO<\/strong><\/p>/gi, '</div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>');
      }

      // Strip all remaining unboxed cover artifacts before CONTENIDO
      if (docHtml.includes('cover-page-wrapper') && docHtml.includes('CONTENIDO')) {
        const parts = docHtml.split('CONTENIDO');
        let coverPart = parts[0];
        const bodyPart = parts.slice(1).join('CONTENIDO');
        
        coverPart = coverPart
          .replace(/<p[^>]*>\s*<strong>Informe Técnico<\/strong>\s*<\/p>/gi, '')
          .replace(/<p[^>]*>\s*Presupuesto para\s*<\/p>/gi, '')
          .replace(/<p[^>]*>\s*Ref:\s*[^<]*<\/p>/gi, '')
          .replace(/<p[^>]*>\s*Com\.\s*Prop\.\s*[^<]*<\/p>/gi, '')
          .replace(/<p[^>]*>\s*C\/\s*[^<]*<\/p>/gi, '')
          .replace(/<p[^>]*>\s*28001\s*Madrid\s*<\/p>/gi, '')
          .replace(/<p[^>]*>\s*Att:\s*D\.\s*[^<]*<\/p>/gi, '');
          
        docHtml = coverPart + 'CONTENIDO' + bodyPart;
      }
      docHtml = docHtml.replace(/<p[^>]*><strong>presupuesto<\/strong><\/p>/gi, '');

      // Patch old drafts that don't have page-break class at all
      if (!docHtml.includes('page-break')) {
        docHtml = docHtml
          .replace(/<p><strong>1\.-  CONTROL DE AVES URBANAS/gi, '<p><strong>1.-  CONTROL DE AVES URBANAS')
          .replace(/<p><strong>2\.- LEGISLACIÓN<\/strong><\/p>/gi, '<hr class="page-break" /><p><strong>2.- LEGISLACIÓN</strong></p>')
          .replace(/<p><strong>4\.- LA ELECCIÓN DEL SISTEMA/gi, '<hr class="page-break" /><p><strong>4.- LA ELECCIÓN DEL SISTEMA')
          .replace(/<p><strong>6\.- PRESUPUESTO Y GARANTÍAS/gi, '<p><strong>6.- PRESUPUESTO Y GARANTÍAS');
      }

      // These patches are independently idempotent (each checks its own precondition), so they run
      // on EVERY load — including drafts saved before these fixes existed, which the "no page-break at
      // all" gate above would otherwise skip forever since those drafts already contain other page-break
      // markers.
      if (!/<hr class="page-break"\s*\/>\s*<p><strong>ANEXO/i.test(docHtml)) {
        docHtml = docHtml.replace(/<p><strong>ANEXO\s*[–-]\s*Otras Gestiones/gi, '<hr class="page-break" /><p><strong>ANEXO – Otras Gestiones');
      }
      // The official template numbers these as "5.1 Diagnóstico" / "5.2 Propuesta Técnica" (subsections
      // of section 5), not as an independently-numbered list — replace the <ol><li> markup with plain
      // labeled headings so they never render as two separate "1."s.
      docHtml = docHtml
        .replace(/<ol><li><strong>Diagnóstico<\/strong><\/li><\/ol>/, '<p><strong>5.1 Diagnóstico</strong></p>')
        .replace(/<ol(?:\s+start="2")?><li><strong>Propuesta Técnica<\/strong><\/li><\/ol>/, '<p><strong>5.2 Propuesta Técnica</strong></p>');
      docHtml = docHtml.replace(
        /(<p>- Además,[\s\S]*?<\/ul>)\s*(<p><strong>5\.2 Propuesta Técnica<\/strong><\/p>)/,
        '$2$1'
      );
      if (SIGNATURE_STAMP_IMG_REGEX.test(docHtml)) {
        docHtml = docHtml.replace(SIGNATURE_STAMP_IMG_REGEX, (m) => `<p style="text-align: right;">${m}</p>`);
      }

      // Migrate old drafts' fixed 3-line budget into the dynamic (variable-length) price block wrapper
      if (!docHtml.includes('precio-lineas-block') && RENDERED_FIXED_PRICE_LINES_REGEX.test(docHtml)) {
        docHtml = docHtml.replace(RENDERED_FIXED_PRICE_LINES_REGEX, (m) => `<div class="precio-lineas-block">${m}</div>`);
      }

      setEditorHtml(docHtml);
      // Attempt to extract existing values to sync the inputs
      setTimeout(() => {
        if (editorRef.current) {
          const cName = editorRef.current.querySelector('.client-name-field')?.textContent;
          const cAddr = editorRef.current.querySelector('.client-address-field')?.textContent;
          const labelEls = Array.from(editorRef.current.querySelectorAll('.price-label-field')) as HTMLElement[];
          const amountEls = Array.from(editorRef.current.querySelectorAll('.price-amount-field')) as HTMLElement[];
          if (cName) setClientNameInput(cName);
          if (cAddr) setClientAddressInput(cAddr);
          if (amountEls.length > 0) {
            setPriceItems(amountEls.map((el, i) => ({
              label: labelEls[i]?.textContent || `Partida ${i + 1}`,
              amount: el.textContent || '0.00',
            })));
          } else {
            const p1 = editorRef.current.querySelector('.price-field-1')?.textContent;
            const p2 = editorRef.current.querySelector('.price-field-2')?.textContent;
            const p3 = editorRef.current.querySelector('.price-field-3')?.textContent;
            if (p1 || p2 || p3) {
              setPriceItems([
                { label: 'Protección canalones del tejado (Red Paloma)', amount: p1 || '300.00' },
                { label: 'Protección de huecos de ventilación.', amount: p2 || '150.00' },
                { label: 'Protección de las 2 cornisas superiores (Red y Varilla)', amount: p3 || '450.00' },
              ]);
            }
          }
        }
      }, 100);
    } else {
      // Setup the initial HTML using the official Word template and bind placeholders
      let today = quote.date ? new Date(quote.date) : new Date();
      if (isNaN(today.getTime())) today = new Date();
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      
      const dayStr = today.getDate().toString().padStart(2, '0');
      const monthStr = monthNames[today.getMonth()];
      const yearStr = today.getFullYear().toString().substring(2);
      
      const z1 = selectedSystem === 'Red' ? 'Canalones y alféizares principales' : 'Cornisas principales de posado';
      const z2 = selectedSystem === 'Red' ? 'Huecos de ventilación del ático' : 'Zonas comunes y repisas de ventanas';
      const z3 = selectedSystem === 'Varillas' ? 'Cornisa superior trasera' : 'Zonas estructurales secundarias';
      const systemBlockRegex = /<ul><li><strong>RED NETWORK ANTI-PALOMAS[\s\S]*?Fijación con adhesivo sellador de poliuretano de exteriores\.<\/li><\/ul>/i;
      const plagaParagraphRegex = /<p>Las estimaciones indican que una ciudad media mediterránea posee una población de más de 1500 palomas por kilómetro cuadrado[\s\S]*?aprovechar los desechos animales\.\s*<\/p>/gi;
      const templateWithPlaceholders = WORD_TEMPLATE_HTML
        .replace(systemBlockRegex, '<div class="sistemas-block">[DESCRIPCIONES_SISTEMAS]</div>')
        .replace(plagaParagraphRegex, '<div class="des-plaga-block">[DESCRIPCION_PLAGA]</div>')
        .replace(FIXED_PRICE_LINES_REGEX, '<div class="precio-lineas-block">[PRECIO_LINEAS]</div>')
        .replace(SIGNATURE_STAMP_IMG_REGEX, (m) => `<p style="text-align: right;">${m}</p>`)
        .replace(/<ol><li><strong>Diagnóstico<\/strong><\/li><\/ol>/, '<p><strong>5.1 Diagnóstico</strong></p>')
        .replace(/<ol(?:\s+start="2")?><li><strong>Propuesta Técnica<\/strong><\/li><\/ol>/, '<p><strong>5.2 Propuesta Técnica</strong></p>')
        .replace(
          /(<p>- Además,[\s\S]*?<\/ul>)\s*(<p><strong>5\.2 Propuesta Técnica<\/strong><\/p>)/,
          '$2$1'
        );

      const textForIntro = cleanIntroText(quote.introTecnica || quote.text || "las aves se posaban y anidaban activamente en las zonas elevadas, provocando acumulación de suciedad y daños estructurales");
      const textForProblem = cleanProblemText(quote.problemaPrincipal || "es la acumulación de excrementos y el consiguiente deterioro estético e higiénico.");
      const textForDetail = quote.detalleAdicional || "las bajantes de agua pluvial estaban obstruidas por nidos y plumas";
      const finalRefCode = quote.refCode || (quote.id.startsWith('q-new') ? 'Ref-ALC-[RELLENAR]' : quote.id);

      let initialHtml = templateWithPlaceholders
        .replace(/\[REF_CODE\]/g, `<span class="ref-code-field">${finalRefCode}</span>`)
        .replace(/\[CLIENT_NAME\]/g, `<span class="client-name-field">${clientNameInput.toUpperCase()}</span>`)
        .replace(/\[CLIENT_ADDRESS\]/g, `<span class="client-address-field">${clientAddressInput}</span>`)
        .replace(/\[POSTAL_CODE\]/g, `<span class="postal-code-field">28001</span>`)
        .replace(/\[POSTAL_CODE_PREFIX\]/g, `<span class="postal-code-prefix-field">280</span>`)
        .replace(/\[ATT_NAME\]/g, `<span class="att-name-field">Presidente / Administrador de Fincas</span>`)
        .replace(/\[DAY\]/g, `<span class="day-field">${dayStr}</span>`)
        .replace(/\[MONTH\]/g, `<span class="month-field">${monthStr}</span>`)
        .replace(/\[YEAR\]/g, `<span class="year-field">${yearStr}</span>`)
        .replace(/\[PLAGA\]palomas/gi, `<span class="plaga-field">${selectedBird}</span>`)
        .replace(/\[PLAGA\]/g, `<span class="plaga-field">${selectedBird}</span>`)
        .replace(/\[ZONAS_AFECTADAS\]/g, `<span class="zonas-afectadas-field">${quote.zonasAfectadas || (selectedSystem === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas')}</span>`)
        .replace(/\[INTRO_TECNICA\]/g, `<span class="transcription-field">${textForIntro}</span>`)
        .replace(/\[PROBLEMA_PRINCIPAL\]/g, `<span class="problema-principal-field">${textForProblem}</span>`)
        .replace(/\[DETALLE_ADICIONAL\]/g, `<span class="detalle-adicional-field">${textForDetail}</span>`)
        .replace(/de\[ZONA_1\]/g, `de <span class="zona-1-field">${z1}</span>`)
        .replace(/de\[ZONA_2\]/g, `de <span class="zona-2-field">${z2}</span>`)
        .replace(/de\[ZONA_3\]/g, `de <span class="zona-3-field">${z3}</span>`)
        .replace(/\[ZONA_1\]/g, `<span class="zona-1-field">${z1}</span>`)
        .replace(/\[ZONA_2\]/g, `<span class="zona-2-field">${z2}</span>`)
        .replace(/\[ZONA_3\]/g, `<span class="zona-3-field">${z3}</span>`)
        .replace(/deCanalones/gi, 'de Canalones')
        .replace(/deHuecos/gi, 'de Huecos')
        .replace(/deZonas/gi, 'de Zonas')
        .replace(/\[PRECIO_LINEAS\]/g, getPriceLinesHtml(priceItems))
        .replace(/\[TECNICO\]/g, `<span class="tecnico-field">Técnico Oficial Alcebo</span>`)
        .replace(/\[TELEFONO\]/g, `<span class="telefono-field">900 123 456</span>`)
        .replace(/Se propone la protección mediante sistema de Red Network anti-palomas/gi, `Se propone la protección mediante <mark class="sistemas-nombres-field" style="background-color: #fef08a; padding: 1px 3px; border-radius: 2px;">Red Network anti-palomas</mark>`)
        .replace(/\[DESCRIPCION_PLAGA\]/g, `<div class="des-plaga-block">${getBirdsHtml(selectedBirds)}</div>`)
        .replace(/\[DESCRIPCIONES_SISTEMAS\]/g, `<div class="sistemas-block">${getSystemsHtml(selectedSystems)}</div>`)
        .replace(/<div class="cover-page-wrapper">[\s\S]*?<p><strong>CONTENIDO<\/strong><\/p>/i, `<div class="cover-page-wrapper" style="text-align: center; padding: 20px 0; font-family: 'Verdana', sans-serif;">
          <div style="border: 2px solid #000; padding: 25px; margin-bottom: 25px; display: inline-block; width: 100%; max-width: 520px; box-sizing: border-box; background: #fff;">
            <img src="${logoUrl}" alt="Alcebo Control de Aves" style="max-width: 320px; height: auto;" />
          </div>
          <div style="margin-bottom: 25px;">
            <div style="border: 2px solid #000; padding: 6px 30px; display: inline-block; background: #fff;">
              <h1 style="font-size: 20pt; font-weight: bold; margin: 0; text-decoration: underline; color: #000;">Informe Técnico</h1>
            </div>
          </div>
          <div style="border: 2px solid #000; padding: 15px 20px; text-align: left; position: relative; max-width: 520px; margin: 0 auto; box-sizing: border-box; min-height: 140px; background: #fff;">
            <div style="font-size: 11pt; font-weight: bold; margin-bottom: 10px; color: #000;">Presupuesto para</div>
            <div style="font-size: 9.5pt; line-height: 1.6; margin-left: 30px; color: #000;">
              <div>Com. Prop. <strong class="client-name-field">${escapeXml(clientNameInput.toUpperCase())}</strong></div>
              <div>C/ <span class="client-address-field">${escapeXml(clientAddressInput)}</span></div>
              <div><span class="postal-code-prefix-field">280</span><span class="postal-code-field">01</span> Madrid</div>
              <div style="margin-top: 6px;">Att: D. <span class="att-name-field">Presidente / Administrador de Fincas</span></div>
            </div>
            <div style="position: absolute; right: 10px; bottom: 10px; border: 1px solid #000; padding: 2px 8px; font-size: 8pt; background: #fff; color: #000;">
              Ref: <span class="ref-code-field">${escapeXml(finalRefCode)}</span>
            </div>
          </div>
        </div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>`)
        .replace(/<p><strong>presupuesto<\/strong><\/p>[\s\S]*?<p><strong>CONTENIDO<\/strong><\/p>/i, `<div class="cover-page-wrapper" style="text-align: center; padding: 20px 0; font-family: 'Verdana', sans-serif;">
          <div style="border: 2px solid #000; padding: 25px; margin-bottom: 25px; display: inline-block; width: 100%; max-width: 520px; box-sizing: border-box; background: #fff;">
            <img src="${logoUrl}" alt="Alcebo Control de Aves" style="max-width: 320px; height: auto;" />
          </div>
          <div style="margin-bottom: 25px;">
            <div style="border: 2px solid #000; padding: 6px 30px; display: inline-block; background: #fff;">
              <h1 style="font-size: 20pt; font-weight: bold; margin: 0; text-decoration: underline; color: #000;">Informe Técnico</h1>
            </div>
          </div>
          <div style="border: 2px solid #000; padding: 15px 20px; text-align: left; position: relative; max-width: 520px; margin: 0 auto; box-sizing: border-box; min-height: 140px; background: #fff;">
            <div style="font-size: 11pt; font-weight: bold; margin-bottom: 10px; color: #000;">Presupuesto para</div>
            <div style="font-size: 9.5pt; line-height: 1.6; margin-left: 30px; color: #000;">
              <div>Com. Prop. <strong class="client-name-field">${escapeXml(clientNameInput.toUpperCase())}</strong></div>
              <div>C/ <span class="client-address-field">${escapeXml(clientAddressInput)}</span></div>
              <div><span class="postal-code-prefix-field">280</span><span class="postal-code-field">01</span> Madrid</div>
              <div style="margin-top: 6px;">Att: D. <span class="att-name-field">Presidente / Administrador de Fincas</span></div>
            </div>
            <div style="position: absolute; right: 10px; bottom: 10px; border: 1px solid #000; padding: 2px 8px; font-size: 8pt; background: #fff; color: #000;">
              Ref: <span class="ref-code-field">${escapeXml(finalRefCode)}</span>
            </div>
          </div>
        </div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>`)
        .replace(/<p><strong>1\.-  CONTROL DE AVES URBANAS/gi, '<p><strong>1.-  CONTROL DE AVES URBANAS')
        .replace(/<p><strong>2\.- LEGISLACIÓN<\/strong><\/p>/gi, '<hr class="page-break" /><p><strong>2.- LEGISLACIÓN</strong></p>')
        .replace(/<p><strong>4\.- LA ELECCIÓN DEL SISTEMA/gi, '<hr class="page-break" /><p><strong>4.- LA ELECCIÓN DEL SISTEMA')
        .replace(/<p><strong>6\.- PRESUPUESTO Y GARANTÍAS/gi, '<p><strong>6.- PRESUPUESTO Y GARANTÍAS')
        .replace(/<p><strong>ANEXO\s*[–-]\s*Otras Gestiones/gi, '<hr class="page-break" /><p><strong>ANEXO – Otras Gestiones');

      setEditorHtml(wrapImagesInEditor(initialHtml));
    }
  }, [quote]);

  // Register global window functions for interactive image overlay toolbars
  useEffect(() => {
    (window as any).drawOnImage = (imgId: string) => {
      if (editorRef.current) {
        const img = editorRef.current.querySelector(`img[data-img-id="${imgId}"]`);
        if (img) {
          setEditingImageId(imgId);
          setEditingImageUrl(img.getAttribute('src') || '');
        }
      }
    };

    // Lag-free direct DOM resize
    (window as any).resizeImageDOM = (imgId: string, widthPx: string) => {
      if (editorRef.current) {
        const img = editorRef.current.querySelector(`img[data-img-id="${imgId}"]`) as HTMLImageElement;
        if (img) {
          img.style.width = widthPx + 'px';
        }
        // Sync range slider 'value' attribute inside the HTML text to persist selection
        const container = editorRef.current.querySelector(`img[data-img-id="${imgId}"]`)?.closest('.image-container-block');
        if (container) {
          const input = container.querySelector('input[type="range"]') as HTMLInputElement;
          if (input) {
            input.setAttribute('value', widthPx);
          }
        }
      }
    };

    // React state synchronization once dragging stops
    (window as any).resizeImageSync = (imgId: string, widthPx: string) => {
      if (editorRef.current) {
        const img = editorRef.current.querySelector(`img[data-img-id="${imgId}"]`) as HTMLImageElement;
        if (img) {
          img.style.width = widthPx + 'px';
          img.style.maxWidth = '100%';
          setEditorHtml(editorRef.current.innerHTML);
        }
      }
    };

    (window as any).deleteImage = (imgId: string) => {
      if (editorRef.current) {
        const container = editorRef.current.querySelector(`img[data-img-id="${imgId}"]`)?.closest('.image-container-block');
        if (container) {
          container.remove();
          setEditorHtml(editorRef.current.innerHTML);
          showToast('Foto eliminada del presupuesto.');
        }
      }
    };

    return () => {
      delete (window as any).drawOnImage;
      delete (window as any).resizeImageDOM;
      delete (window as any).resizeImageSync;
      delete (window as any).deleteImage;
    };
  }, []);

  // Track saved cursor range to preserve exact user cursor position when clicking image upload button
  const savedRangeRef = useRef<Range | null>(null);

  const saveCursorPosition = () => {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    } catch (e) {
      // Ignore range clone errors
    }
  };

  // Synchronize editorHtml with DOM initial load without destructive re-render cycles
  const isInitialLoadedRef = useRef(false);
  useEffect(() => {
    if (editorRef.current && editorHtml) {
      if (!isInitialLoadedRef.current || editorRef.current.children.length === 0) {
        editorRef.current.innerHTML = editorHtml;
        isInitialLoadedRef.current = true;
        
        const desPlagaEl = editorRef.current.querySelector('.des-plaga-block');
        if (desPlagaEl && (!desPlagaEl.innerHTML || desPlagaEl.innerHTML.trim() === '')) {
          desPlagaEl.innerHTML = getBirdsHtml(selectedBirds);
        }
        
        const sistemasEl = editorRef.current.querySelector('.sistemas-block');
        if (sistemasEl && (!sistemasEl.innerHTML || sistemasEl.innerHTML.trim() === '')) {
          sistemasEl.innerHTML = wrapImagesInEditor(getSystemsHtml(selectedSystems));
        }
      }
    }
  }, [editorHtml]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Rich Text Formatting helpers
  const handleFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  // Create high-fidelity interactive image block
  const createImageBlock = (base64Url: string, filename: string, imgId: string) => {
    const div = document.createElement('div');
    div.className = 'image-container-block no-print-border';
    div.style.textAlign = 'center';
    div.style.margin = '20px auto';
    div.style.padding = '12px';
    div.style.border = '2px dashed #009FE3/30';
    div.style.borderRadius = '12px';
    div.style.position = 'relative';
    div.style.display = 'block';
    div.style.maxWidth = '580px';
    div.setAttribute('contenteditable', 'false');
    
    div.innerHTML = `
      <div class="image-toolbar no-print" style="display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:10px; background:rgba(15,23,42,0.95); padding:8px 16px; border-radius:10px; width:max-content; margin-left:auto; margin-right:auto; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); color:white; font-family:sans-serif; font-size:11px;">
        <button type="button" onclick="window.drawOnImage('${imgId}')" style="background:#009FE3; color:white; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-family:sans-serif; transition:all 0.2s;">
          🎨 Dibujar
        </button>
        
        <div style="display:flex; align-items:center; gap:6px; border-left:1px solid rgba(255,255,255,0.2); border-right:1px solid rgba(255,255,255,0.2); padding:0 10px;">
          <span style="font-weight:bold;">Tamaño:</span>
          <input type="range" min="150" max="650" step="5" value="280" oninput="window.resizeImageDOM('${imgId}', this.value)" onchange="window.resizeImageSync('${imgId}', this.value)" style="width:80px; accent-color:#009FE3; cursor:pointer; height:4px; border-radius:2px;" />
        </div>
        
        <button type="button" onclick="window.deleteImage('${imgId}')" style="background:#EF4444; color:white; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-family:sans-serif; transition:all 0.2s;">
          🗑️ Eliminar
        </button>
      </div>
      <img src="${base64Url}" class="document-image" data-img-id="${imgId}" style="width:280px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
      <div class="no-print" style="font-size:11px; color:#64748B; font-style:italic; margin-top:8px; text-align:center; font-family:sans-serif; padding:2px 0;">
        Pulsa "Dibujar" para hacer anotaciones.
      </div>
    `;
    return div;
  };

  // Insert image at current cursor selection or saved cursor position
  const insertImageAtCursor = (base64Url: string, filename: string) => {
    const imgId = 'img_' + Date.now() + Math.floor(Math.random() * 1000);
    let inserted = false;
    
    // First, try saved range if user clicked somewhere in editor before clicking file upload button
    let rangeToUse: Range | null = null;
    const sel = window.getSelection();
    
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      rangeToUse = sel.getRangeAt(0);
    } else if (savedRangeRef.current && editorRef.current?.contains(savedRangeRef.current.startContainer)) {
      rangeToUse = savedRangeRef.current;
    }

    // Do NOT insert in cover page wrapper!
    if (rangeToUse) {
      let node: Node | null = rangeToUse.startContainer;
      while (node && node !== editorRef.current) {
        if (node instanceof HTMLElement && node.classList.contains('cover-page-wrapper')) {
          rangeToUse = null; // Don't insert inside cover page wrapper
          break;
        }
        node = node.parentNode;
      }
    }

    if (rangeToUse) {
      try {
        const div = createImageBlock(base64Url, filename, imgId);
        rangeToUse.deleteContents();
        rangeToUse.insertNode(div);
        
        try {
          rangeToUse.setStartAfter(div);
          rangeToUse.setEndAfter(div);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(rangeToUse);
          }
        } catch (selErr) {
          // Cursor placement after block
        }
        
        inserted = true;
      } catch (domErr) {
        console.warn('Failed range insertion:', domErr);
      }
    }

    // Fallback: Append inside Section 4 / Section 3 / Body, NEVER inside cover page wrapper
    if (!inserted && editorRef.current) {
      try {
        const div = createImageBlock(base64Url, filename, imgId);
        const sectionHeading = Array.from(editorRef.current.querySelectorAll('p, h1, h2, h3, div')).find(el => {
          const txt = (el.textContent || '').toUpperCase();
          return txt.includes('4.- LA ELECCIÓN DEL SISTEMA') ||
                 txt.includes('3.- DAÑOS Y FOTOS') ||
                 txt.includes('DAÑOS Y DEFICIENCIAS') ||
                 txt.includes('1.-  CONTROL DE AVES');
        });

        if (sectionHeading && sectionHeading.parentNode) {
          sectionHeading.parentNode.insertBefore(div, sectionHeading.nextSibling);
          showToast('¡Foto añadida en la sección técnica del documento!');
          inserted = true;
        } else {
          editorRef.current.appendChild(div);
          showToast('¡Foto añadida al documento!');
          inserted = true;
        }
      } catch (appendErr) {
        console.error('Fatal: image block append failed:', appendErr);
      }
    } else if (inserted) {
      showToast('¡Foto técnica insertada en la posición del cursor!');
    }

    if (inserted && editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  const resizeImageBase64 = (base64Url: string, maxWidth = 1000, maxHeight = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Url;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with 0.75 quality (highly optimized file size)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressedBase64);
        } else {
          resolve(base64Url);
        }
      };
      img.onerror = () => {
        resolve(base64Url);
      };
    });
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          // Resize/compress the image to prevent LocalStorage Quota Exceeded error
          const resizedBase64 = await resizeImageBase64(reader.result as string);
          insertImageAtCursor(resizedBase64, file.name);
          if (imageUploadRef.current) imageUploadRef.current.value = '';
        } catch (loadErr) {
          console.error('Error inside FileReader onload callback:', loadErr);
        }
      };
    } catch (selectErr) {
      console.error('Error inside handleImageFileSelect event handler:', selectErr);
    }
  };

  const handleSaveAnnotatedImage = (annotatedDataUrl: string) => {
    if (editorRef.current && editingImageId) {
      const img = editorRef.current.querySelector(`img[data-img-id="${editingImageId}"]`);
      if (img) {
        img.setAttribute('src', annotatedDataUrl);
        setEditorHtml(editorRef.current.innerHTML);
        showToast('¡Trazos acoplados e integrados con éxito!');
      }
    }
    setEditingImageId(null);
  };

  // Sync edits on content change
  const handleEditorInput = () => {
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
      setSaveStatus('dirty');
    }
  };

  // Sincronizar de forma automática con la app de correo (local o vercel)
  const enviarAlSeguimiento = async (q: Quote) => {
    if (!clientEmailInput) {
      setSyncStatus({ type: 'error', message: 'No enviado: Falta el correo del cliente' });
      return;
    }
    
    setSyncStatus({ type: 'loading', message: 'Conectando con gestor de correos...' });
    
    // Auto-detectar servidor local o en la nube de Vercel (con tu subdominio activo)
    const trackerUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001/api/presupuestos'
      : 'https://alcebo-seguimiento-correos.vercel.app/api/presupuestos';

    try {
      const response = await fetch(trackerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: q.id,
          cliente: q.clientName,
          email: clientEmailInput,
          email_cliente: clientEmailInput,
          fecha: q.date || new Date().toISOString().split('T')[0],
          documento: q.title || 'Presupuesto Técnico',
          enlace_documento: `https://alcebo-seguimiento-correos.vercel.app/presupuestos/${q.id}`,
          monto: q.totalCost || 0
        })
      });
      if (response.ok) {
        setSyncStatus({ type: 'success', message: 'Sincronizado con éxito' });
        console.log('✅ Presupuesto enviado correctamente al gestor de correos.');
      } else {
        const text = await response.text();
        setSyncStatus({ type: 'error', message: `Error del servidor: ${text.substring(0, 30)}` });
        console.error('⚠️ Error al enviar:', text);
      }
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: `Error de red: ${err.message}` });
      console.error('Error al enviar presupuesto al gestor de correos:', err.message);
    }
  };

  // Save current quote details to database
  const handleSaveAndSync = (isAutoSave: boolean = false) => {
    if (!editorRef.current) return;
    
    const htmlContent = editorRef.current.innerHTML;
    
    // Extract metadata values dynamically from HTML content if edited on screen
    let cleanText = editorRef.current.innerText || '';
    let extractedClient = quote.clientName;
    const clientMatch = htmlContent.match(/Com\.\s*Prop\.\s*<strong>(.*?)<\/strong>/i);
    if (clientMatch && clientMatch[1]) {
      extractedClient = clientMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    
    const updated: Quote = {
      ...quote,
      date: quoteDate,
      clientName: clientNameInput || extractedClient || 'Comunidad Editada',
      clientAddress: clientAddressInput,
      clientEmail: clientEmailInput,
      birds: selectedBirds,
      systems: selectedSystems,
      estimationLineal: meters,
      totalCost: priceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
      priceItems: priceItems,
      documentHtml: htmlContent,
      text: customText,
      templateId: selectedTemplateId
    };

    onSaveQuote(updated);
    if (!isAutoSave) {
      showToast('¡Presupuesto y plantilla guardados en el historial!');
      enviarAlSeguimiento(updated);
    }
  };

  // Auto-fill from video/audio transcription
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingVideo(true);
    setVideoProgress(10);

    try {
      showToast('⚡ Reduciendo y comprimiendo archivo de vídeo/audio en tu navegador...');
      const { blob: compressedBlob, originalSizeMB, compressedSizeMB, ratio } = await extractAudioFromMediaFile(
        file,
        (percent) => setVideoProgress(percent)
      );

      if (Number(ratio) > 0) {
        showToast(`✅ Vídeo reducido de ${originalSizeMB} MB a ${compressedSizeMB} MB (-${ratio}%)`);
      }

      setVideoProgress(65);

      const userKey = config?.groqApiKey?.trim();
      const userLlmKey = config?.llmApiKey?.trim();

      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onload = async () => {
        const base64Uri = reader.result as string;
        
        try {
          let data: { text: string; aiParsed?: any } = { text: '' };

          const callProxyServer = async (uri: string, filename: string, key?: string, llmKey?: string) => {
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                file: uri,
                name: filename,
                apiKey: key,
                llmApiKey: llmKey,
              }),
            });

            const rawText = await response.text().catch(() => '');
            if (!response.ok) {
              let errMsg = 'Error al transcribir el archivo.';
              if (response.status === 413 || rawText.includes('Too Large') || rawText.includes('Request Entity')) {
                throw new Error('El archivo es demasiado grande para el servidor de Vercel (límite de 4.5MB en Base64).\n\nPara solucionar esto:\n1. Introduce una clave de API de Groq en "Ajustes" para subir archivos de hasta 25MB directamente desde tu navegador.\n2. O bien sube un archivo de AUDIO (.mp3, .m4a) que son mucho más ligeros y no fallan.');
              }
              try {
                const errData = JSON.parse(rawText);
                errMsg = errData.error || errData.details || errMsg;
              } catch (jsonErr) {
                errMsg = rawText || errMsg;
              }
              throw new Error(errMsg);
            }

            try {
              return JSON.parse(rawText);
            } catch (e) {
              throw new Error('La respuesta del servidor no tiene un formato JSON válido.');
            }
          };

          if (userKey && userKey.startsWith('gsk_')) {
            console.log('Utilizando transcripción directa desde el navegador (Groq)...');
            try {
              const fileBlob = await (await fetch(base64Uri)).blob();
              const formData = new FormData();
              formData.append('file', fileBlob, file.name);
              formData.append('model', 'whisper-large-v3');
              formData.append('language', 'es');

              const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${userKey}`
                },
                body: formData
              });

              if (!whisperRes.ok) {
                const textErr = await whisperRes.text();
                throw new Error(`Groq Whisper falló: ${textErr}`);
              }

              const whisperData = await whisperRes.json();
              const transcriptionText = whisperData.text;
              
              setVideoProgress(65);
              
              const prompt = `Analiza la siguiente transcripción de una visita técnica para control de aves y extrae la información en un objeto JSON con el siguiente formato estricto. No incluyas explicaciones ni formato markdown (como backticks o la palabra json), devuelve únicamente un objeto JSON válido.

JSON keys:
- "detectedBird": Debe ser uno de los siguientes valores exactos en español: "Palomas", "Gorriones", "Cigüeñas", "Gaviotas", "Cotorras", "Golondrinas", "Avión Común".
- "detectedSystems": Array de strings que contengan los sistemas de control propuestos. Valores válidos: "Red", "Varillas", "Eléctrico", "Capturas".
- "clientName": Nombre formal de la comunidad de propietarios en MAYÚSCULAS, ej. "COMUNIDAD DE PROPIETARIOS PRINCESA 28".
- "clientAddress": Dirección de la obra limpia, ej. "Calle de la Princesa 28, Madrid".
- "postalCode": Código postal de 5 dígitos si se menciona, ej. "28008".
- "meters": Metros lineales o cantidad numérica estimada que se mencione (número entero).
- "introTecnica": Resumen técnico profesional descriptivo y amplio (de 2 a 4 líneas de longitud), redactado en tercera persona del plural ("pudimos comprobar cómo..."). IMPORTANTE: Debes REESCRIBIR y RESUMIR en detalle la descripción coloquial del técnico. Explica las zonas observadas (como tejados, aleros, canalones o antenas) y los rastros de las aves. Elimina muletillas, repeticiones, fechas de la visita y direcciones. El texto resultante debe ser formal, técnico, detallado y fluido al concatenarse con "Durante la visita realizada pudimos comprobar cómo...". Ejemplo: "las aves se posan de manera recurrentemente en todo el borde del tejado de pizarra y en la antena del edificio contiguo, acumulando gran cantidad de excrementos en los bordes y terrazas inferiores, lo que degrada la salubridad y la estética de la fachada".
- "problemaPrincipal": Resumen profesional detallado y completo (de 2 a 3 líneas de longitud), redactado en tercera persona del singular. IMPORTANTE: Debes REESCRIBIR de forma técnica el problema central. Explica la causa raíz (ej. que bajan a beber agua a la piscina o que anidan en huecos) y las consecuencias. El texto resultante debe fluir perfectamente al concatenarse con "El problema principal...". Ejemplo: "radica en que las aves descienden constantemente a la zona de la piscina para beber agua, lo que provoca la acumulación de excrementos ácidos en las terrazas verticales de los propietarios, requiriendo tareas de barrido y limpieza diarias".
- "detalleAdicional": Resumen profesional amplio e informativo (de 2 a 3 líneas de longitud), detallando los accesos y las soluciones específicas propuestas en la inspección (como protección con red, instalación de varillas en focos rectangulares, o ausencia de nidos en huecos cerrados). Ejemplo: "se propone la instalación de varillas de acero inoxidable en los dos focos rectangulares de la terraza donde se posan las aves, junto con la instalación de una red antipalomas perimetral que proteja la zona de la piscina para evitar el acceso al agua".
- "price1": Precio de la primera opción de presupuesto formateado (ej. "450 €").
- "price2": Precio de la segunda opción o lote completo de presupuesto formateado (ej. "1.090 €").
- "price3": Precio total sugerido o de la opción elegida formateado (ej. "1.090 €").
- "refCode": Código de referencia del presupuesto si se menciona (ej. "Ref-ALC-L-2026-0-589").
- "date": Fecha en la que se realizó la visita/inspección, en formato "YYYY-MM-DD", SOLO si se menciona explícitamente como la fecha de la visita (frases como "hoy es...", "estamos a...", "la visita fue el..."). IMPORTANTE: ignora por completo cualquier número que forme parte del NOMBRE DE UNA CALLE O DIRECCIÓN (ej. "Calle 18 de Octubre" es el nombre de una calle, NO una fecha — no la confundas con la fecha de la visita). Si no se menciona una fecha real de la visita, deja este campo vacío o null.
- "zonasAfectadas": Frase corta (5-12 palabras) que describa las zonas concretas del inmueble donde se observaron las aves, tal y como se mencionan en la transcripción (ej. "el tejado de pizarra y la antena", "las repisas de las ventanas y el alero trasero"). Si no se menciona ninguna zona concreta, usa "varias zonas del edificio".

Transcripción:
"${transcriptionText}"`;

              const finalLlmKey = userLlmKey || userKey;
              const isLlmGroq = finalLlmKey.startsWith('gsk_');
              const llmUrl = isLlmGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
              const llmModel = isLlmGroq ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-3.3-70b-instruct';

              const llmRes = await fetch(llmUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${finalLlmKey}`,
                  'Content-Type': 'application/json',
                  ...(isLlmGroq ? {} : {
                    'HTTP-Referer': 'https://alcebo-technical-quotes.vercel.app',
                    'X-Title': 'Alcebo Quotes'
                  })
                },
                body: JSON.stringify({
                  model: llmModel,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.1,
                  response_format: { type: 'json_object' }
                })
              });

              let aiParsed = null;
              if (llmRes.ok) {
                const llmData = await llmRes.json();
                const rawJsonText = llmData.choices[0].message.content.trim();
                aiParsed = JSON.parse(rawJsonText);
              }

              data = { text: transcriptionText, aiParsed };
            } catch (directErr: any) {
              console.warn('Llamada directa a Groq falló o no está disponible. Reintentando por servidor proxy...', directErr);
              data = await callProxyServer(base64Uri, file.name, userKey, userLlmKey);
            }
          } else {
            data = await callProxyServer(base64Uri, file.name, userKey, userLlmKey);
          }

          setVideoProgress(100);
          
          // Auto-fill extraction logic
          const textLower = data.text.toLowerCase();
          const ai = data.aiParsed;

          // 1. Bird detection
          let detectedBird = 'Palomas';
          if (ai && ai.detectedBird) {
            detectedBird = ai.detectedBird;
          } else {
            if (textLower.includes('paloma')) detectedBird = 'Palomas';
            else if (textLower.includes('golondrina')) detectedBird = 'Golondrinas';
            else if (textLower.includes('avión') || textLower.includes('avion')) detectedBird = 'Avión Común';
            else if (textLower.includes('gaviota')) detectedBird = 'Gaviotas';
            else if (textLower.includes('gorrion') || textLower.includes('gorrión')) detectedBird = 'Gorriones';
          }
          
          // 2. Systems detection (multiple)
          let detectedSystemsList: string[] = [];
          if (ai && ai.detectedSystems && ai.detectedSystems.length > 0) {
            detectedSystemsList = ai.detectedSystems;
          } else {
            if (textLower.includes('red') || textLower.includes('malla')) detectedSystemsList.push('Red');
            if (textLower.includes('varilla') || textLower.includes('pincho') || textLower.includes('púa') || textLower.includes('varillas')) {
              detectedSystemsList.push('Varillas');
            }
            if (textLower.includes('eléctrico') || textLower.includes('electrostático') || textLower.includes('electrico')) {
              detectedSystemsList.push('Eléctrico');
            }
            if (textLower.includes('captura') || textLower.includes('trampa') || textLower.includes('capturas')) {
              detectedSystemsList.push('Capturas');
            }
            if (detectedSystemsList.length === 0) {
              detectedSystemsList.push('Red');
            }
          }

          // 3. Lineal meters extraction
          let detectedMeters = 15;
          if (ai && typeof ai.meters === 'number') {
            detectedMeters = ai.meters;
            setMeters(detectedMeters);
          } else {
            const matchMeters = textLower.match(/(\d+)\s*(metros|metro|m\b)/);
            if (matchMeters && matchMeters[1]) {
              detectedMeters = parseInt(matchMeters[1], 10);
              setMeters(detectedMeters);
            }
          }

          // 4. Client Name extraction
          let detectedClient = 'COMUNIDAD DE PROPIETARIOS';
          if (ai && ai.clientName) {
            detectedClient = ai.clientName.toUpperCase();
          } else {
            const matchClient = textLower.match(/(comunidad\s+(?:de\s+)?(?:propietarios\s+)?(?:de\s+)?[\w\sñáéíóúÁÉÍÓÚ]+?(?=\s+en\b|\s+calle\b|\s+nº\b|\s+\d+|\.|$))/i);
            if (matchClient && matchClient[0]) {
              detectedClient = matchClient[0].toUpperCase().trim();
            }
          }

          // 5. Address extraction
          let detectedAddress = 'Calle Principal s/n';
          if (ai && ai.clientAddress) {
            detectedAddress = ai.clientAddress;
          } else {
            const matchAddress = textLower.match(/(?:calle|c\/|avda|avenida|plaza|c\/)\s+[\w\sñáéíóúÁÉÍÓÚ\d,]+/i);
            if (matchAddress && matchAddress[0]) {
              detectedAddress = matchAddress[0].trim();
            }
          }

          // 6. Date extraction
          let detectedDate = new Date().toISOString().split('T')[0];
          if (ai && ai.date) {
            const parsedD = new Date(ai.date);
            if (!isNaN(parsedD.getTime())) {
              detectedDate = ai.date;
            }
          } else {
            // Negative lookbehind avoids matching a street name that happens to contain a date-like
            // number (e.g. "Calle 18 de Octubre 11" is an address, not the visit date).
            const dateRegex = /\b(?<!calle\s)(?<!c\/\s?)(\d{1,2})[\s/de]+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{1,2})[\s/de]+(\d{2,4})\b/i;
            const matchDate = data.text.match(dateRegex);
            if (matchDate) {
              const day = matchDate[1];
              const monthTextOrNum = matchDate[2].toLowerCase();
              let year = matchDate[3];
              if (year.length === 2) year = '20' + year;
              
              const monthMap: Record<string, string> = {
                'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
                'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
              };
              
              const month = monthMap[monthTextOrNum] || monthTextOrNum.padStart(2, '0');
              const formattedDate = `${year}-${month}-${day.padStart(2, '0')}`;
              const parsedD = new Date(formattedDate);
              if (!isNaN(parsedD.getTime())) {
                detectedDate = formattedDate;
              }
            }
          }
          setQuoteDate(detectedDate);
 
          setSelectedBirds([detectedBird]);
          setSelectedSystems(detectedSystemsList);
 
          // Re-initialize from template to ensure clean replacements
          const today = new Date(detectedDate);
          const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          
          const dayStr = today.getDate().toString().padStart(2, '0');
          const monthStr = monthNames[today.getMonth()];
          const yearStr = today.getFullYear().toString().substring(2);
          
          const primarySys = detectedSystemsList[0] || 'Red';
          const z1 = primarySys === 'Red' ? 'Canalones y alféizares principales' : 'Cornisas principales de posado';
          const z2 = primarySys === 'Red' ? 'Huecos de ventilación del ático' : 'Zonas comunes y repisas de ventanas';
          const z3 = primarySys === 'Varillas' ? 'Cornisa superior trasera' : 'Zonas estructurales secundarias';
          
          const pcp = (ai && ai.postalCode) || detectedAddress.match(/\b\d{5}\b/)?.[0] || '28001';
          const pcpPrefix = pcp.substring(0, 3) + '00';
          
          // Update input states (preserving manual prices and meters)
          setClientNameInput(detectedClient);
          setClientAddressInput(detectedAddress);

          let priceItemsForBuild = priceItems;
          if (ai && (ai.price1 || ai.price2 || ai.price3)) {
            priceItemsForBuild = [
              { label: 'Protección canalones del tejado (Red Paloma)', amount: ai.price1 || priceItems[0]?.amount || '300.00' },
              { label: 'Protección de huecos de ventilación.', amount: ai.price2 || priceItems[1]?.amount || '150.00' },
              { label: 'Protección de las 2 cornisas superiores (Red y Varilla)', amount: ai.price3 || priceItems[2]?.amount || '450.00' },
            ];
            setPriceItems(priceItemsForBuild);
          }

          const systemBlockRegex = /<ul><li><strong>RED NETWORK ANTI-PALOMAS[\s\S]*?Fijación con adhesivo sellador de poliuretano de exteriores\.<\/li><\/ul>/i;
          const plagaParagraphRegex = /<p>Las estimaciones indican que una ciudad media mediterránea posee una población de más de 1500 palomas por kilómetro cuadrado[\s\S]*?aprovechar los desechos animales\.\s*<\/p>/gi;
          const templateWithPlaceholders = WORD_TEMPLATE_HTML
            .replace(systemBlockRegex, '<div class="sistemas-block">[DESCRIPCIONES_SISTEMAS]</div>')
            .replace(plagaParagraphRegex, '<div class="des-plaga-block">[DESCRIPCION_PLAGA]</div>')
            .replace(FIXED_PRICE_LINES_REGEX, '<div class="precio-lineas-block">[PRECIO_LINEAS]</div>')
            .replace(SIGNATURE_STAMP_IMG_REGEX, (m) => `<p style="text-align: right;">${m}</p>`)
            .replace(/<ol><li><strong>Diagnóstico<\/strong><\/li><\/ol>/, '<p><strong>5.1 Diagnóstico</strong></p>')
            .replace(/<ol(?:\s+start="2")?><li><strong>Propuesta Técnica<\/strong><\/li><\/ol>/, '<p><strong>5.2 Propuesta Técnica</strong></p>')
            .replace(
              /(<p>- Además,[\s\S]*?<\/ul>)\s*(<p><strong>5\.2 Propuesta Técnica<\/strong><\/p>)/,
              '$2$1'
            );

          const finalRefCode = (ai && ai.refCode) || (quote.id.startsWith('q-new') ? 'Ref-ALC-[RELLENAR]' : quote.id);

          const textForIntro = cleanIntroText((ai && ai.introTecnica) || data.text);
          const textForProblem = cleanProblemText((ai && ai.problemaPrincipal) || "es la acumulación de excrementos y el consiguiente deterioro estético e higiénico.");
          const textForDetail = (ai && ai.detalleAdicional) || "se observaron nidos construidos y obstrucciones en los conductos.";

          let freshHtml = templateWithPlaceholders
            .replace(/\[REF_CODE\]/g, `<span class="ref-code-field">${finalRefCode}</span>`)
            .replace(/\[CLIENT_NAME\]/g, `<span class="client-name-field">${detectedClient.toUpperCase()}</span>`)
            .replace(/\[CLIENT_ADDRESS\]/g, `<span class="client-address-field">${detectedAddress}</span>`)
            .replace(/\[POSTAL_CODE\]/g, `<span class="postal-code-field">${pcp}</span>`)
            .replace(/\[POSTAL_CODE_PREFIX\]/g, `<span class="postal-code-prefix-field">${pcpPrefix}</span>`)
            .replace(/\[ATT_NAME\]/g, `<span class="att-name-field">Presidente / Administrador de Fincas</span>`)
            .replace(/\[DAY\]/g, `<span class="day-field">${dayStr}</span>`)
            .replace(/\[MONTH\]/g, `<span class="month-field">${monthStr}</span>`)
            .replace(/\[YEAR\]/g, `<span class="year-field">${yearStr}</span>`)
            .replace(/\[PLAGA\]palomas/gi, `<span class="plaga-field">${detectedBird}</span>`)
            .replace(/\[PLAGA\]/g, `<span class="plaga-field">${detectedBird}</span>`)
            .replace(/\[ZONAS_AFECTADAS\]/g, `<span class="zonas-afectadas-field">${(ai && ai.zonasAfectadas) || (primarySys === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas')}</span>`)
            .replace(/\[INTRO_TECNICA\]/g, `<span class="transcription-field">${textForIntro}</span>`)
            .replace(/\[PROBLEMA_PRINCIPAL\]/g, `<span class="problema-principal-field">${textForProblem}</span>`)
            .replace(/\[DETALLE_ADICIONAL\]/g, `<span class="detalle-adicional-field">${textForDetail}</span>`)
            .replace(/\[ZONA_1\]/g, `<span class="zona-1-field">${z1}</span>`)
            .replace(/\[ZONA_2\]/g, `<span class="zona-2-field">${z2}</span>`)
            .replace(/\[ZONA_3\]/g, `<span class="zona-3-field">${z3}</span>`)
            .replace(/\[PRECIO_LINEAS\]/g, getPriceLinesHtml(priceItemsForBuild))
            .replace(/\[TECNICO\]/g, `<span class="tecnico-field">Técnico Oficial Alcebo</span>`)
            .replace(/\[TELEFONO\]/g, `<span class="telefono-field">900 123 456</span>`)
            .replace(/\[DESCRIPCION_PLAGA\]/g, getBirdsHtml([detectedBird]))
            .replace(/\[DESCRIPCIONES_SISTEMAS\]/g, wrapImagesInEditor(getSystemsHtml(detectedSystemsList)))
            .replace(/<p><strong>presupuesto<\/strong><\/p>/i, '<div class="cover-page-wrapper" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0;"><p style="text-align: center; font-size: 24pt; font-weight: bold; color: #009FE3; margin-top: 15px; margin-bottom: 15px; letter-spacing: 2px;"><strong>PRESUPUESTO</strong></p>')
            .replace(/<p><strong>presupuesto<\/strong><\/p>/gi, '')
            .replace(/<p><strong>CONTENIDO<\/strong><\/p>/gi, '</div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>')
            .replace(/<p><strong>1\.-  CONTROL DE AVES URBANAS/gi, '<p><strong>1.-  CONTROL DE AVES URBANAS')
            .replace(/<p><strong>2\.- LEGISLACIÓN<\/strong><\/p>/gi, '<hr class="page-break" /><p><strong>2.- LEGISLACIÓN</strong></p>')
            .replace(/<p><strong>4\.- LA ELECCIÓN DEL SISTEMA/gi, '<hr class="page-break" /><p><strong>4.- LA ELECCIÓN DEL SISTEMA')
            .replace(/<p><strong>6\.- PRESUPUESTO Y GARANTÍAS/gi, '<p><strong>6.- PRESUPUESTO Y GARANTÍAS')
            .replace(/<p><strong>ANEXO\s*[–-]\s*Otras Gestiones/gi, '<hr class="page-break" /><p><strong>ANEXO – Otras Gestiones');
 
           const finalHtml = wrapImagesInEditor(freshHtml);
           if (editorRef.current) {
             editorRef.current.innerHTML = finalHtml;
           }
           setEditorHtml(finalHtml);
           setCustomText(data.text);
 
           setTimeout(() => {
             setIsProcessingVideo(false);
             showToast('¡Presupuesto rellenado con éxito desde el audio!');
           }, 300);
 
         } catch (err: any) {
           console.error('Video auto-fill failed:', err);
           setVideoProgress(100);
           setTimeout(() => {
             setIsProcessingVideo(false);
             alert(`Error al procesar el vídeo:\n${err.message}`);
           }, 200);
         }
      };
    } catch (error: any) {
      console.error('File reading failed:', error);
      alert(`Error al procesar el archivo:\n${error.message}`);
      setIsProcessingVideo(false);
    }
  };

  const cleanBase64 = (str: string): string => {
    if (!str) return '';
    let cleaned = str.replace(/\s/g, '').replace(/ /g, '+');
    if (cleaned.includes('%')) {
      try {
        cleaned = decodeURIComponent(cleaned);
      } catch (e) {}
    }
    return cleaned.replace(/\s/g, '').replace(/ /g, '+');
  };

  // Export high-fidelity MHTML Word document (.doc) directly on the client-side
  const handleExportMhtml = async () => {
    if (!editorRef.current) return;

    const htmlContent = editorRef.current.innerHTML;
    let extractedClient = quote.clientName;
    const clientMatch = htmlContent.match(/Com\.\s*Prop\.\s*<strong>(.*?)<\/strong>/i);
    if (clientMatch && clientMatch[1]) {
      extractedClient = clientMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const currentQuote: Quote = {
      ...quote,
      clientName: extractedClient || 'Comunidad Editada',
      clientAddress: clientAddressInput,
      clientEmail: clientEmailInput,
      estimationLineal: meters,
      totalCost: priceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    };
    
    enviarAlSeguimiento(currentQuote);

    // Clean up temporary UI elements in cloned HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const noPrintElements = tempDiv.querySelectorAll('.no-print, .image-toolbar');
    noPrintElements.forEach(el => el.remove());
    
    const editableElements = tempDiv.querySelectorAll('[contenteditable]');
    editableElements.forEach(el => el.removeAttribute('contenteditable'));

    const containers = tempDiv.querySelectorAll('.image-container-block');
    containers.forEach(container => {
      container.removeAttribute('style');
      container.setAttribute('style', 'text-align: center; margin: 20px auto; display: block; max-width: 580px;');
    });

    // Helper to convert any image element to a base64 data URI
    const ensureBase64DataUri = async (imgEl: HTMLImageElement): Promise<string> => {
      const src = imgEl.getAttribute('src') || '';
      if (src.startsWith('data:image/')) return src;
      
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth || 600;
        canvas.height = imgEl.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgEl, 0, 0);
          const uri = canvas.toDataURL('image/png');
          if (uri.startsWith('data:image/')) return uri;
        }
      } catch (e) {
        console.warn('Canvas toDataURL failed:', e);
      }

      if (src) {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string || src);
            reader.onerror = () => resolve(src);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('Fetch image blob failed:', e);
        }
      }
      return src;
    };

    const imagesInDoc = tempDiv.querySelectorAll('img');
    for (let i = 0; i < imagesInDoc.length; i++) {
      const img = imagesInDoc[i] as HTMLImageElement;
      const base64Uri = await ensureBase64DataUri(img);
      if (base64Uri.startsWith('data:image/')) {
        img.setAttribute('src', base64Uri);
      }

      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const imgId = img.getAttribute('data-img-id') || '';
      const isLogo = src.includes('logo') || alt.toLowerCase().includes('logo') || imgId.includes('logo') || !!img.closest('.cover-page-wrapper');

      let pxWidth = isLogo ? 620 : 280;
      let aspectRatio = 0.75;

      let naturalWidth = img.naturalWidth;
      let naturalHeight = img.naturalHeight;

      if (!naturalWidth || !naturalHeight) {
        const originalImg = editorRef.current?.querySelector(`img[src="${src}"], img[alt="${alt}"], img[data-img-id="${imgId}"]`) as HTMLImageElement;
        if (originalImg) {
          naturalWidth = originalImg.naturalWidth;
          naturalHeight = originalImg.naturalHeight;
        }
      }

      if (naturalWidth && naturalHeight && naturalWidth > 0) {
        aspectRatio = naturalHeight / naturalWidth;
      }

      if (!isLogo) {
        const originalImg = editorRef.current?.querySelector(`img[data-img-id="${imgId}"]`);
        const container = originalImg?.closest('.image-container-block');
        const slider = container?.querySelector('input[type="range"]') as HTMLInputElement;

        if (slider && slider.value) {
          const parsed = parseInt(slider.value);
          if (!isNaN(parsed) && parsed > 0) pxWidth = parsed;
        } else {
          const styleWidth = img.style.width || img.getAttribute('width');
          if (styleWidth) {
            const parsed = parseInt(styleWidth);
            if (!isNaN(parsed) && parsed > 0) pxWidth = parsed;
          }
        }

        if (isNaN(pxWidth) || pxWidth <= 0 || pxWidth > 350) pxWidth = 280;
      }

      const pxHeight = Math.round(pxWidth * aspectRatio);

      img.setAttribute('width', pxWidth.toString());
      img.setAttribute('height', pxHeight.toString());
      img.style.width = pxWidth + 'px';
      img.style.height = pxHeight + 'px';
      if (isLogo) {
        img.style.border = 'none';
      }
    }

    // Process images and page breaks for high-fidelity MHTML Word document
    const boundary = '----=_NextPart_000_0000_01D1';
    const mimeParts: string[] = [];
    let imageCounter = 0;

    let processedHtmlContent = tempDiv.innerHTML;

    // Convert page breaks to Word MSO break syntax and remove placeholder text, image captions, and yellow highlights
    processedHtmlContent = processedHtmlContent
      .replace(/<p[^>]*>\s*(?:<em>)?\s*Foto\s*Muestra\s*(?:<\/em>)?\s*<\/p>/gi, '')
      .replace(/<div[^>]*>\s*Fig:[^<]*<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*cover-page-wrapper[^"]*"[^>]*>/gi, '<div class="Section1" style="text-align: center; display: block; margin-top: 10px; margin-bottom: 20px; position: relative;">')
      .replace(/style="[^"]*background-color:\s*[^;"]+;?[^"]*"/gi, '')
      .replace(/background-color:\s*[^;"]+;?/gi, '')
      .replace(/<mark[^>]*>/gi, '<span>')
      .replace(/<\/mark>/gi, '</span>')
      .replace(/<\/div>\s*<hr class="page-break" \/>/gi, '</div><div class="Section2"><br style="page-break-before:always; mso-break-type:section-break" />')
      .replace(/<hr[^>]*class="[^"]*page-break[^"]*"[^>]*\/?>/gi, '<br style="page-break-before:always; mso-break-type:section-break" />') + '</div>';

    // Replace all inline data URIs with MHTML Content-Location references and build MIME parts
    processedHtmlContent = processedHtmlContent.replace(/<img([^>]+)src="(data:image\/([^;]+);base64,([^"]+))"([^>]*)>/gi, (match, beforeSrc, dataUri, mimeType, base64Data, afterSrc) => {
      imageCounter++;
      const ext = mimeType.includes('png') ? 'png' : 'jpeg';
      const location = `word_img_${imageCounter}.${ext}`;
      const contentType = `image/${ext}`;
      const cleanedBase64 = cleanBase64(base64Data);

      mimeParts.push(`--${boundary}
Content-Type: ${contentType}
Content-Transfer-Encoding: base64
Content-Location: ${location}

${cleanedBase64}`);

      return `<img${beforeSrc}src="${location}"${afterSrc}>`;
    });

    // Build full high-fidelity styled HTML document with vertical watermark text shape in MSO header
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4;
            margin: 2.5cm 2.0cm 2.5cm 2.0cm;
          }
          @page Section1 {
            size: A4;
            margin: 2.5cm 2.0cm 2.5cm 2.0cm;
            mso-header: none;
            mso-footer: none;
          }
          div.Section1 {
            page: Section1;
            position: relative;
          }
          @page Section2 {
            size: A4;
            margin: 2.5cm 2.0cm 2.5cm 2.0cm;
            mso-header: h1;
            mso-footer: f1;
          }
          div.Section2 {
            page: Section2;
          }
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #333333;
          }
          p {
            margin-bottom: 10pt;
            text-align: justify;
          }
          h1, h2, h3, h4 {
            color: #009FE3;
            font-family: 'Calibri', 'Arial', sans-serif;
            margin-top: 18pt;
            margin-bottom: 6pt;
            page-break-after: avoid;
          }
          ul, ol {
            margin-top: 0;
            margin-bottom: 10pt;
            padding-left: 20pt;
          }
          li {
            margin-bottom: 4pt;
            text-align: justify;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12pt;
            margin-bottom: 12pt;
          }
          th, td {
            border: 1px solid #bec8d2;
            padding: 8pt;
            font-size: 10pt;
            text-align: left;
            vertical-align: top;
          }
          th {
            background-color: #009FE3;
            color: #ffffff;
            font-weight: bold;
          }
          .page-break {
            page-break-before: always;
            mso-break-type: section-break;
          }
          .cover-page-wrapper {
            text-align: center;
            display: block;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .image-wrapper, .image-container-block {
            text-align: center;
            margin: 20px auto;
            display: block;
            max-width: 580px;
            page-break-inside: avoid;
          }
          img {
            max-width: 280px !important;
            height: auto !important;
            border: 1px solid #bec8d2;
            border-radius: 8px;
            display: block;
            margin: 10px auto;
          }
          .cover-page-wrapper img, img.logo, img[alt*="logo" i], img[alt*="Logo"] {
            max-width: 620px !important;
            height: auto !important;
            border: none !important;
            margin: 15px auto;
          }
        </style>
      </head>
      <body>
        <!-- Header & Footer MSO Definitions -->
        <div style="mso-element: header;" id="h1">
          <!--[if gte mso 9]>
          <v:shape id="WatermarkShape" type="#_x0000_t202" style="position:absolute;left:0;text-align:left;margin-left:420pt;margin-top:110pt;width:120pt;height:400pt;z-index:251652608;v-text-anchor:top" filled="f" stroked="f">
            <v:textbox style="layout-flow:vertical;mso-layout-flow-alt:bottom-to-top">
              <w:txbxContent>
                <w:p>
                  <w:pPr>
                    <w:rPr>
                      <w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/>
                      <w:b/>
                      <w:color w:val="EAEAEA"/>
                      <w:sz w:val="108"/>
                      <w:szCs w:val="108"/>
                    </w:rPr>
                  </w:pPr>
                  <w:r>
                    <w:rPr>
                      <w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/>
                      <w:b/>
                      <w:color w:val="EAEAEA"/>
                      <w:sz w:val="108"/>
                      <w:szCs w:val="108"/>
                    </w:rPr>
                    <w:t>presupuesto</w:t>
                  </w:r>
                </w:p>
              </w:txbxContent>
            </v:textbox>
          </v:shape>
          <![endif]-->
          <table style="width: 100%; border-bottom: 1px solid #009FE3; padding-bottom: 4px; font-size: 8pt; font-family: 'Calibri', sans-serif; color: #555;">
            <tr>
              <td style="border: none; text-align: left; vertical-align: middle;">
                <strong style="color: #009FE3;">ALCEBO CONTROL DE PLAGAS</strong><br/>
                C/ Los Olivos, 3 - 45200 Illescas (Toledo)
              </td>
              <td style="border: none; text-align: right; vertical-align: middle;">
                Tl. 925 541 862<br/>
                alcebo@alcebo.com
              </td>
            </tr>
          </table>
        </div>

        <div style="mso-element: footer;" id="f1">
          <p style="text-align: right; font-size: 9pt; color: #666; border-top: 1px solid #bec8d2; padding-top: 4px;">
            Página <span style="mso-field-code: PAGE;"></span>
          </p>
        </div>
        ${processedHtmlContent}
      </body>
      </html>
    `;

    // Package as MHTML Web Archive format for 100% MS Word compatibility with embedded images
    const mhtmlParts = [
      `MIME-Version: 1.0`,
      `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      fullHtml,
      ``,
      ...mimeParts,
      ``,
      `--${boundary}--`
    ];

    const mhtml = mhtmlParts.join('\r\n');

    const blob = new Blob([mhtml], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presupuesto_${(extractedClient || 'Alcebo').replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('¡Word de alta fidelidad (.doc) descargado con éxito!');
  };

  const handleExportDocx = async () => {
    if (!editorRef.current) return;
    
    // Sincronizar recordatorio primero
    const htmlContent = editorRef.current.innerHTML;
    let extractedClient = quote.clientName;
    const clientMatch = htmlContent.match(/Com\.\s*Prop\.\s*<strong>(.*?)<\/strong>/i);
    if (clientMatch && clientMatch[1]) {
      extractedClient = clientMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    
    const currentQuote: Quote = {
      ...quote,
      clientName: extractedClient || 'Comunidad Editada',
      clientAddress: clientAddressInput,
      clientEmail: clientEmailInput,
      estimationLineal: meters,
      totalCost: priceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    };
    
    enviarAlSeguimiento(currentQuote);
    
    try {
      const cleanBase64 = (str: string): string => {
        if (!str) return '';
        let cleaned = str.replace(/\s/g, '').replace(/ /g, '+');
        if (cleaned.includes('%')) {
          try {
            cleaned = decodeURIComponent(cleaned);
          } catch (e) {}
        }
        return cleaned.replace(/\s/g, '').replace(/ /g, '+');
      };

      // 1. Clean up temporary UI elements in cloned HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      
      const noPrintElements = tempDiv.querySelectorAll('.no-print, .image-toolbar');
      noPrintElements.forEach(el => el.remove());
      
      const editableElements = tempDiv.querySelectorAll('[contenteditable]');
      editableElements.forEach(el => el.removeAttribute('contenteditable'));

      const containers = tempDiv.querySelectorAll('.image-container-block');
      containers.forEach(container => {
        container.removeAttribute('style');
        container.setAttribute('style', 'text-align: center; margin: 20px auto; display: block; max-width: 580px;');
      });

      // Extract body sections starting at CONTENIDO or Section 1 (discarding HTML cover elements)
      const sectionsDiv = document.createElement('div');
      const fullTempHtml = tempDiv.innerHTML;
      
      let bodyStartIdx = -1;
      const idxContenido = fullTempHtml.indexOf('CONTENIDO');
      const idxSec1 = fullTempHtml.search(/1\s*[\.-]\s*CONTROL/i);
      const idxControl = fullTempHtml.search(/CONTROL\s+DE\s+AVES/i);

      if (idxContenido !== -1) {
        bodyStartIdx = fullTempHtml.lastIndexOf('<p', idxContenido);
        if (bodyStartIdx === -1) bodyStartIdx = idxContenido;
      } else if (idxSec1 !== -1) {
        bodyStartIdx = fullTempHtml.lastIndexOf('<p', idxSec1);
        if (bodyStartIdx === -1) bodyStartIdx = idxSec1;
      } else if (idxControl !== -1) {
        bodyStartIdx = fullTempHtml.lastIndexOf('<p', idxControl);
        if (bodyStartIdx === -1) bodyStartIdx = idxControl;
      }

      let cleanBodyHtml = bodyStartIdx !== -1 ? fullTempHtml.substring(bodyStartIdx) : fullTempHtml;
      sectionsDiv.innerHTML = cleanBodyHtml;

      // Unwrap any cover page wrapper safely to preserve all child elements and sections
      sectionsDiv.querySelectorAll('.cover-page-wrapper').forEach(el => {
        el.replaceWith(...Array.from(el.childNodes));
      });

      // 2. Load the base64 Word template using PizZip in the browser
      const zip = new PizZip(WORD_TEMPLATE_BASE64, { base64: true });
      let docXml = zip.file('word/document.xml').asText();

      // Crucial Fix: Increase height of shape _x0000_s1098 from 66.65pt to 110pt so Att: D. Presidente / Administrador de Fincas is NOT clipped at the bottom of the Page 1 box!
      docXml = docXml.replace('height:66.65pt', 'height:110pt');

      // Add DrawingML namespaces to the root w:document tag to avoid red X / broken images in Word 2013
      // We do this first so character indices computed later are correct.
      if (!docXml.includes('xmlns:wp=')) {
        docXml = docXml.replace(
          '<w:document ',
          '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        );
      }
      if (!docXml.includes('xmlns:a=')) {
        docXml = docXml.replace(
          '<w:document ',
          '<w:document xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        );
      }
      if (!docXml.includes('xmlns:pic=')) {
        docXml = docXml.replace(
          '<w:document ',
          '<w:document xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
        );
      }

      let relsXml = zip.file('word/_rels/document.xml.rels').asText();

      const base64ToUint8Array = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };


      // Ensure ContentTypes has jpeg, png
      let contentTypesXml = zip.file('[Content_Types].xml').asText();
      if (!contentTypesXml.includes('Extension="png"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="png" ContentType="image/png"/></Types>'
        );
      }
      if (!contentTypesXml.includes('Extension="jpeg"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>'
        );
      }
      if (!contentTypesXml.includes('Extension="jpg"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="jpg" ContentType="image/jpeg"/></Types>'
        );
      }
      zip.file('[Content_Types].xml', contentTypesXml);

      // Parse existing relationship IDs to guarantee unique rIds for Word 2013
      const relIds: number[] = [];
      const idMatchRegex = /Id="rId(\d+)"/g;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = idMatchRegex.exec(relsXml)) !== null) {
        relIds.push(parseInt(rMatch[1], 10));
      }
      let nextRelIdNum = relIds.length > 0 ? Math.max(...relIds) + 1 : 100;

      // Replace metadata placeholders in the template
      const finalRefCode = quote.refCode || (quote.id.startsWith('q-new') ? 'Ref-ALC-[RELLENAR]' : quote.id);
      let today = quoteDate ? new Date(quoteDate) : new Date();
      if (isNaN(today.getTime())) today = new Date();
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const dayStr = today.getDate().toString().padStart(2, '0');
      const monthStr = monthNames[today.getMonth()];
      const yearStr = today.getFullYear().toString().substring(2);

      const applyPlaceholders = (xml: string): string => {
        if (!xml) return '';
        const cleanClientName = clientNameInput.trim() ? clientNameInput.toUpperCase() : 'COMUNIDAD DE PROPIETARIOS';
        const cleanClientAddress = clientAddressInput.trim() ? clientAddressInput : 'Dirección no especificada';
        const cleanPostalCode = '28001';

        return xml
          .replace(/Com\.\s*Prop\.\s*(?:<[^>]+>)*\s*(?:@{8,11}|COMUNIDAD DE PROPIETARIOS[^<]*)/gi, `Com. Prop. ${escapeXml(cleanClientName)}`)
          .replace(/C\/\s*(?:<[^>]+>)*\s*(?:@{8,11}|Calle[^\n<]*|Calle Guadalajara 12, Baraquies)/gi, `C/ ${escapeXml(cleanClientAddress)}`)
          .replace(/28@{4}|28001/g, escapeXml(cleanPostalCode))
          .replace(/(?:Ref:|Ref-)\s*(?:(?!<\/w:p>)[\s\S])*?(?:@{8,11}|q-\d+|Ref-[A-Z0-9-]+)/gi, `Ref: ${escapeXml(finalRefCode)}`)
          .replace(/@{11}/g, escapeXml(finalRefCode))
          .replace(/@{8}/g, escapeXml(cleanClientName))
          .replace(/@{4}/g, escapeXml(cleanPostalCode))
          .replace(/\[REF_CODE\]/g, escapeXml(finalRefCode))
          .replace(/\[CLIENT_NAME\]/g, escapeXml(cleanClientName))
          .replace(/\[CLIENT_ADDRESS\]/g, escapeXml(cleanClientAddress))
          .replace(/\[POSTAL_CODE\]/g, '28001')
          .replace(/\[DAY\]/g, escapeXml(dayStr))
          .replace(/\[MONTH\]/g, escapeXml(monthStr))
          .replace(/\[YEAR\]/g, escapeXml(yearStr));
      };

      // 3. Parse existing docPr IDs from template to guarantee unique drawing IDs in Word
      const existingDocPrIds: number[] = [];
      const docPrIdRegex = /<wp:docPr[^>]*id="(\d+)"/g;
      let dMatch: RegExpExecArray | null;
      while ((dMatch = docPrIdRegex.exec(docXml)) !== null) {
        existingDocPrIds.push(parseInt(dMatch[1], 10));
      }
      const maxDocPrId = existingDocPrIds.length > 0 ? Math.max(...existingDocPrIds) : 1000;
      let drawingIdCounter = Math.max(5000, maxDocPrId + 100);

      const createDrawingMLXml = (rId: string, widthPt: number, heightPt: number, name: string) => {
        const docPrId = ++drawingIdCounter;
        const cx = Math.round(widthPt * 12700);
        const cy = Math.round(heightPt * 12700);
        return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      };

      // Floating variant (wp:anchor + wrapSquare) used for bird reference photos: the image is pinned
      // to the left of its paragraph and the paragraph's own text (plus following paragraphs, per
      // Word's normal wrap-square behavior) flows around it to the right, instead of the image sitting
      // on its own line like a regular inline picture.
      const createFloatingDrawingMLXml = (rId: string, widthPt: number, heightPt: number, name: string) => {
        const docPrId = ++drawingIdCounter;
        const cx = Math.round(widthPt * 12700);
        const cy = Math.round(heightPt * 12700);
        return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${docPrId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>left</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="right"/><wp:docPr id="${docPrId}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
      };

      // Recursive DOM node to Word XML translator with XML escaping
      const translateNodeToWordXML = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (!text.trim() && text.includes('\n')) return '';
          return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          if (tagName === 'strong' || tagName === 'b') {
            const bg = el.style.backgroundColor || '';
            const isYellow = bg.includes('yellow') || bg.includes('#fef08a') || bg.includes('254') || (el.className && el.className.includes('-field'));
            const txt = (el.textContent || '').trim();
            const isContenidoItem = txt.includes('ELECCIÓN') || txt.includes('CONTROL DE AVES') || txt.includes('LEGISLACIÓN') || txt.includes('PROBLEMAS ASOCIADOS') || txt.includes('SU CASO') || txt.includes('PRESUPUESTO Y GARANTÍAS');
            // Don't bold long body paragraphs (>40 chars) unless they are headers or labels containing a colon or table of contents items
            const isBodyParagraph = txt.length > 40 && !txt.includes(':') && !txt.startsWith('1.') && !txt.startsWith('2.') && !txt.startsWith('3.') && !txt.startsWith('4.') && !txt.startsWith('5.') && !txt.startsWith('6.') && !isYellow && !isContenidoItem;
            const applyBold = !isBodyParagraph;
            return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${applyBold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(txt)}</w:t></w:r>`;
          }
          if (tagName === 'em' || tagName === 'i') {
            return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(el.textContent || '')}</w:t></w:r>`;
          }
          if (tagName === 'u') {
            return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXml(el.textContent || '')}</w:t></w:r>`;
          }
          if (tagName === 'span' || tagName === 'mark') {
            const hasBold = el.style.fontWeight === 'bold' || el.classList.contains('font-bold');
            return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${hasBold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(el.textContent || '')}</w:t></w:r>`;
          }
          if (tagName === 'br') {
            return '<w:r><w:br/></w:r>';
          }
          
          if (tagName === 'p') {
            const img = el.querySelector('img');
            // A floating (wrap-square) bird image is meant to sit inline with this paragraph's own
            // text, not replace it — fall through to the normal paragraph handling below instead of
            // the image-only shortcut.
            if (img && !img.classList.contains('bird-float-img')) {
              // Wrap the image in a proper paragraph honoring the <p>'s own alignment (e.g. a
              // right-aligned signature stamp), instead of discarding it as a bare loose run.
              const imgRunXml = translateNodeToWordXML(img);
              const textAlign = el.style.textAlign;
              const jcVal = textAlign === 'right' ? 'right' : textAlign === 'center' ? 'center' : 'left';
              return `<w:p><w:pPr><w:jc w:val="${jcVal}"/></w:pPr>${imgRunXml}</w:p>`;
            }

            const textContent = el.textContent || '';
            const isSectionHeading = /^\s*\d+\s*[\.-]\s*/.test(textContent) || !!el.querySelector('strong')?.textContent?.match(/^\s*\d+\s*[\.-]\s*/);
            const isPriceLine = !!el.querySelector('.price-amount-field, .price-field-1, .price-field-2, .price-field-3');

            // For price lines, collapse the manually-typed dot/tab leader runs into a sentinel
            // so they can be swapped for a real Word tab stop (matching the official template,
            // which uses <w:tab w:val="right" w:leader="dot"/> instead of literal dots).
            let workEl: HTMLElement = el;
            if (isPriceLine) {
              workEl = el.cloneNode(true) as HTMLElement;
              const walker = document.createTreeWalker(workEl, NodeFilter.SHOW_TEXT);
              const textNodes: Text[] = [];
              let n: Node | null;
              while ((n = walker.nextNode())) textNodes.push(n as Text);
              textNodes.forEach(tn => {
                tn.textContent = (tn.textContent || '').replace(/[\t.]{2,}/g, 'TABSTOP');
              });
            }

            let childXml = '';
            workEl.childNodes.forEach(child => {
              childXml += translateNodeToWordXML(child);
            });

            if (isPriceLine) {
              const tabRun = `</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr><w:t xml:space="preserve">`;
              childXml = childXml.replace(/TABSTOP/g, tabRun);

              return `<w:p>
                <w:pPr>
                  <w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8222"/></w:tabs>
                  <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
                </w:pPr>
                ${childXml}
              </w:p>`;
            }

            if (isSectionHeading) {
              return `<w:p>
                <w:pPr>
                  <w:spacing w:line="480" w:lineRule="auto"/>
                  <w:jc w:val="both"/>
                  <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
                </w:pPr>
                ${childXml}
              </w:p>`;
            }

            return `<w:p>
              <w:pPr>
                <w:jc w:val="both"/>
                <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
              </w:pPr>
              ${childXml}
            </w:p>`;
          }

          if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
            const sz = tagName === 'h1' ? '32' : tagName === 'h2' ? '28' : '24';
            
            return `<w:p>
              <w:pPr>
                <w:spacing w:before="240" w:after="120"/>
                <w:rPr>
                  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
                  <w:b/>
                  <w:color w:val="009FE3"/>
                  <w:sz w:val="${sz}"/>
                </w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
                  <w:b/>
                  <w:color w:val="009FE3"/>
                  <w:sz w:val="${sz}"/>
                </w:rPr>
                <w:t xml:space="preserve">${escapeXml(el.textContent || '')}</w:t>
              </w:r>
            </w:p>`;
          }

          if (tagName === 'ul' || tagName === 'ol') {
            let listXml = '';
            const isUnordered = tagName === 'ul';
            // Skip genuinely empty <li> items (e.g. a stray "<li> </li>" left over as a placeholder in
            // the template) so they don't render as an orphaned, contentless bullet point.
            const items = Array.from(el.children).filter(child => child.tagName.toLowerCase() === 'li' && (child.textContent || '').trim() !== '');
            // Respect the HTML "start" attribute (used to continue Diagnóstico -> Propuesta Técnica
            // numbering as 1./2. instead of both restarting at 1, matching the official template where
            // both share one Word list/numId).
            const startAttr = parseInt(el.getAttribute('start') || '1', 10);
            const startNum = isNaN(startAttr) ? 1 : startAttr;
            // The CONTENIDO (table of contents) list is double line-spaced in the official template
            // (no before/after, just a tall line height) — every other list uses the compact spacing.
            const isToc = !isUnordered && el.previousElementSibling && (el.previousElementSibling.textContent || '').trim() === 'CONTENIDO';
            const listSpacing = isToc ? '<w:spacing w:line="480" w:lineRule="auto"/>' : '<w:spacing w:before="40" w:after="80"/>';
            items.forEach((li, idx) => {
              let liChildXml = '';
              li.childNodes.forEach(c => {
                liChildXml += translateNodeToWordXML(c);
              });
              const cleanLiChild = liChildXml.replace(/<\/?w:p[^>]*>/gi, '');
              const displayNum = startNum + idx;
              const bulletPrefix = isUnordered
                ? `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="333333"/></w:rPr><w:t xml:space="preserve">▪  </w:t></w:r>`
                : `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="009FE3"/></w:rPr><w:t xml:space="preserve">${displayNum}.  </w:t></w:r>`;

              listXml += `<w:p>
                <w:pPr>
                  <w:ind w:left="360" w:hanging="240"/>
                  ${listSpacing}
                  <w:jc w:val="both"/>
                  <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
                </w:pPr>
                ${bulletPrefix}${cleanLiChild}
              </w:p>`;
            });
            return listXml;
          }

          if (tagName === 'table') {
            let tblXml = `<w:tbl>
              <w:tblPr>
                <w:tblStyle w:val="TableGrid"/>
                <w:tblW w:w="5000" w:type="pct"/>
                <w:tblBorders>
                  <w:top w:val="single" w:sz="4" w:space="0" w:color="BEC8D2"/>
                  <w:left w:val="single" w:sz="4" w:space="0" w:color="BEC8D2"/>
                  <w:bottom w:val="single" w:sz="4" w:space="0" w:color="BEC8D2"/>
                  <w:right w:val="single" w:sz="4" w:space="0" w:color="BEC8D2"/>
                  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="BEC8D2"/>
                  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="BEC8D2"/>
                </w:tblBorders>
              </w:tblPr>`;
            
            el.querySelectorAll('tr').forEach(tr => {
              tblXml += `<w:tr>`;
              tr.querySelectorAll('th, td').forEach(cell => {
                const isTh = cell.tagName.toLowerCase() === 'th';
                let cellChildXml = '';
                cell.childNodes.forEach(c => {
                  cellChildXml += translateNodeToWordXML(c);
                });
                
                if (!cellChildXml.includes('<w:p>')) {
                  cellChildXml = `<w:p>
                    <w:pPr>
                      <w:jc w:val="${isTh ? 'center' : 'left'}"/>
                      <w:rPr>
                        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
                        ${isTh ? '<w:b/><w:color w:val="FFFFFF"/>' : ''}
                      </w:rPr>
                    </w:pPr>
                    ${cellChildXml}
                  </w:p>`;
                }
                
                tblXml += `<w:tc>
                  <w:tcPr>
                    <w:tcW w:w="0" w:type="auto"/>
                    ${isTh ? '<w:shd w:fill="009FE3" w:val="clear"/>' : ''}
                    <w:tcMar>
                      <w:top w:w="120" w:type="dxa"/>
                      <w:bottom w:w="120" w:type="dxa"/>
                      <w:left w:w="120" w:type="dxa"/>
                      <w:right w:w="120" w:type="dxa"/>
                    </w:tcMar>
                  </w:tcPr>
                  ${cellChildXml}
                </w:tc>`;
              });
              tblXml += `</w:tr>`;
            });
            
            tblXml += `</w:tbl>`;
            return tblXml;
          }

          if (tagName === 'img') {
            let src = el.getAttribute('src') || '';
            const imgEl = el as HTMLImageElement;
            
            // If src is not a data: URI, try to convert it to data: URI from DOM element via canvas
            if (!src.startsWith('data:')) {
              try {
                if (imgEl.naturalWidth && imgEl.naturalHeight && imgEl.naturalWidth > 0) {
                  const cvs = document.createElement('canvas');
                  cvs.width = imgEl.naturalWidth;
                  cvs.height = imgEl.naturalHeight;
                  const ctx = cvs.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(imgEl, 0, 0);
                    src = cvs.toDataURL('image/png');
                  }
                }
              } catch (e) {
                console.warn('Canvas conversion for img failed:', e);
              }
            }

            if (src.startsWith('data:')) {
              try {
                const currentNum = nextRelIdNum++;
                const bRelId = `rId${currentNum}`;
                const mime = src.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
                const ext = mime.includes('png') ? 'png' : 'jpeg';
                const base64Part = src.split(',')[1] || src;
                const cleaned = cleanBase64(base64Part);
                
                const bTargetPath = `media/visit_photo_${currentNum}.${ext}`;
                zip.file(`word/${bTargetPath}`, base64ToUint8Array(cleaned));
                
                relsXml = relsXml.replace(
                  '</Relationships>',
                  `<Relationship Id="${bRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${bTargetPath}"/></Relationships>`
                );
                
                let pxWidth = 280;
                const styleWidth = el.style.width || el.getAttribute('width') || '';
                if (styleWidth && !styleWidth.includes('%')) {
                  const parsed = parseInt(styleWidth);
                  if (!isNaN(parsed) && parsed > 0) pxWidth = parsed;
                }
                
                let widthPt = pxWidth * 0.75;
                if (widthPt > 320) {
                  widthPt = 320;
                }
                if (widthPt < 80) {
                  widthPt = 240;
                }

                let aspectRatio = 0.75;
                const naturalWidth = imgEl.naturalWidth;
                const naturalHeight = imgEl.naturalHeight;
                if (naturalWidth && naturalHeight && naturalWidth > 0) {
                  aspectRatio = naturalHeight / naturalWidth;
                } else {
                  const attrHeight = el.getAttribute('height');
                  const attrWidth = el.getAttribute('width');
                  if (attrHeight && attrWidth) {
                    const h = parseInt(attrHeight);
                    const w = parseInt(attrWidth);
                    if (w > 0 && h > 0) aspectRatio = h / w;
                  }
                }
                if (aspectRatio > 1.5) aspectRatio = 1.5;
                if (aspectRatio < 0.3) aspectRatio = 0.3;

                const heightPt = widthPt * aspectRatio;

                if (el.classList.contains('bird-float-img')) {
                  return createFloatingDrawingMLXml(bRelId, widthPt, heightPt, 'Imagen');
                }
                return createDrawingMLXml(bRelId, widthPt, heightPt, 'Imagen');
              } catch (imgErr) {
                console.error('Error processing img element for Word export:', imgErr);
              }
            }
            return '';
          }

          if (tagName === 'hr' && el.classList.contains('page-break')) {
            return `<w:r><w:br w:type="page"/></w:r>`;
          }

          if (tagName === 'div' && (el.classList.contains('image-container-block') || el.classList.contains('bird-image-block'))) {
            const containedImg = el.querySelector('img');
            if (!containedImg) return '';
            const imgRunXml = translateNodeToWordXML(containedImg);
            return `<w:p>
              <w:pPr>
                <w:jc w:val="center"/>
                <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
              </w:pPr>
              ${imgRunXml}
            </w:p>`;
          }

          let childXml = '';
          el.childNodes.forEach(child => {
            childXml += translateNodeToWordXML(child);
          });
          return childXml;
        }
        return '';
      };

      // 4. Translate sections HTML from Section 1 onwards (preserving hr.page-break)
      let translatedXML = '';

      // Clean all background-color styles and mark tags from DOM before translating to Word XML
      const cleanSectionsDiv = sectionsDiv.cloneNode(true) as HTMLElement;
      cleanSectionsDiv.querySelectorAll('*').forEach(node => {
        if (node instanceof HTMLElement) {
          node.style.backgroundColor = '';
          node.style.background = '';
        }
      });

      cleanSectionsDiv.childNodes.forEach(child => {
        translatedXML += translateNodeToWordXML(child);
      });

      // Wrap any loose runs or text outside <w:p> or <w:tbl> in <w:p>
      const wrapLooseRunsInParagraphs = (xml: string): string => {
        if (!xml.trim()) return '';
        const tokenRegex = /(<w:p[^>]*>[\s\S]*?<\/w:p>|<w:tbl[^>]*>[\s\S]*?<\/w:tbl>)/gi;
        const parts = xml.split(tokenRegex);
        let result = '';
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.startsWith('<w:p') || part.startsWith('<w:tbl')) {
            result += part;
          } else if (part.trim()) {
            result += `<w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>${part}</w:p>`;
          }
        }
        return result;
      };

      translatedXML = wrapLooseRunsInParagraphs(translatedXML);

      // Clean, safe nested paragraph unwrapper that does NOT corrupt valid XML tags
      let prevUnwrap;
      do {
        prevUnwrap = translatedXML;
        translatedXML = translatedXML.replace(/<w:p\b[^>]*>(\s*<w:p\b[^>]*>[\s\S]*?<\/w:p>\s*)<\/w:p>/gi, '$1');
      } while (translatedXML !== prevUnwrap);

      // Deduplicate consecutive page breaks to eliminate blank pages in Word
      translatedXML = translatedXML.replace(/(?:<w:p><w:r><w:br w:type="page"\/><\/w:r><\/w:p>\s*){2,}/g, '<w:p><w:r><w:br w:type="page"/></w:r></w:p>');

      // 5. Apply placeholders to header1.xml (preserves EjemploBueno.docx corporate logo & vertical 'presupuesto' watermark shape)
      let header1Xml = zip.file('word/header1.xml')?.asText() || '';
      if (header1Xml) {
        header1Xml = applyPlaceholders(header1Xml);
        zip.file('word/header1.xml', header1Xml);
      }

      // 6. Extract Cover Page (Page 1 Portada) from EjemploBueno.docx strictly ending at Page 1 (before PRESUPUESTO pos 40975)
      const p31Pos = docXml.indexOf('PRESUPUESTO');
      const p30ClosePos = p31Pos !== -1 ? docXml.lastIndexOf('</w:p>', p31Pos) + 6 : -1;
      let coverXml = p30ClosePos !== -1 ? docXml.substring(0, p30ClosePos) : '';
      if (coverXml) {
        coverXml = applyPlaceholders(coverXml);
        // The official template stores each cover-page shape (logo, "Informe Técnico" title, the
        // client info box, the watermark) twice — once as a modern DrawingML <mc:Choice> and once as
        // a legacy VML <mc:Fallback> — which real Word only ever renders one of (Choice). Some
        // viewers/converters don't fully support mc:AlternateContent and render both, which is what
        // makes the client name/address box appear duplicated. Blank the Fallback's text runs (keep
        // the shape wrapper itself intact for XML validity) so nothing shows twice anywhere.
        coverXml = coverXml.replace(
          /(<mc:Fallback>)([\s\S]*?)(<\/mc:Fallback>)/g,
          (_m, open, fallbackContent, close) => open + fallbackContent.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, '<w:t$1></w:t>') + close
        );
        // Append a clean page break at the end of Page 1 Portada so Page 2 starts cleanly
        coverXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }

      // Clean missing spaces in deCanalones and clean duplicate text in translatedXML
      translatedXML = translatedXML
        .replace(/(<w:t[^>]*>[^<]*?\bde)(<\/w:t>)/gi, '$1 $2')
        .replace(/de\s\s+<\/w:t>/gi, 'de </w:t>')
        .replace(/\bde(?=[A-ZÁÉÍÓÚÑ])/g, 'de ')
        .replace(/Protección deCanalones/gi, 'Protección de Canalones')
        .replace(/Protección deHuecos/gi, 'Protección de Huecos')
        .replace(/Protección deZonas/gi, 'Protección de Zonas')
        .replace(/deCanalones/gi, 'de Canalones')
        .replace(/deHuecos/gi, 'de Huecos')
        .replace(/deZonas/gi, 'de Zonas')
        .replace(/maquinas/gi, 'máquinas')
        .replace(/El sistema elegido garantizará:\s*(?:<[^>]+>\s*)*[▪\s]*la prolongada persistencia en el tiempo\s*(?:<[^>]+>\s*)*[▪\s]*el efecto mínimo estético/gi, 'El sistema elegido garantizará:')
        .replace(/<w:t[^>]*>\s*presupuesto\s*<\/w:t>/gi, '<w:t></w:t>');

      // Preserve header2.xml / footer files if present
      let header2Xml = zip.file('word/header2.xml')?.asText() || '';
      if (header2Xml) {
        header2Xml = applyPlaceholders(header2Xml);
        zip.file('word/header2.xml', header2Xml);
      }
      let footer1Xml = zip.file('word/footer1.xml')?.asText() || '';
      if (footer1Xml) {
        footer1Xml = applyPlaceholders(footer1Xml);
        zip.file('word/footer1.xml', footer1Xml);
      }
      let footer2Xml = zip.file('word/footer2.xml')?.asText() || '';
      if (footer2Xml) {
        footer2Xml = applyPlaceholders(footer2Xml);
        zip.file('word/footer2.xml', footer2Xml);
      }

      // Inject clean footer1.xml into zip for page numbers (ONLY numbers: 2, 3, 4...)
      const footer1Content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="right"/>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="18"/>
        <w:color w:val="666666"/>
      </w:rPr>
    </w:pPr>
    <w:fldSimple w:instr="PAGE"/>
  </w:p>
</w:ftr>`;
      zip.file('word/footer1.xml', footer1Content);

      if (!relsXml.includes('rId99')) {
        relsXml = relsXml.replace(
          '</Relationships>',
          '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'
        );
      }

      if (!contentTypesXml.includes('footer1.xml')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
        );
        zip.file('[Content_Types].xml', contentTypesXml);
      }

      // Remove any leading page breaks from translatedXML to prevent blank empty page at start of body
      translatedXML = translatedXML.replace(/^(?:\s*<w:p><w:r><w:br w:type="page"\s*\/>\s*<\/w:r>\s*<\/w:p>)+/i, '');
      // Deduplicate consecutive page breaks anywhere in translatedXML
      translatedXML = translatedXML.replace(/(?:<w:p><w:r><w:br w:type="page"\/><\/w:r><\/w:p>\s*){2,}/g, '<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      
      // 1 & 2. Remove standalone page-break paragraphs immediately before the PRESUPUESTO heading and
      // inject a native <w:pageBreakBefore/> into that heading's own paragraph properties instead, so
      // Word cleanly starts it at the top of the next page with ZERO blank pages. Paragraphs are located
      // one-by-one via a bounded (cannot cross </w:p>) match so only the real "6.- PRESUPUESTO..." heading
      // paragraph is ever touched — not the "6.  PRESUPUESTO Y GARANTÍAS" table-of-contents entry, and not
      // some unrelated earlier paragraph.
      {
        const paraMatches = [...translatedXML.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
        const headingIdx = paraMatches.findIndex(m => /6\.-\s*PRESUPUESTO/i.test(m[0]));
        if (headingIdx !== -1) {
          const isStandaloneBreak = (p: string) =>
            /^<w:p\b[^>]*>(?:\s*<w:pPr>[\s\S]*?<\/w:pPr>\s*)?<w:r><w:br w:type="page"\/><\/w:r><\/w:p>$/i.test(p);

          let dropFromIdx = headingIdx;
          while (
            dropFromIdx > 0 &&
            isStandaloneBreak(paraMatches[dropFromIdx - 1][0]) &&
            translatedXML
              .slice(paraMatches[dropFromIdx - 1].index! + paraMatches[dropFromIdx - 1][0].length, paraMatches[dropFromIdx].index!)
              .trim() === ''
          ) {
            dropFromIdx--;
          }

          const headingPara = paraMatches[headingIdx][0];
          const headingWithBreak = headingPara.includes('<w:pPr>')
            ? headingPara.replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/>')
            : headingPara.replace('<w:p', '<w:p><w:pPr><w:pageBreakBefore/></w:pPr>');

          const rangeStart = paraMatches[dropFromIdx].index!;
          const rangeEnd = paraMatches[headingIdx].index! + paraMatches[headingIdx][0].length;
          translatedXML = translatedXML.slice(0, rangeStart) + headingWithBreak + translatedXML.slice(rangeEnd);
        }
      }

      // Section properties with titlePg: Page 1 (Portada) has NO top header line or footer number. Pages 2+ get watermark rId22 and page numbers rId99.
      const sectPrXml = '<w:sectPr w:rsidR="00F4195B" w:rsidSect="00577536"><w:headerReference w:type="default" r:id="rId22"/><w:footerReference w:type="default" r:id="rId99"/><w:titlePg/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2892" w:right="1416" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="284"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';

      // Assemble complete document XML: Cover Page (Portada) + Dynamic Editor Content + Section Properties (Watermark & Page Numbers)
      const finalDocXml = (coverXml || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>') + translatedXML + sectPrXml + '</w:body></w:document>';

      zip.file('word/document.xml', finalDocXml);
      zip.file('word/_rels/document.xml.rels', relsXml);

      // 6. Generate DOCX file blob and download it
      const outBase64 = zip.generate({ type: 'base64' });
      const binaryString = atob(outBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Presupuesto_${(extractedClient || 'Alcebo').replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('¡Documento Word (.docx) descargado con éxito!');
    } catch (error: any) {
      console.error('Error al exportar DOCX:', error);
      showToast('Error al exportar a Word');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <span className="material-symbols-outlined text-[#009FE3]">edit_document</span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Editor Header Panel with Main controls */}
      <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-slate-500 border border-slate-200"
            title="Volver"
          >
            <span className="material-symbols-outlined text-lg leading-none block">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-[#009fe3] text-2xl">description</span>
              Editor de Presupuestos de Word
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Plantilla Oficial: Ppo-mail-2022.docx
              </p>
              <span className="text-[10px] text-slate-350 no-print">|</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide select-none ${
                saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                saveStatus === 'saving' ? 'bg-sky-100 text-[#009FE3] animate-pulse border border-sky-200' :
                'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {saveStatus === 'saved' ? '✓ Guardado' : saveStatus === 'saving' ? '⏳ Guardando...' : '● Cambios sin guardar'}
              </span>
              <span className="text-[10px] text-slate-350 no-print">|</span>
              {syncStatus.type !== 'idle' && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide select-none ${
                  syncStatus.type === 'loading' ? 'bg-sky-100 text-[#009FE3] animate-pulse' :
                  syncStatus.type === 'success' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-rose-100 text-rose-700 border border-rose-200'
                }`}>
                  {syncStatus.type === 'loading' ? '⏳' : syncStatus.type === 'success' ? '✅' : '❌'} {syncStatus.message}
                </span>
              )}
            </div>
          </div>
        </div>

          {/* Action controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleVideoUpload}
              accept="audio/*,video/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Subir vídeo o audio de inspección (Límite: 4.5MB en Vercel, o hasta 25MB con tu clave de Groq en Ajustes)"
            >
              <span className="material-symbols-outlined text-sm">cloud_upload</span>
              {isProcessingVideo ? `Procesando... ${videoProgress}%` : 'Subir Vídeo/Audio (Máx. 4.5MB)'}
            </button>

            <button
              onClick={() => handleSaveAndSync(false)}
              className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Cambios
            </button>
            
            <button
              onClick={handleExportDocx}
              className="flex-1 sm:flex-initial bg-[#009FE3] hover:bg-[#006491] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#009fe3]/15 cursor-pointer active:scale-95"
              title="Descarga la plantilla corporativa oficial Ppo_mail_2022_1.docx rellena con los datos de la aplicación"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Descargar Presupuesto Word (.docx)
            </button>

            <button
              onClick={handleExportMhtml}
              className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Descarga el presupuesto completo de la aplicación (.doc)"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              Descargar (.doc)
            </button>

            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Imprime el presupuesto o guárdalo como PDF en tu ordenador"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Imprimir / PDF
            </button>
          </div>
      </div>

      {/* Editor Formatting Toolbar */}
      <div className="no-print bg-slate-100 border border-slate-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFormat('bold')}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs leading-none cursor-pointer flex items-center justify-center"
            title="Negrita"
          >
            <span className="material-symbols-outlined text-base">format_bold</span>
          </button>
          <button
            onClick={() => handleFormat('italic')}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs leading-none cursor-pointer flex items-center justify-center"
            title="Cursiva"
          >
            <span className="material-symbols-outlined text-base">format_italic</span>
          </button>
          <button
            onClick={() => handleFormat('underline')}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs leading-none cursor-pointer flex items-center justify-center"
            title="Subrayado"
          >
            <span className="material-symbols-outlined text-base">format_underlined</span>
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          
          {/* Insert image button */}
          <button
            onMouseDown={saveCursorPosition}
            onClick={() => {
              saveCursorPosition();
              imageUploadRef.current?.click();
            }}
            className="p-2 bg-[#009FE3]/10 hover:bg-[#009FE3]/20 text-[#009FE3] font-bold rounded-lg text-xs leading-none cursor-pointer flex items-center justify-center gap-1.5"
            title="Insertar Foto en Cursor"
          >
            <span className="material-symbols-outlined text-base">add_photo_alternate</span>
            <span>Insertar Foto aquí</span>
          </button>
          <input
            type="file"
            ref={imageUploadRef}
            onChange={handleImageFileSelect}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="flex flex-col items-end gap-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-[#009FE3]">info</span>
            <span>Puedes escribir en cualquier párrafo del documento directamente.</span>
          </div>

        </div>
      </div>

      {/* Main Workspace layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Left Side: WYSIWYG contenteditable document container (Centered A4 paper wrapper) */}
        <div className="flex-1 w-full max-w-[850px] print-area space-y-6">
          <div className="bg-white border border-slate-200 shadow-2xl hover:shadow-3xl transition-shadow duration-350 rounded-2xl overflow-hidden p-8 sm:p-14 min-h-[1200px] flex flex-col justify-between font-sans relative">
            
            {/* Watermark Logo Container (Shows only in Editor view) */}
            <div 
              className="absolute inset-0 z-0 pointer-events-none opacity-[0.05] bg-center bg-no-repeat bg-contain"
              style={{
                backgroundImage: `url(data:image/jpeg;base64,${WATERMARK_BASE64})`,
                margin: '100px',
              }}
            />
            
            {/* Content editable body wrapper */}
            <div className="z-10 relative flex-1">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyUp={saveCursorPosition}
                onMouseUp={saveCursorPosition}
                onClick={saveCursorPosition}
                onBlur={saveCursorPosition}
                className="outline-none min-h-[1050px] text-justify font-sans text-xs text-slate-800 space-y-6 editor-content-area"
              />
            </div>

            {/* Document footer */}
            <div className="border-t border-slate-100 pt-6 mt-12 text-center text-[10px] text-slate-400 font-medium z-10 relative">
              <p className="font-bold text-slate-800">ALCEBO CONTROL DE PLAGAS S.L.</p>
              <p className="mt-1">Servicio técnico nacional habilitado | Tel: 900 123 456 | Email: soporte@alcebo.com</p>
            </div>
          </div>

          {/* Transcription Text Display Area (Print-hidden) */}
          {customText && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 print:hidden">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#009FE3] text-lg">mic</span>
                  Transcripción de Audio de la Inspección
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(customText);
                    showToast('¡Transcripción copiada al portapapeles!');
                  }}
                  className="text-[10px] font-black text-[#009FE3] hover:text-[#006491] flex items-center gap-1 cursor-pointer bg-[#009FE3]/10 hover:bg-[#009FE3]/15 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                  Copiar Texto
                </button>
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-semibold text-slate-650 leading-relaxed outline-none focus:border-[#009FE3] transition-colors"
                placeholder="El texto del audio/vídeo aparecerá aquí para que puedas copiar y pegar lo que falte..."
              />
            </div>
          )}
        </div>

        {/* Right Side: Configuration & Parameters panel */}
        <div className="no-print w-full lg:w-[320px] shrink-0 space-y-6">
          {/* Technical Configuration Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="material-symbols-outlined text-[#009FE3] text-lg">settings</span>
              Configuración Técnica
            </h3>
            <div className="space-y-3">


              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">📅 Fecha del Presupuesto</label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">🦅 Aves Detectadas / A Tratar (Múltiple)</label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/50 max-h-48 overflow-y-auto">
                  {BIRDS_DATA.map((bird) => {
                    const isChecked = selectedBirds.includes(bird.key);
                    return (
                      <label key={bird.key} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none py-0.5 hover:text-[#009FE3] transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBirds([...selectedBirds, bird.key]);
                            } else {
                              if (selectedBirds.length > 1) {
                                setSelectedBirds(selectedBirds.filter(b => b !== bird.key));
                              }
                            }
                          }}
                          className="w-4 h-4 rounded text-[#009FE3] focus:ring-[#009FE3] border-slate-350"
                        />
                        <span>{bird.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Sistemas Propuestos</label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                  {['Red', 'Varillas', 'Eléctrico', 'Capturas'].map((sys) => {
                    const isChecked = selectedSystems.includes(sys);
                    return (
                      <label key={sys} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              if (selectedSystems.length > 1) {
                                setSelectedSystems(selectedSystems.filter(s => s !== sys));
                              }
                            } else {
                              setSelectedSystems([...selectedSystems, sys]);
                            }
                          }}
                          className="w-4 h-4 rounded text-[#009FE3] focus:ring-[#009FE3] border-slate-350"
                        />
                        <span>{sys === 'Red' ? 'Red Network' : sys === 'Varillas' ? 'Varillas Avipoint' : sys === 'Eléctrico' ? 'Sistema Eléctrico' : 'Jaulas de Captura'}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Client Details Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="material-symbols-outlined text-[#009FE3] text-lg">edit_note</span>
              Datos del Cliente
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Nombre del Cliente</label>
                <input 
                  type="text" 
                  value={clientNameInput} 
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors"
                  placeholder="Ej: COMUNIDAD DE VECINOS"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Dirección de Obra</label>
                <input 
                  type="text" 
                  value={clientAddressInput} 
                  onChange={(e) => handleClientAddressChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors"
                  placeholder="Ej: Calle Principal s/n"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Email del Cliente</label>
                <input 
                  type="email" 
                  value={clientEmailInput} 
                  onChange={(e) => setClientEmailInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors"
                  placeholder="Ej: correo-cliente@ejemplo.com"
                />
              </div>
              
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Líneas de Presupuesto (€)</label>
                  <button
                    type="button"
                    onClick={handleAddPriceItem}
                    className="text-[10px] font-bold text-[#009FE3] hover:text-[#006491] flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Añadir línea
                  </button>
                </div>
                <div className="space-y-2">
                  {priceItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handlePriceLabelChange(idx, e.target.value)}
                        placeholder="Descripción de la partida"
                        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors"
                      />
                      <input
                        type="text"
                        value={item.amount}
                        onChange={(e) => handlePriceAmountChange(idx, e.target.value)}
                        className="w-20 shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors text-center font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePriceItem(idx)}
                        disabled={priceItems.length <= 1}
                        title="Eliminar línea"
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base leading-none block">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick tips panel */}
          <div className="bg-slate-100 border border-slate-200/80 rounded-2xl p-5 text-xs text-slate-600 leading-relaxed">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 mb-3 text-sm">
              <span className="material-symbols-outlined text-[#009FE3] text-xl">tips_and_updates</span>
              Guía del Editor Alcebo
            </h4>
            <ul className="list-disc pl-4 space-y-2 font-medium">
              <li>Haz clic en cualquier parte del documento para corregir o agregar texto libremente.</li>
              <li>Utiliza el botón <strong>"Insertar Foto aquí"</strong> para meter imágenes en cualquier parte del texto.</li>
              <li>Haz <strong>doble clic</strong> sobre cualquier imagen técnica para abrir la pizarra y dibujar flechas e indicaciones.</li>
              <li>Haz clic en <strong>"Descargar Word (.docx)"</strong> para guardar el archivo final rellenado con fotos y con tu plantilla original.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Embedded Drawing Canvas Annotator Modal */}
      {editingImageId && (
        <ImageAnnotator
          imageUrl={editingImageUrl}
          onSave={handleSaveAnnotatedImage}
          onClose={() => setEditingImageId(null)}
        />
      )}
    </div>
  );
}
