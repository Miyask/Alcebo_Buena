import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, name, apiKey, llmApiKey } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo de audio o vídeo.' });
    }

    // Check for valid base64 pattern
    const base64Parts = file.match(/^data:(.+);base64,(.+)$/);
    if (!base64Parts) {
      return res.status(400).json({ error: 'Formato de archivo inválido. Se esperaba una URI base64.' });
    }

    const mimeType = base64Parts[1];
    const base64Data = base64Parts[2];

    // Determine which API provider to use based on key prefix
    let isGroq = true;
    let finalApiKey = process.env.GROQ_API_KEY || '';

    if (apiKey && apiKey.trim().startsWith('gsk_')) {
      isGroq = true;
      finalApiKey = apiKey.trim();
    } else if (apiKey && apiKey.trim().startsWith('sk-or-v1-')) {
      isGroq = false;
      finalApiKey = apiKey.trim();
    } else if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().startsWith('gsk_')) {
      isGroq = true;
      finalApiKey = process.env.GROQ_API_KEY.trim();
    } else if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().startsWith('sk-or-v1-')) {
      isGroq = false;
      finalApiKey = process.env.OPENROUTER_API_KEY.trim();
    }

    console.log(`Transcribiendo archivo usando proveedor: ${isGroq ? 'Groq' : 'OpenRouter'}`);

    let transcriptionText = '';

    if (isGroq) {
      // Groq API transcription call
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, name || 'audio.wav');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'es');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${finalApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq Whisper API response error:', errorText);
        return res.status(response.status).json({ 
          error: `Error de la API de Groq: ${response.statusText}`, 
          details: errorText 
        });
      }

      const data = await response.json();
      transcriptionText = data.text;
      console.log('Transcripción con Groq completada con éxito.');
    } else {
      // OpenRouter transcription call
      const mimeToFormat: Record<string, string> = {
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/flac': 'flac',
        'audio/aac': 'aac',
        'audio/m4a': 'm4a',
        'audio/mp4': 'mp4',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
      };
      
      let format = 'wav';
      if (mimeType && mimeToFormat[mimeType]) {
        format = mimeToFormat[mimeType];
      } else if (name) {
        const ext = name.split('.').pop()?.toLowerCase();
        if (ext && ['wav', 'mp3', 'flac', 'm4a', 'ogg', 'webm', 'aac', 'mp4'].includes(ext)) {
          format = ext;
        }
      }

      let success = false;
      try {
        console.log(`Intentando Whisper en OpenRouter con formato: ${format}`);
        const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${finalApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/whisper-1',
            input_audio: {
              data: base64Data,
              format: format
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          transcriptionText = data.text;
          success = true;
          console.log('Transcripción exitosa con Whisper.');
        } else {
          const errText = await response.text();
          console.warn(`Whisper falló con código ${response.status}:`, errText);
        }
      } catch (err) {
        console.error('Error durante la llamada a Whisper:', err);
      }

      if (!success) {
        return res.status(402).json({
          error: 'Error de la API de OpenRouter: Payment Required / Sin Créditos.',
          details: 'Tu clave de OpenRouter requiere saldo. Añade saldo en openrouter.ai o introduce una clave de API de Groq (100% gratuita) en la pestaña Ajustes.'
        });
      }
    }

    // Call LLM to parse transcription professionally
    let aiParsed = null;
    try {
      console.log('Parsing transcription text with LLM...');
      const prompt = `Analiza la siguiente transcripción de una visita técnica para control de aves y extrae la información en un objeto JSON con el siguiente formato estricto. No incluyas explicaciones ni formato markdown (como backticks o la palabra json), devuelve únicamente un objeto JSON válido.

JSON keys:
- "detectedBird": Debe ser uno de los siguientes valores exactos en español: "Palomas", "Gorriones", "Cigüeñas", "Gaviotas", "Cotorras", "Golondrinas", "Avión Común".
- "detectedSystems": Array de strings que contengan los sistemas de control propuestos. Valores válidos: "Red", "Varillas", "Eléctrico", "Capturas".
- "clientName": Nombre formal de la comunidad de propietarios en MAYÚSCULAS, ej. "COMUNIDAD DE PROPIETARIOS PRINCESA 28".
- "clientAddress": Dirección de la obra limpia, ej. "Calle de la Princesa 28, Madrid".
- "postalCode": Código postal de 5 dígitos si se menciona, ej. "28008".
- "meters": Metros lineales o cantidad numérica estimada que se mencione (número entero).
- "introTecnica": Resumen técnico profesional descriptivo y amplio (de 2 a 4 líneas de longitud), redactado en tercera persona del plural ("pudimos comprobar cómo..."). IMPORTANTE: Debes REESCRIBIR y RESUMIR en detalle la descripción coloquial del técnico. Explica las zonas observadas (como tejados, aleros, canalones o antenas) y los rastros de las aves. Elimina muletillas, repeticiones, fechas de la visita y direcciones. El texto resultante debe ser formal, técnico, detallado y fluido al concatenarse con "Durante la visita realizada pudimos comprobar cómo...". Ejemplo: "las aves se posan de manera recurrente en todo el borde del tejado de pizarra y en la antena del edificio contiguo, acumulando gran cantidad de excrementos en los bordes y terrazas inferiores, lo que degrada la salubridad y la estética de la fachada".
- "problemaPrincipal": Resumen profesional detallado y completo (de 2 a 3 líneas de longitud), redactado en tercera persona del singular. IMPORTANTE: Debes REESCRIBIR de forma técnica el problema central. Explica la causa raíz (ej. que bajan a beber agua a la piscina o que anidan en huecos) y las consecuencias. El texto resultante debe fluir perfectamente al concatenarse con "El problema principal...". Ejemplo: "radica en que las aves descienden constantemente a la zona de la piscina para beber agua, lo que provoca la acumulación de excrementos ácidos en las terrazas verticales de los propietarios, requiriendo tareas de barrido y limpieza diarias".
- "detalleAdicional": Resumen profesional amplio e informativo (de 2 a 3 líneas de longitud), detallando los accesos y las soluciones específicas propuestas en la inspección (como protección con red, instalación de varillas en focos rectangulares, o ausencia de nidos en huecos cerrados). Ejemplo: "se propone la instalación de varillas de acero inoxidable en los dos focos rectangulares de la terraza donde se posan las aves, junto con la instalación de una red antipalomas perimetral que proteja la zona de la piscina para evitar el acceso al agua".
- "price1": Precio de la primera opción de presupuesto formateado (ej. "450 €").
- "price2": Precio de la segunda opción o lote completo de presupuesto formateado (ej. "1.090 €").
- "price3": Precio total sugerido o de la opción elegida formateado (ej. "1.090 €").
- "refCode": Código de referencia del presupuesto si se menciona (ej. "Ref-ALC-L-2026-0-589").

Transcripción:
"${transcriptionText}"`;

      const finalLlmKey = (llmApiKey && llmApiKey.trim()) || finalApiKey;
      const isLlmGroq = finalLlmKey.startsWith('gsk_');

      let llmUrl = '';
      let headers: Record<string, string> = {};
      let body: any = {};

      if (isLlmGroq) {
        llmUrl = 'https://api.groq.com/openai/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${finalLlmKey}`,
          'Content-Type': 'application/json'
        };
        body = {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        };
      } else {
        llmUrl = 'https://openrouter.ai/api/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${finalLlmKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://alcebo-technical-quotes.vercel.app',
          'X-Title': 'Alcebo Quotes'
        };
        body = {
          model: 'meta-llama/llama-3.3-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        };
      }

      const llmResponse = await fetch(llmUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        const rawJsonText = llmData.choices[0].message.content.trim();
        aiParsed = JSON.parse(rawJsonText);
        console.log('Successfully parsed transcription with LLM:', aiParsed);
      } else {
        const errText = await llmResponse.text();
        console.error('LLM API call failed:', errText);
      }
    } catch (err) {
      console.error('Error parsing transcription with LLM:', err);
    }

    return res.status(200).json({ text: transcriptionText, aiParsed });

  } catch (error: any) {
    console.error('Error durante la transcripción de audio:', error);
    return res.status(500).json({ 
      error: 'Error interno al procesar el audio.', 
      details: error.message 
    });
  }
}
