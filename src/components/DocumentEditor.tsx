import React, { useState, useEffect, useRef } from 'react';
import { Quote, Template, ConditionalText, SystemConfig } from '../types';
import { DEFAULT_CONDITIONAL_TEXTS, DEFAULT_TEMPLATES } from '../data/defaults';
import ImageAnnotator from './ImageAnnotator';
import { WORD_TEMPLATE_HTML } from '../data/wordTemplateHtml';
import { WATERMARK_BASE64 } from '../data/watermarkBase64';
import PizZip from 'pizzip';
import { WORD_TEMPLATE_BASE64 } from '../data/wordTemplateBase64';

// Extract base64 images from template HTML on module load
let IMAGE_RED_BASE64 = '';
let IMAGE_VARILLAS_BASE64 = '';

const matchRed = WORD_TEMPLATE_HTML.match(/RED NETWORK ANTI-PALOMAS[\s\S]*?<img src="data:image\/jpeg;base64,([^"]+)"/i);
if (matchRed && matchRed[1]) IMAGE_RED_BASE64 = 'data:image/jpeg;base64,' + matchRed[1];

const matchVarillas = WORD_TEMPLATE_HTML.match(/VARILLAS AVIPOINT[\s\S]*?<img src="data:image\/jpeg;base64,([^"]+)"/i);
if (matchVarillas && matchVarillas[1]) IMAGE_VARILLAS_BASE64 = 'data:image/jpeg;base64,' + matchVarillas[1];

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
  const [selectedBird, setSelectedBird] = useState<string>((quote.birds && quote.birds[0]) || 'Palomas');
  const [selectedSystems, setSelectedSystems] = useState<string[]>(quote.systems && quote.systems.length > 0 ? quote.systems : ['Red']);
  const selectedSystem = selectedSystems[0] || 'Red';
  const [meters, setMeters] = useState<number>(quote.estimationLineal || 15);
  
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [customText, setCustomText] = useState<string>(quote.text || '');

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
      const caption = idx === 2 ? 'Fig: Muestra de zona afectada 1' : idx === 3 ? 'Fig: Muestra de zona afectada 2' : 'Fig: Detalle del sistema propuesto';
      
      return `
        <div class="image-container-block no-print-border" style="text-align: center; margin: 20px auto; padding: 12px; border: 2px dashed rgba(0,159,227,0.3); border-radius: 12px; position: relative; display: block; max-width: 580px;" contenteditable="false">
          <div class="image-toolbar no-print" style="display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:10px; background:rgba(15,23,42,0.95); padding:8px 16px; border-radius:10px; width:max-content; margin-left:auto; margin-right:auto; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); color:white; font-family:sans-serif; font-size:11px;">
            <button type="button" onclick="window.drawOnImage('${imgId}')" style="background:#009FE3; color:white; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-family:sans-serif; transition:all 0.2s;">
              🎨 Dibujar
            </button>
            <div style="display:flex; align-items:center; gap:6px; border-left:1px solid rgba(255,255,255,0.2); border-right:1px solid rgba(255,255,255,0.2); padding:0 10px;">
              <span style="font-weight:bold;">Tamaño:</span>
              <input type="range" min="150" max="650" step="5" value="550" oninput="window.resizeImageDOM('${imgId}', this.value)" onchange="window.resizeImageSync('${imgId}', this.value)" style="width:80px; accent-color:#009FE3; cursor:pointer; height:4px; border-radius:2px;" />
            </div>
          </div>
          <img src="data:image/${type};base64,${base64}" class="document-image" data-img-id="${imgId}" style="width:550px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
          <div contenteditable="true" style="font-size:11px; color:#64748B; font-style:italic; margin-top:8px; text-align:center; outline:none; border-bottom:1px dashed transparent; font-family:sans-serif; min-height:18px; padding:2px 0;">
            ${caption}<span class="no-print">. Pulsa "Dibujar" para hacer anotaciones.</span>
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
    setSelectedBird((quote.birds && quote.birds[0]) || 'Palomas');
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
        <p><strong>RED NETWORK ANTI-PALOMAS:</strong> sus características generales son las siguientes:</p>
        <ul>
          <li>Base de polietileno trenzado pretratado contra la radiación U.V.</li>
          <li>Fijación de la red sobre cable de 2mm. de diámetro con puntos de anclaje de seguridad y pasadores, todos de acero galvanizado.</li>
          <li>Cada hebra se forma por 3 filamentos dobles, confiriendo una resistencia muy superior a la necesaria y un diámetro de fibras que impide a las palomas posarse sobre la red.</li>
          <li>El diámetro del rombo de la red de paloma (50 mm.) impide que las palomas pasen a su través sin disminuir la luminosidad ni la ventilación natural.</li>
        </ul>
        <img src="${IMAGE_RED_BASE64}" class="document-image" data-img-id="img_system_red" style="width:550px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
      `;
    }
    if (activeSystems.includes('Varillas')) {
      html += `
        <p><strong>VARILLAS AVIPOINT :</strong> sus características son las siguientes:</p>
        <ul>
          <li>Alambre de acero inoxidable 302 de 1,4 mm. Diámetro emportado en una base de policarbonato protegido contra la luz ultravioleta.</li>
          <li>Punta roma de baja reflectancia que no daña a las aves pero impide su posado.</li>
          <li>Fijación con adhesivo sellador de poliuretano de exteriores.</li>
        </ul>
        <img src="${IMAGE_VARILLAS_BASE64}" class="document-image" data-img-id="img_system_varillas" style="width:550px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
      `;
    }
    if (activeSystems.includes('Eléctrico')) {
      html += `
        <p><strong>SISTEMA ELECTROESTÁTICO DISUASORIO (ELÉCTRICO):</strong> sus características son las siguientes:</p>
        <ul>
          <li>Solución de alta discreción visual, ideal para edificios catalogados o zonas de alto valor estético.</li>
          <li>Emisión de impulsos electroestáticos de baja frecuencia y baja intensidad, completamente inocuos para las aves pero altamente disuasorios.</li>
          <li>Línea perimetral de conductores de acero inoxidable fijados sobre aisladores de policarbonato estabilizado.</li>
        </ul>
      `;
    }
    if (activeSystems.includes('Capturas')) {
      html += `
        <p><strong>PLAN DE CAPTURAS SELECTIVAS:</strong> sus características son las siguientes:</p>
        <ul>
          <li>Instalación de jaulas trampa homologadas dotadas de comederos, bebederos y sombreado para garantizar el bienestar animal.</li>
          <li>Revisiones y mantenimiento periódico por técnicos autorizados para control de capturas, retirada selectiva y cebado.</li>
          <li>Retirada y traslado humanitario de los ejemplares de acuerdo con la legislación autonómica de protección y sanidad animal.</li>
        </ul>
      `;
    }
    return html;
  };

  useEffect(() => {
    if (editorRef.current) {
      const desPlagaEl = editorRef.current.querySelector('.des-plaga-block');
      if (desPlagaEl) {
        const allRules = (rules && rules.length > 0) ? rules : DEFAULT_CONDITIONAL_TEXTS;
        const activeRule = allRules.find(r => r.birdType?.toLowerCase() === selectedBird.toLowerCase());
        const plagaDescription = activeRule ? activeRule.textToInclude : '';
        desPlagaEl.innerHTML = plagaDescription ? `<p>${plagaDescription}</p>` : '';
      }
      
      editorRef.current.querySelectorAll('.plaga-field').forEach(el => {
        el.textContent = selectedBird;
      });

      const sistemasEl = editorRef.current.querySelector('.sistemas-block');
      if (sistemasEl) {
        sistemasEl.innerHTML = wrapImagesInEditor(getSystemsHtml(selectedSystems));
      }
      
      const priSys = selectedSystems[0] || 'Red';
      const z1 = priSys === 'Red' ? 'Canalones y alféizares principales' : 'Cornisas principales de posado';
      const z2 = priSys === 'Red' ? 'Huecos de ventilación del ático' : 'Zonas comunes y repisas de ventanas';
      const z3 = priSys === 'Varillas' ? 'Cornisa superior trasera' : 'Zonas estructurales secundarias';
      
      editorRef.current.querySelectorAll('.zona-1-field').forEach(el => { el.textContent = z1; });
      editorRef.current.querySelectorAll('.zona-2-field').forEach(el => { el.textContent = z2; });
      editorRef.current.querySelectorAll('.zona-3-field').forEach(el => { el.textContent = z3; });
      
      editorRef.current.querySelectorAll('.zonas-afectadas-field').forEach(el => {
        el.textContent = priSys === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas';
      });

      setEditorHtml(editorRef.current.innerHTML);
    }
  }, [selectedBird, selectedSystems]);

  const [price1, setPrice1] = useState<string>('300.00');
  const [price2, setPrice2] = useState<string>('150.00');
  const [price3, setPrice3] = useState<string>('450.00');

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

  const handlePrice1Change = (val: string) => {
    setPrice1(val);
    if (editorRef.current) {
      editorRef.current.querySelectorAll('.price-field-1').forEach(el => {
        el.textContent = val;
      });
    }
  };

  const handlePrice2Change = (val: string) => {
    setPrice2(val);
    if (editorRef.current) {
      editorRef.current.querySelectorAll('.price-field-2').forEach(el => {
        el.textContent = val;
      });
    }
  };

  const handlePrice3Change = (val: string) => {
    setPrice3(val);
    if (editorRef.current) {
      editorRef.current.querySelectorAll('.price-field-3').forEach(el => {
        el.textContent = val;
      });
    }
  };

  // Initialize document content on mount
  useEffect(() => {
    if (quote.documentHtml && quote.documentHtml.length > 50) {
      let docHtml = quote.documentHtml;
      
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
        if (plagaParagraphRegex.test(docHtml)) {
          docHtml = docHtml.replace(plagaParagraphRegex, '<div class="des-plaga-block"></div>');
        } else {
          docHtml = docHtml.replace(/en zonas rurales se concentran junto a explotaciones ganaderas para aprovechar los desechos animales\.\s*<\/p>/gi, 
            '<div class="des-plaga-block"></div>');
        }
      }
      
      // Patch old drafts that don't have .sistemas-block
      if (!docHtml.includes('sistemas-block')) {
        const systemBlockRegex = /<ul><li><strong>RED NETWORK ANTI-PALOMAS[\s\S]*?Fijación con adhesivo sellador de poliuretano de exteriores\.<\/li><\/ul>/i;
        if (systemBlockRegex.test(docHtml)) {
          docHtml = docHtml.replace(systemBlockRegex, '<div class="sistemas-block"></div>');
        } else {
          docHtml = docHtml.replace(/<p><strong>6\.- PRESUPUESTO/gi, '<div class="sistemas-block"></div><p><strong>6.- PRESUPUESTO');
        }
      }

      // Patch old drafts that don't have cover-page-wrapper
      if (!docHtml.includes('cover-page-wrapper')) {
        docHtml = docHtml
          .replace(/<p><strong>presupuesto<\/strong><\/p>/i, '<div class="cover-page-wrapper" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 800px;"><p style="text-align: center; font-size: 24pt; margin-top: 50px;"><strong>PRESUPUESTO</strong></p>')
          .replace(/<p><strong>CONTENIDO<\/strong><\/p>/gi, '</div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>');
      }

      // Strip all remaining footer artifacts globally
      docHtml = docHtml.replace(/<p[^>]*><strong>presupuesto<\/strong><\/p>/gi, '');

      // Patch old drafts that don't have page-break class
      if (!docHtml.includes('page-break')) {
        docHtml = docHtml
          .replace(/<p><strong>1\.-  CONTROL DE AVES URBANAS/gi, '<hr class="page-break" /><p><strong>1.-  CONTROL DE AVES URBANAS')
          .replace(/<p><strong>2\.- LEGISLACIÓN<\/strong><\/p>/gi, '<hr class="page-break" /><p><strong>2.- LEGISLACIÓN</strong></p>')
          .replace(/<p><strong>4\.- LA ELECCIÓN DEL SISTEMA/gi, '<hr class="page-break" /><p><strong>4.- LA ELECCIÓN DEL SISTEMA')
          .replace(/<p><strong>6\.- PRESUPUESTO Y GARANTÍAS/gi, '<hr class="page-break" /><p><strong>6.- PRESUPUESTO Y GARANTÍAS');
      }

      setEditorHtml(docHtml);
      // Attempt to extract existing values to sync the inputs
      setTimeout(() => {
        if (editorRef.current) {
          const cName = editorRef.current.querySelector('.client-name-field')?.textContent;
          const cAddr = editorRef.current.querySelector('.client-address-field')?.textContent;
          const p1 = editorRef.current.querySelector('.price-field-1')?.textContent;
          const p2 = editorRef.current.querySelector('.price-field-2')?.textContent;
          const p3 = editorRef.current.querySelector('.price-field-3')?.textContent;
          if (cName) setClientNameInput(cName);
          if (cAddr) setClientAddressInput(cAddr);
          if (p1) setPrice1(p1);
          if (p2) setPrice2(p2);
          if (p3) setPrice3(p3);
        }
      }, 100);
    } else {
      // Setup the initial HTML using the official Word template and bind placeholders
      const today = new Date();
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
        .replace(plagaParagraphRegex, '<div class="des-plaga-block">[DESCRIPCION_PLAGA]</div>');

      const textForIntro = cleanIntroText(quote.introTecnica || quote.text || "las aves se posaban y anidaban activamente en las zonas elevadas, provocando acumulación de suciedad y daños estructurales");
      const textForProblem = cleanProblemText(quote.problemaPrincipal || "es la acumulación de excrementos y el consiguiente deterioro estético e higiénico.");
      const textForDetail = quote.detalleAdicional || "las bajantes de agua pluvial estaban obstruidas por nidos y plumas";
      const finalRefCode = quote.refCode || (quote.id.startsWith('q-new') ? 'Ref-ALC-' + Math.floor(Math.random() * 90000 + 10000) : quote.id);

      const p1_val = quote.price1 || price1;
      const p2_val = quote.price2 || price2;
      const p3_val = quote.price3 || price3;

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
        .replace(/\[ZONAS_AFECTADAS\]/g, `<span class="zonas-afectadas-field">${selectedSystem === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas'}</span>`)
        .replace(/\[INTRO_TECNICA\]/g, `<span class="transcription-field">${textForIntro}</span>`)
        .replace(/\[PROBLEMA_PRINCIPAL\]/g, `<span class="problema-principal-field">${textForProblem}</span>`)
        .replace(/\[DETALLE_ADICIONAL\]/g, `<span class="detalle-adicional-field">${textForDetail}</span>`)
        .replace(/\[ZONA_1\]/g, `<span class="zona-1-field">${z1}</span>`)
        .replace(/\[ZONA_2\]/g, `<span class="zona-2-field">${z2}</span>`)
        .replace(/\[ZONA_3\]/g, `<span class="zona-3-field">${z3}</span>`)
        .replace(/\[PRECIO_1\]/g, `<span class="price-field-1">${p1_val}</span>`)
        .replace(/\[PRECIO_2\]/g, `<span class="price-field-2">${p2_val}</span>`)
        .replace(/\[PRECIO_3\]/g, `<span class="price-field-3">${p3_val}</span>`)
        .replace(/\[TECNICO\]/g, `<span class="tecnico-field">Técnico Oficial Alcebo</span>`)
        .replace(/\[TELEFONO\]/g, `<span class="telefono-field">900 123 456</span>`)
        .replace(/\[DESCRIPCION_PLAGA\]/g, '')
        .replace(/\[DESCRIPCIONES_SISTEMAS\]/g, '')
        .replace(/<p><strong>presupuesto<\/strong><\/p>/i, '<div class="cover-page-wrapper" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 800px;"><p style="text-align: center; font-size: 24pt; margin-top: 50px;"><strong>PRESUPUESTO</strong></p>')
        .replace(/<p><strong>presupuesto<\/strong><\/p>/gi, '')
        .replace(/<p><strong>CONTENIDO<\/strong><\/p>/gi, '</div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>')
        .replace(/<p><strong>1\.-  CONTROL DE AVES URBANAS/gi, '<hr class="page-break" /><p><strong>1.-  CONTROL DE AVES URBANAS')
        .replace(/<p><strong>2\.- LEGISLACIÓN<\/strong><\/p>/gi, '<hr class="page-break" /><p><strong>2.- LEGISLACIÓN</strong></p>')
        .replace(/<p><strong>4\.- LA ELECCIÓN DEL SISTEMA/gi, '<hr class="page-break" /><p><strong>4.- LA ELECCIÓN DEL SISTEMA')
        .replace(/<p><strong>6\.- PRESUPUESTO Y GARANTÍAS/gi, '<hr class="page-break" /><p><strong>6.- PRESUPUESTO Y GARANTÍAS');

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

  // Synchronize editorHtml with the DOM only when they differ (avoids React rebuilding innerHTML on keystrokes, which resets cursor and scroll position)
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== editorHtml) {
        editorRef.current.innerHTML = editorHtml;
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
          <input type="range" min="150" max="650" step="5" value="550" oninput="window.resizeImageDOM('${imgId}', this.value)" onchange="window.resizeImageSync('${imgId}', this.value)" style="width:80px; accent-color:#009FE3; cursor:pointer; height:4px; border-radius:2px;" />
        </div>
        
        <button type="button" onclick="window.deleteImage('${imgId}')" style="background:#EF4444; color:white; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-family:sans-serif; transition:all 0.2s;">
          🗑️ Eliminar
        </button>
      </div>
      <img src="${base64Url}" class="document-image" data-img-id="${imgId}" style="width:550px; max-width:100%; height:auto; border:1px solid #bec8d2; border-radius:8px;" />
      <div contenteditable="true" style="font-size:11px; color:#64748B; font-style:italic; margin-top:8px; text-align:center; outline:none; border-bottom:1px dashed transparent; font-family:sans-serif; min-height:18px; padding:2px 0;" placeholder="Escribe un pie de foto...">
        Fig: Plano de obra (${filename})<span class="no-print">. Pulsa "Dibujar" para hacer anotaciones.</span>
      </div>
    `;
    return div;
  };

  // Insert image at current cursor selection or append as block
  const insertImageAtCursor = (base64Url: string, filename: string) => {
    const imgId = 'img_' + Date.now() + Math.floor(Math.random() * 1000);
    const selection = window.getSelection();
    
    // Fallback: If no selection or cursor is outside the editor canvas, append to the end of the editor flow
    if (!selection || !selection.rangeCount || !editorRef.current?.contains(selection.anchorNode)) {
      if (editorRef.current) {
        const div = createImageBlock(base64Url, filename, imgId);
        editorRef.current.appendChild(div);
        setEditorHtml(editorRef.current.innerHTML);
        showToast('¡Foto añadida al final del documento!');
      }
      return;
    }
    
    const range = selection.getRangeAt(0);
    const div = createImageBlock(base64Url, filename, imgId);
    
    range.deleteContents();
    range.insertNode(div);
    
    // Position text cursor after the newly inserted block
    range.setStartAfter(div);
    range.setEndAfter(div);
    selection.removeAllRanges();
    selection.addRange(range);
    
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
    showToast('¡Foto técnica insertada en la posición del cursor!');
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      insertImageAtCursor(reader.result as string, file.name);
      if (imageUploadRef.current) imageUploadRef.current.value = '';
    };
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
  const handleSaveAndSync = () => {
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
      clientName: clientNameInput || extractedClient || 'Comunidad Editada',
      clientAddress: clientAddressInput,
      clientEmail: clientEmailInput,
      birds: [selectedBird],
      systems: selectedSystems,
      estimationLineal: meters,
      totalCost: parseFloat(price3) || 0,
      documentHtml: htmlContent,
      text: cleanText.substring(0, 1000)
    };
    
    onSaveQuote(updated);
    showToast('¡Presupuesto y plantilla guardados en el historial!');
    enviarAlSeguimiento(updated);
  };

  // Auto-fill from video/audio transcription
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingVideo(true);
    setVideoProgress(10);

    try {
      const userKey = config?.groqApiKey?.trim();
      const userLlmKey = config?.llmApiKey?.trim();

      const reader = new FileReader();
      reader.readAsDataURL(file);
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
- "detectedBird": Debe ser uno de los siguientes valores exactos en español: "Palomas", "Gorriones", "Cigüeñas", "Gaviotas", "Cotorras", "Golondrinas", "Urracas".
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
            else if (textLower.includes('urraca')) detectedBird = 'Urracas';
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
 
          setSelectedBird(detectedBird);
          setSelectedSystems(detectedSystemsList);
 
          // Re-initialize from template to ensure clean replacements
          const today = new Date();
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

          let p1_val = price1;
          let p2_val = price2;
          let p3_val = price3;

          if (ai) {
            if (ai.price1) { p1_val = ai.price1; setPrice1(ai.price1); }
            if (ai.price2) { p2_val = ai.price2; setPrice2(ai.price2); }
            if (ai.price3) { p3_val = ai.price3; setPrice3(ai.price3); }
          }
          
          const systemBlockRegex = /<ul><li><strong>RED NETWORK ANTI-PALOMAS[\s\S]*?Fijación con adhesivo sellador de poliuretano de exteriores\.<\/li><\/ul>/i;
          const plagaParagraphRegex = /<p>Las estimaciones indican que una ciudad media mediterránea posee una población de más de 1500 palomas por kilómetro cuadrado[\s\S]*?aprovechar los desechos animales\.\s*<\/p>/gi;
          const templateWithPlaceholders = WORD_TEMPLATE_HTML
            .replace(systemBlockRegex, '<div class="sistemas-block">[DESCRIPCIONES_SISTEMAS]</div>')
            .replace(plagaParagraphRegex, '<div class="des-plaga-block">[DESCRIPCION_PLAGA]</div>');

          const finalRefCode = (ai && ai.refCode) || (quote.id.startsWith('q-new') ? 'Ref-ALC-' + Math.floor(Math.random() * 90000 + 10000) : quote.id);

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
            .replace(/\[ZONAS_AFECTADAS\]/g, `<span class="zonas-afectadas-field">${primarySys === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas'}</span>`)
            .replace(/\[INTRO_TECNICA\]/g, `<span class="transcription-field">${textForIntro}</span>`)
            .replace(/\[PROBLEMA_PRINCIPAL\]/g, `<span class="problema-principal-field">${textForProblem}</span>`)
            .replace(/\[DETALLE_ADICIONAL\]/g, `<span class="detalle-adicional-field">${textForDetail}</span>`)
            .replace(/\[ZONA_1\]/g, `<span class="zona-1-field">${z1}</span>`)
            .replace(/\[ZONA_2\]/g, `<span class="zona-2-field">${z2}</span>`)
            .replace(/\[ZONA_3\]/g, `<span class="zona-3-field">${z3}</span>`)
            .replace(/\[PRECIO_1\]/g, `<span class="price-field-1">${p1_val}</span>`)
            .replace(/\[PRECIO_2\]/g, `<span class="price-field-2">${p2_val}</span>`)
            .replace(/\[PRECIO_3\]/g, `<span class="price-field-3">${p3_val}</span>`)
            .replace(/\[TECNICO\]/g, `<span class="tecnico-field">Técnico Oficial Alcebo</span>`)
            .replace(/\[TELEFONO\]/g, `<span class="telefono-field">900 123 456</span>`)
            .replace(/\[DESCRIPCION_PLAGA\]/g, '')
            .replace(/\[DESCRIPCIONES_SISTEMAS\]/g, '')
            .replace(/<p><strong>presupuesto<\/strong><\/p>/i, '<div class="cover-page-wrapper" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 800px;"><p style="text-align: center; font-size: 24pt; margin-top: 50px;"><strong>PRESUPUESTO</strong></p>')
            .replace(/<p><strong>presupuesto<\/strong><\/p>/gi, '')
            .replace(/<p><strong>CONTENIDO<\/strong><\/p>/gi, '</div><hr class="page-break" /><p><strong>CONTENIDO</strong></p>')
            .replace(/<p><strong>1\.-  CONTROL DE AVES URBANAS/gi, '<hr class="page-break" /><p><strong>1.-  CONTROL DE AVES URBANAS')
            .replace(/<p><strong>2\.- LEGISLACIÓN<\/strong><\/p>/gi, '<hr class="page-break" /><p><strong>2.- LEGISLACIÓN</strong></p>')
            .replace(/<p><strong>4\.- LA ELECCIÓN DEL SISTEMA/gi, '<hr class="page-break" /><p><strong>4.- LA ELECCIÓN DEL SISTEMA')
            .replace(/<p><strong>6\.- PRESUPUESTO Y GARANTÍAS/gi, '<hr class="page-break" /><p><strong>6.- PRESUPUESTO Y GARANTÍAS');
 
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

  // Export high-fidelity MHTML Word document (.doc) directly on the client-side
  const handleExportMhtml = () => {
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
      totalCost: parseFloat(price3) || 0,
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

    const imagesInDoc = tempDiv.querySelectorAll('img');
    imagesInDoc.forEach(img => {
      const imgId = img.getAttribute('data-img-id') || '';
      
      if (!imgId.startsWith('img_') || imgId.startsWith('img_system_')) return;
      
      const originalImg = editorRef.current?.querySelector(`img[data-img-id="${imgId}"]`);
      const container = originalImg?.closest('.image-container-block');
      const slider = container?.querySelector('input[type="range"]') as HTMLInputElement;
      
      let pxWidth = 550;
      if (slider && slider.value) {
        pxWidth = parseInt(slider.value);
      } else {
        const styleWidth = img.style.width || img.getAttribute('width');
        if (styleWidth) {
          const parsed = parseInt(styleWidth);
          if (!isNaN(parsed)) pxWidth = parsed;
        }
      }
      if (isNaN(pxWidth) || pxWidth <= 0) pxWidth = 550;

      let aspectRatio = 0.75;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      if (naturalWidth && naturalHeight && naturalWidth > 0) {
        aspectRatio = naturalHeight / naturalWidth;
      }
      
      const pxHeight = Math.round(pxWidth * aspectRatio);

      img.setAttribute('width', pxWidth.toString());
      img.setAttribute('height', pxHeight.toString());
      img.style.width = pxWidth + 'px';
      img.style.height = pxHeight + 'px';
    });

    const cleanHtmlContent = tempDiv.innerHTML;
    
    // Build full high-fidelity styled HTML document
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
            break-before: page;
          }
          .cover-page-wrapper {
            text-align: center;
            display: block;
            margin-top: 100px;
            margin-bottom: 100px;
            page-break-after: always;
          }
          .image-wrapper, .image-container-block {
            text-align: center;
            margin: 20px auto;
            display: block;
            max-width: 580px;
            page-break-inside: avoid;
          }
          img {
            border: 1px solid #bec8d2;
            border-radius: 8px;
            display: block;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        ${cleanHtmlContent}
      </body>
      </html>
    `;

    // Package as MHTML Web Archive format for maximum MS Word styling compatibility
    const mhtml = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----boundary"

------boundary
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: 7bit

${fullHtml}
------boundary--`;

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

  // Export high-fidelity DOCX using 100% client-side template-filling
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
      totalCost: parseFloat(price3) || 0,
    };
    
    enviarAlSeguimiento(currentQuote);
    
    try {
      const docEl = editorRef.current;
      const getFieldText = (className: string, fallback: string): string => {
        const el = docEl.querySelector(`.${className}`);
        return el ? el.textContent || fallback : fallback;
      };

      const today = new Date();
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      
      const dayStr = today.getDate().toString().padStart(2, '0');
      const monthStr = monthNames[today.getMonth()];
      const yearStr = today.getFullYear().toString().substring(2);

      const priSys = selectedSystems[0] || 'Red';
      const z1 = priSys === 'Red' ? 'Canalones y alféizares principales' : 'Cornisas principales de posado';
      const z2 = priSys === 'Red' ? 'Huecos de ventilación del ático' : 'Zonas comunes y repisas de ventanas';
      const z3 = priSys === 'Varillas' ? 'Cornisa superior trasera' : 'Zonas estructurales secundarias';

      const p1_val = quote.price1 || price1;
      const p2_val = quote.price2 || price2;
      const p3_val = quote.price3 || price3;

      const finalRefCode = quote.refCode || (quote.id.startsWith('q-new') ? 'Ref-ALC-' + Math.floor(Math.random() * 90000 + 10000) : quote.id);

      const textForIntro = cleanIntroText(quote.introTecnica || quote.text || "las aves se posaban y anidaban activamente en las zonas elevadas, provocando acumulación de suciedad y daños estructurales");
      const textForProblem = cleanProblemText(quote.problemaPrincipal || "es la acumulación de excrementos y el consiguiente deterioro estético e higiénico.");
      const textForDetail = quote.detalleAdicional || "las bajantes de agua pluvial estaban obstruidas por nidos y plumas";

      const desPlagaEl = docEl.querySelector('.des-plaga-block');
      const plagaDescription = desPlagaEl ? desPlagaEl.textContent || '' : '';

      const variables = {
        refCode: getFieldText('ref-code-field', finalRefCode),
        clientName: getFieldText('client-name-field', (extractedClient || 'Comunidad').toUpperCase()),
        clientAddress: getFieldText('client-address-field', clientAddressInput),
        postalCode: getFieldText('postal-code-field', '28001'),
        postalCodePrefix: getFieldText('postal-code-prefix-field', '28'),
        attName: getFieldText('att-name-field', 'Presidente / Administrador de Fincas'),
        day: getFieldText('day-field', dayStr),
        month: getFieldText('month-field', monthStr),
        year: getFieldText('year-field', yearStr),
        plaga: selectedBird,
        zonasAfectadas: getFieldText('zonas-afectadas-field', priSys === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas'),
        introTecnica: getFieldText('transcription-field', textForIntro),
        problemaPrincipal: getFieldText('problema-principal-field', textForProblem),
        detalleAdicional: getFieldText('detalle-adicional-field', textForDetail),
        zona1: getFieldText('zona-1-field', z1),
        zona2: getFieldText('zona-2-field', z2),
        zona3: getFieldText('zona-3-field', z3),
        price1: getFieldText('price-field-1', p1_val),
        price2: getFieldText('price-field-2', p2_val),
        price3: getFieldText('price-field-3', p3_val),
        tecnico: getFieldText('tecnico-field', 'Técnico Oficial Alcebo'),
        telefono: getFieldText('telefono-field', '900 123 456'),
        plagaDescription,
        activeSystems: selectedSystems
      };

      // 1. Extract visit images and calculate dimensions directly using DOM API
      const images: Record<string, string> = {};
      const imgDimensions: Record<string, { widthPt: number; heightPt: number }> = {};
      const imgElements = docEl.querySelectorAll('img');
      let visitPhotoCount = 0;
      
      imgElements.forEach(img => {
        const src = img.getAttribute('src') || '';
        const imgId = img.getAttribute('data-img-id') || '';
        
        // Skip logo and system diagrams
        if (!imgId.startsWith('img_') || imgId.startsWith('img_system_')) return;
        
        visitPhotoCount++;
        const base64 = src.split(',')[1] || src;
        const key = `img_template_${visitPhotoCount + 1}`; // img_template_2, img_template_3
        images[key] = base64;

        // Extract width and aspect ratio dynamically
        const container = img.closest('.image-container-block');
        const slider = container?.querySelector('input[type="range"]') as HTMLInputElement;
        
        let pxWidth = 550;
        if (slider && slider.value) {
          pxWidth = parseInt(slider.value);
        } else {
          const styleWidth = img.style.width || img.getAttribute('width');
          if (styleWidth) {
            const parsed = parseInt(styleWidth);
            if (!isNaN(parsed)) pxWidth = parsed;
          }
        }
        if (isNaN(pxWidth) || pxWidth <= 0) pxWidth = 550;

        let aspectRatio = 0.75;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        if (naturalWidth && naturalHeight && naturalWidth > 0) {
          aspectRatio = naturalHeight / naturalWidth;
        } else {
          const rect = img.getBoundingClientRect();
          if (rect.width && rect.height && rect.width > 0) {
            aspectRatio = rect.height / rect.width;
          }
        }
        if (isNaN(aspectRatio) || aspectRatio <= 0) aspectRatio = 0.75;

        const widthPt = pxWidth * 0.75;
        const heightPt = widthPt * aspectRatio;

        imgDimensions[key] = {
          widthPt: parseFloat(widthPt.toFixed(1)),
          heightPt: parseFloat(heightPt.toFixed(1))
        };
      });

      // 2. Load the base64 Word template using PizZip in the browser
      const zip = new PizZip(WORD_TEMPLATE_BASE64, { base64: true });
      let docXml = zip.file('word/document.xml').asText();

      // 3. Modify XML placeholders
      let atIdx = 0;
      docXml = docXml.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi, (match, content) => {
        if (content.includes('@@')) {
          atIdx++;
          switch (atIdx) {
            case 1: return `<w:t>${variables.refCode}</w:t>`;
            case 2: return `<w:t>${variables.clientName}</w:t>`;
            case 3: return `<w:t>${variables.clientAddress}</w:t>`;
            case 4: return `<w:t>${variables.postalCode}   Madrid</w:t>`;
            case 5: return `<w:t>${variables.attName}</w:t>`;
            case 6: return `<w:t>${variables.day}</w:t>`;
            case 7: return `<w:t>${variables.month}</w:t>`;
            case 8: return `<w:t>${variables.year}</w:t>`;
            case 9: return `<w:t>${variables.clientAddress}</w:t>`;
            case 10: {
              const pluralMap: Record<string, string> = {
                'Palomas': 'palomas',
                'Gorriones': 'gorriones',
                'Cigüeñas': 'cigüeñas',
                'Gaviotas': 'gaviotas',
                'Cotorras': 'cotorras',
                'Golondrinas': 'golondrinas',
                'Urracas': 'urracas'
              };
              const pluralBird = pluralMap[variables.plaga] || variables.plaga.toLowerCase();
              
              const searchStr = '<w:t xml:space="preserve">palomas en </w:t>';
              const nextPalomas = docXml.indexOf(searchStr);
              if (nextPalomas !== -1) {
                docXml = docXml.substring(0, nextPalomas) + '<w:t xml:space="preserve"> en </w:t>' + docXml.substring(nextPalomas + searchStr.length);
              }
              return `<w:t>${pluralBird}</w:t>`;
            }
            case 11: return `<w:t>${variables.zonasAfectadas}</w:t>`;
            case 12: {
              const lines = variables.introTecnica.split('\n').filter((l: string) => l.trim().length > 0);
              if (lines.length > 0) {
                return lines.join('</w:t></w:r></w:p><w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr><w:t>');
              }
              return `<w:t>se observó presencia activa de aves en la edificación</w:t>`;
            }
            case 13: return `<w:t>El problema principal ${variables.problemaPrincipal}</w:t>`;
            case 14: return `<w:t>${variables.detalleAdicional}</w:t>`;
            case 15: return `<w:t>${variables.zona1}</w:t>`;
            case 16: return `<w:t>${variables.zona2}</w:t>`;
            case 17: return `<w:t>${variables.zona3}</w:t>`;
            case 18: return `<w:t>${variables.telefono}</w:t>`;
            case 19: return `<w:t>${variables.postalCodePrefix}</w:t>`;
            case 20: return `<w:t>${variables.refCode}</w:t>`;
            case 21: return `<w:t>................ ${variables.price1}</w:t>`;
            case 22: return `<w:t>${variables.price3}</w:t>`;
            case 23: return `<w:t>........ ${variables.price2}</w:t>`;
            case 24: return `<w:t>${variables.tecnico}</w:t>`;
            case 25: return `<w:t>${variables.clientAddress}</w:t>`;
          }
        }
        return match;
      });

      // 4. Inject plaga description
      if (variables.plagaDescription) {
        const birdAnchorRegex = /<w:p[^>]*>[\s\S]*?aprovechar los desechos animales[\s\S]*?<\/w:p>/i;
        const lines = variables.plagaDescription.split('\n').filter(l => l.trim().length > 0);
        const xmlParagraphs = lines.map(line => `
          <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/></w:rPr>
              <w:t>${line}</w:t>
            </w:r>
          </w:p>
        `).join('');
        
        docXml = docXml.replace(birdAnchorRegex, (match) => match + xmlParagraphs);
      }

      // 5. Remove unproposed systems
      if (!variables.activeSystems.includes('Red')) {
        const pRedTitle = /<w:p[^>]*>[\s\S]*?r:id="rId11"[\s\S]*?<\/w:p>/g;
        docXml = docXml.replace(pRedTitle, '');
        const pRedBullets = [
          /<w:p[^>]*>[\s\S]*?Base de polietileno trenzado[\s\S]*?<\/w:p>/gi,
          /<w:p[^>]*>[\s\S]*?Fijación de la red sobre cable[\s\S]*?<\/w:p>/gi,
          /<w:p[^>]*>[\s\S]*?Cada hebra se forma por 3 filamentos[\s\S]*?<\/w:p>/gi,
          /<w:p[^>]*>[\s\S]*?El diámetro del rombo[\s\S]*?<\/w:p>/gi,
        ];
        pRedBullets.forEach(re => { docXml = docXml.replace(re, ''); });
      }

      if (!variables.activeSystems.includes('Varillas')) {
        const pVarillasTitle = /<w:p[^>]*>[\s\S]*?r:id="rId12"[\s\S]*?<\/w:p>/g;
        docXml = docXml.replace(pVarillasTitle, '');
        const pVarillasBullets = [
          /<w:p[^>]*>[\s\S]*?Alambre de acero inoxidable[\s\S]*?<\/w:p>/gi,
          /<w:p[^>]*>[\s\S]*?Punta roma de baja[\s\S]*?<\/w:p>/gi,
          /<w:p[^>]*>[\s\S]*?Fijación con adhesivo sellador[\s\S]*?<\/w:p>/gi,
        ];
        pVarillasBullets.forEach(re => { docXml = docXml.replace(re, ''); });
      }

      // Add electric/capturas XML if proposed
      const electricoXml = `
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/></w:rPr>
            <w:t>SISTEMA ELECTROESTÁTICO DISUASORIO (ELÉCTRICO): </w:t>
          </w:r>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>sus características son las siguientes:</w:t>
          </w:r>
        </w:p>
        <w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="17"/></w:numPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>Solución de alta discreción visual, ideal para edificios catalogados o zonas de alto valor estético.</w:t>
          </w:r>
        </w:p>
        <w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="17"/></w:numPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>Emisión de impulsos electroestáticos de baja frecuencia y baja intensidad, completamente inocuos para las aves pero altamente disuasorios.</w:t>
          </w:r>
        </w:p>
        <w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="17"/></w:numPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>Línea perimetral de conductores de acero inoxidable fijados sobre aisladores de policarbonato estabilizado.</w:t>
          </w:r>
        </w:p>
      `;

      const capturasXml = `
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/></w:rPr>
            <w:t>PLAN DE CAPTURAS SELECTIVAS: </w:t>
          </w:r>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>sus características son las siguientes:</w:t>
          </w:r>
        </w:p>
        <w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="17"/></w:numPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>Instalación de jaulas trampa homologadas dotadas de comederos, bebederos y sombreado para garantizar el bienestar animal.</w:t>
          </w:r>
        </w:p>
        <w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="17"/></w:numPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>Revisiones y mantenimiento periódico por técnicos autorizados para control de capturas, retirada selectiva y cebado.</w:t>
          </w:r>
        </w:p>
        <w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="17"/></w:numPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>
            <w:t>Retirada y traslado humanitario de los ejemplares de acuerdo con la legislación autonómica de protección y sanidad animal.</w:t>
          </w:r>
        </w:p>
      `;

      if (variables.activeSystems.includes('Eléctrico') || variables.activeSystems.includes('Capturas')) {
        const anchorRegex = /<w:p[^>]*>[\s\S]*?A continuación detallamos las características de los sistemas elegidos[\s\S]*?<\/w:p>/i;
        docXml = docXml.replace(anchorRegex, (match) => {
          let extraXml = '';
          if (variables.activeSystems.includes('Eléctrico')) {
            extraXml += electricoXml;
          }
          if (variables.activeSystems.includes('Capturas')) {
            extraXml += capturasXml;
          }
          return match + extraXml;
        });
      }

      // 6. Inject custom visit photos dynamically inside XML by appending relationships
      let relsXml = zip.file('word/_rels/document.xml.rels').asText();
      if (images['img_template_2']) { // Visit photo 1
        relsXml = relsXml.replace('</Relationships>', '<Relationship Id="rId25" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image5.jpeg"/></Relationships>');
        zip.file('word/media/image5.jpeg', atob(images['img_template_2']), { binary: true });
      }
      if (images['img_template_3']) { // Visit photo 2
        relsXml = relsXml.replace('</Relationships>', '<Relationship Id="rId26" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image6.jpeg"/></Relationships>');
        zip.file('word/media/image6.jpeg', atob(images['img_template_3']), { binary: true });
      }
      zip.file('word/_rels/document.xml.rels', relsXml);

      let photoIdx = 0;
      docXml = docXml.replace(/<w:p[^>]*>([\s\S]*?<w:t>Foto Muestra<\/w:t>[\s\S]*?)<\/w:p>/gi, (match) => {
        photoIdx++;
        const key = `img_template_${photoIdx + 1}`;
        const rId = photoIdx === 1 ? 'rId25' : 'rId26';
        
        if (images[key] && imgDimensions[key]) {
          const { widthPt, heightPt } = imgDimensions[key];
          return `
            <w:p>
              <w:pPr><w:jc w:val="center"/></w:pPr>
              <w:r>
                <w:pict>
                  <v:shape id="VisitPhoto${photoIdx}" style="width:${widthPt}pt;height:${heightPt}pt;" type="#_x0000_t75">
                    <v:imagedata r:id="${rId}" o:title="Foto Inspeccion ${photoIdx}"/>
                  </v:shape>
                </w:pict>
              </w:r>
            </w:p>
          `;
        }
        return ''; // Delete the "Foto Muestra" placeholder text if no photo uploaded
      });

      // 7. Write modified XML back into zip
      zip.file('word/document.xml', docXml);

      // 8. Generate DOCX file blob and download it
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
      
      showToast('¡Documento Word oficial (.docx) compilado y descargado!');
    } catch (err: any) {
      console.error(err);
      alert(`Error al descargar el Word:\n${err.message}`);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
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
              <a 
                href="https://online-audio-converter.com/sp/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-[#009FE3] hover:text-[#006491] font-bold underline flex items-center gap-0.5 cursor-pointer no-print"
                title="Comprime o convierte tu vídeo/audio si supera el límite de tamaño de subida"
              >
                <span className="material-symbols-outlined text-[10px] leading-none block">compress</span>
                Reducir tamaño de vídeo/audio
              </a>
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
              onClick={handleSaveAndSync}
              className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Cambios
            </button>
            
            <button
              onClick={handleExportMhtml}
              className="flex-1 sm:flex-initial bg-[#009FE3] hover:bg-[#006491] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#009fe3]/15 cursor-pointer active:scale-95"
              title="Descarga un Word editable (.doc) que coincide exactamente con lo que ves en pantalla"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Descargar Word (.doc - Vista Previa)
            </button>

            <button
              onClick={handleExportDocx}
              className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Descarga la plantilla corporativa Ppo-mail-2022.docx rellena"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              Descargar Word (.docx - Plantilla)
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
      <div className="bg-slate-100 border border-slate-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
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
            onClick={() => imageUploadRef.current?.click()}
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
          <div className="flex items-center gap-1.5 text-amber-600">
            <span className="material-symbols-outlined text-base text-xs">warning</span>
            <span>Tip: Para Imprimir/PDF con logotipo de fondo, activa "Gráficos de fondo".</span>
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
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          {/* Technical Configuration Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="material-symbols-outlined text-[#009FE3] text-lg">settings</span>
              Configuración Técnica
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Tipo de Ave-Plaga</label>
                <select
                  value={selectedBird}
                  onChange={(e) => setSelectedBird(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors bg-white cursor-pointer"
                >
                  <option value="Palomas">Palomas (Columba livia)</option>
                  <option value="Gorriones">Gorriones (Passer domesticus)</option>
                  <option value="Cigüeñas">Cigüeñas (Ciconia ciconia)</option>
                  <option value="Gaviotas">Gaviotas (Laridae)</option>
                  <option value="Cotorras">Cotorras (Invasoras)</option>
                  <option value="Golondrinas">Golondrinas (Protegida)</option>
                  <option value="Urracas">Urracas (Pica pica)</option>
                </select>
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
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Precios de Opciones (€)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 text-center">Opción 1</label>
                    <input 
                      type="text" 
                      value={price1} 
                      onChange={(e) => handlePrice1Change(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 text-center">Opción 2</label>
                    <input 
                      type="text" 
                      value={price2} 
                      onChange={(e) => handlePrice2Change(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 text-center">Opción 3</label>
                    <input 
                      type="text" 
                      value={price3} 
                      onChange={(e) => handlePrice3Change(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#009FE3] transition-colors text-center font-mono"
                    />
                  </div>
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
