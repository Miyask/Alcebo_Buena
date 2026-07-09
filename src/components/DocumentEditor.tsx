import React, { useState, useEffect, useRef } from 'react';
import { Quote, Template, ConditionalText, SystemConfig } from '../types';
import { DEFAULT_CONDITIONAL_TEXTS, DEFAULT_TEMPLATES } from '../data/defaults';
import ImageAnnotator from './ImageAnnotator';
import { WORD_TEMPLATE_HTML } from '../data/wordTemplateHtml';
import { WATERMARK_BASE64 } from '../data/watermarkBase64';

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
  const [selectedSystem, setSelectedSystem] = useState<string>((quote.systems && quote.systems[0]) || 'Red');
  const [meters, setMeters] = useState<number>(quote.estimationLineal || 15);
  
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [customText, setCustomText] = useState<string>(quote.text || '');

  // Manual input fields that sync with document in real-time
  const [clientNameInput, setClientNameInput] = useState<string>(quote.clientName || 'COMUNIDAD DE VECINOS');
  const [clientAddressInput, setClientAddressInput] = useState<string>(quote.clientAddress || 'Calle Principal s/n');
  const [clientEmailInput, setClientEmailInput] = useState<string>(quote.clientEmail || '');

  useEffect(() => {
    setSelectedBird((quote.birds && quote.birds[0]) || 'Palomas');
    setSelectedSystem((quote.systems && quote.systems[0]) || 'Red');
    setMeters(quote.estimationLineal || 15);
    setCustomText(quote.text || '');
    setClientNameInput(quote.clientName || 'COMUNIDAD DE VECINOS');
    setClientAddressInput(quote.clientAddress || 'Calle Principal s/n');
    setClientEmailInput(quote.clientEmail || '');
  }, [quote]);
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
      setEditorHtml(quote.documentHtml);
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
      
      let initialHtml = WORD_TEMPLATE_HTML
        .replace(/\[REF_CODE\]/g, quote.id.startsWith('q-new') ? 'Ref-ALC-' + Math.floor(Math.random() * 90000 + 10000) : quote.id)
        .replace(/\[CLIENT_NAME\]/g, `<span class="client-name-field">${clientNameInput.toUpperCase()}</span>`)
        .replace(/\[CLIENT_ADDRESS\]/g, `<span class="client-address-field">${clientAddressInput}</span>`)
        .replace(/\[POSTAL_CODE\]/g, '28001')
        .replace(/\[POSTAL_CODE_PREFIX\]/g, '280')
        .replace(/\[ATT_NAME\]/g, 'Presidente de la Comunidad')
        .replace(/\[DAY\]/g, dayStr)
        .replace(/\[MONTH\]/g, monthStr)
        .replace(/\[YEAR\]/g, yearStr)
        .replace(/\[PLAGA\]/g, `${selectedBird}`)
        .replace(/\[ZONAS_AFECTADAS\]/g, selectedSystem === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas')
        .replace(/\[INTRO_TECNICA\]/g, quote.text ? `<span class="transcription-field">${quote.text}</span>` : 'las aves se posaban y anidaban activamente en las zonas elevadas, provocando acumulación de suciedad y daños estructurales')
        .replace(/\[PROBLEMA_PRINCIPAL\]/g, 'es la acumulación de excrementos ácidos con riesgo sanitario y degradación de los materiales de la fachada.')
        .replace(/\[DETALLE_ADICIONAL\]/g, 'las bajantes de agua pluvial estaban obstruidas por nidos y plumas')
        .replace(/\[ZONA_1\]/g, z1)
        .replace(/\[ZONA_2\]/g, z2)
        .replace(/\[ZONA_3\]/g, z3)
        .replace(/\[PRECIO_1\]/g, `<span class="price-field-1">${price1}</span>`)
        .replace(/\[PRECIO_2\]/g, `<span class="price-field-2">${price2}</span>`)
        .replace(/\[PRECIO_3\]/g, `<span class="price-field-3">${price3}</span>`)
        .replace(/\[TECNICO\]/g, 'Técnico Oficial Alcebo')
        .replace(/\[TELEFONO\]/g, '900 123 456');

      setEditorHtml(initialHtml);
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
        Fig: Plano de obra (${filename}). Pulsa "Dibujar" para hacer anotaciones.
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
      clientName: extractedClient || 'Comunidad Editada',
      clientAddress: clientAddressInput,
      clientEmail: clientEmailInput,
      estimationLineal: meters,
      totalCost: parseFloat((meters * 35).toFixed(2)),
      documentHtml: htmlContent,
      text: cleanText.substring(0, 1000)
    };
    
    onSaveQuote(updated);
    showToast('¡Presupuesto y plantilla guardados en el historial!');
    enviarAlSeguimiento(updated);
  };

  // Auto-fill from video transcription
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingVideo(true);
    setVideoProgress(15);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Uri = reader.result as string;
        setVideoProgress(40);

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Uri,
              name: file.name,
              apiKey: config?.groqApiKey,
            }),
          });

          setVideoProgress(85);

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || errData.details || 'Error al transcribir el archivo.');
          }

          const data = await response.json();

          setVideoProgress(100);
          
          // Auto-fill extraction logic
          const textLower = data.text.toLowerCase();

          // 1. Bird detection
          let detectedBird = 'Palomas';
          if (textLower.includes('paloma')) detectedBird = 'Palomas';
          else if (textLower.includes('golondrina')) detectedBird = 'Golondrinas';
          else if (textLower.includes('urraca')) detectedBird = 'Urracas';
          else if (textLower.includes('gaviota')) detectedBird = 'Gaviotas';
          else if (textLower.includes('gorrion') || textLower.includes('gorrión')) detectedBird = 'Gorriones';
          
          // 2. Systems detection
          let detectedSystem = 'Red';
          if (textLower.includes('red') || textLower.includes('malla')) detectedSystem = 'Red';
          else if (textLower.includes('varilla') || textLower.includes('pincho') || textLower.includes('púa')) {
            detectedSystem = 'Varillas';
          }

          // 3. Lineal meters extraction
          let detectedMeters = 15;
          const matchMeters = textLower.match(/(\d+)\s*(metros|metro|m\b)/);
          if (matchMeters && matchMeters[1]) {
            detectedMeters = parseInt(matchMeters[1], 10);
            setMeters(detectedMeters);
          }

          // 4. Client Name extraction
          let detectedClient = 'COMUNIDAD DE PROPIETARIOS';
          const matchClient = textLower.match(/(comunidad\s+(?:de\s+)?(?:propietarios\s+)?(?:de\s+)?[\w\sñáéíóúÁÉÍÓÚ]+?(?=\s+en\b|\s+calle\b|\s+nº\b|\s+\d+|\.|$))/i);
          if (matchClient && matchClient[0]) {
            detectedClient = matchClient[0].toUpperCase().trim();
          }

          // 5. Address extraction
          let detectedAddress = 'Calle Principal s/n';
          const matchAddress = textLower.match(/(?:calle|avda|avenida|plaza|c\/)\s+[\w\sñáéíóúÁÉÍÓÚ\d,]+/i);
          if (matchAddress && matchAddress[0]) {
            detectedAddress = matchAddress[0].trim();
          }
 
          setSelectedBird(detectedBird);
          setSelectedSystem(detectedSystem);
 
          // Re-initialize from template to ensure clean replacements
          const today = new Date();
          const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          
          const dayStr = today.getDate().toString().padStart(2, '0');
          const monthStr = monthNames[today.getMonth()];
          const yearStr = today.getFullYear().toString().substring(2);
          
          const z1 = detectedSystem === 'Red' ? 'Canalones y alféizares principales' : 'Cornisas principales de posado';
          const z2 = detectedSystem === 'Red' ? 'Huecos de ventilación del ático' : 'Zonas comunes y repisas de ventanas';
          const z3 = detectedSystem === 'Varillas' ? 'Cornisa superior trasera' : 'Zonas estructurales secundarias';
          
          const pcp = detectedAddress.match(/\b\d{5}\b/)?.[0] || '28001';
          const pcpPrefix = pcp.substring(0, 3) + '00';
          
          const p1 = (detectedMeters * 35 * 0.5).toFixed(2);
          const p2 = (detectedMeters * 35 * 0.2).toFixed(2);
          const p3 = (detectedMeters * 35).toFixed(2);
 
          // Update input states
          setClientNameInput(detectedClient);
          setClientAddressInput(detectedAddress);
          setPrice1(p1);
          setPrice2(p2);
          setPrice3(p3);
          
          let freshHtml = WORD_TEMPLATE_HTML
            .replace(/\[REF_CODE\]/g, quote.id.startsWith('q-new') ? 'Ref-ALC-' + Math.floor(Math.random() * 90000 + 10000) : quote.id)
            .replace(/\[CLIENT_NAME\]/g, `<span class="client-name-field">${detectedClient.toUpperCase()}</span>`)
            .replace(/\[CLIENT_ADDRESS\]/g, `<span class="client-address-field">${detectedAddress}</span>`)
            .replace(/\[POSTAL_CODE\]/g, pcp)
            .replace(/\[POSTAL_CODE_PREFIX\]/g, pcpPrefix)
            .replace(/\[ATT_NAME\]/g, 'Presidente / Administrador de Fincas')
            .replace(/\[DAY\]/g, dayStr)
            .replace(/\[MONTH\]/g, monthStr)
            .replace(/\[YEAR\]/g, yearStr)
            .replace(/\[PLAGA\]/g, detectedBird)
            .replace(/\[ZONAS_AFECTADAS\]/g, detectedSystem === 'Red' ? 'cornisas superiores y aleros' : 'líneas de fachada y repisas')
            .replace(/\[INTRO_TECNICA\]/g, `<span class="transcription-field">${data.text}</span>`)
            .replace(/\[PROBLEMA_PRINCIPAL\]/g, 'es la acumulación de excrementos y el con consiguiente deterioro estético e higiénico.')
            .replace(/\[DETALLE_ADICIONAL\]/g, 'se observaron nidos construidos y obstrucciones en los conductos.')
            .replace(/\[ZONA_1\]/g, z1)
            .replace(/\[ZONA_2\]/g, z2)
            .replace(/\[ZONA_3\]/g, z3)
            .replace(/\[PRECIO_1\]/g, `<span class="price-field-1">${p1}</span>`)
            .replace(/\[PRECIO_2\]/g, `<span class="price-field-2">${p2}</span>`)
            .replace(/\[PRECIO_3\]/g, `<span class="price-field-3">${p3}</span>`)
            .replace(/\[TECNICO\]/g, 'Técnico Oficial Alcebo')
            .replace(/\[TELEFONO\]/g, '900 123 456');
 
          if (editorRef.current) {
            editorRef.current.innerHTML = freshHtml;
          }
          setEditorHtml(freshHtml);
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
    } catch (error) {
      console.error('File reading failed:', error);
      setIsProcessingVideo(false);
    }
  };

  // Export high-fidelity DOCX using server-side html-to-docx converter
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
      totalCost: parseFloat((meters * 35).toFixed(2)),
    };
    
    enviarAlSeguimiento(currentQuote);
    
    try {
      const payload = {
        html: htmlContent,
        filename: `Presupuesto_${quote.clientName.replace(/\s+/g, '_') || 'Alcebo'}`
      };

      const response = await fetch('/api/export-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Fallo del compilador del servidor.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Presupuesto_${quote.clientName.replace(/\s+/g, '_') || 'Alcebo'}.docx`;
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
              className="p-2 px-3 rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer text-rose-600 border border-rose-200 flex items-center gap-1 text-xs font-bold"
              title="Empezar un nuevo presupuesto desde cero"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              Nuevo Presupuesto
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
              title="Subir vídeo o audio de inspección para auto-rellenar la plantilla"
            >
              <span className="material-symbols-outlined text-sm">cloud_upload</span>
              {isProcessingVideo ? `Procesando... ${videoProgress}%` : 'Subir Vídeo/Audio'}
            </button>

            <button
              onClick={handleSaveAndSync}
              className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Cambios
            </button>
            
            <button
              onClick={handleExportDocx}
              className="flex-1 sm:flex-initial bg-[#009FE3] hover:bg-[#006491] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#009fe3]/15 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Descargar Word (.docx)
            </button>

            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Imprimir
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

        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-[#009FE3]">info</span>
          Puedes escribir en cualquier párrafo del documento directamente.
        </div>
      </div>

      {/* Main Workspace layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Left Side: WYSIWYG contenteditable document container (Centered A4 paper wrapper) */}
        <div className="flex-1 w-full max-w-[850px] print-area">
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
                dangerouslySetInnerHTML={{ __html: editorHtml }}
              />
            </div>

            {/* Document footer */}
            <div className="border-t border-slate-100 pt-6 mt-12 text-center text-[10px] text-slate-400 font-medium z-10 relative">
              <p className="font-bold text-slate-800">ALCEBO CONTROL DE PLAGAS S.L.</p>
              <p className="mt-1">Servicio técnico nacional habilitado | Tel: 900 123 456 | Email: soporte@alcebo.com</p>
            </div>
          </div>
        </div>

        {/* Right Side: Configuration & Parameters panel */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
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
