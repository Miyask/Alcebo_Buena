import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import PizZip from 'pizzip';
import htmlToDocx from 'html-to-docx';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON parsing with a generous size limit for handling base64 audio/video uploads
  app.use(express.json({ limit: '100mb' }));

  // API Routes MUST go before Vite middleware
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Secure OpenRouter transcription proxy endpoint
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { file, name, apiKey } = req.body;

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

      if (isGroq) {
        // Groq API transcription call (100% Free)
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
        console.log('Transcripción con Groq completada con éxito.');
        return res.json({ text: data.text });
      }

      // Map mime type to format supported by OpenRouter
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

      let transcriptionText = '';
      let success = false;

      // Try standard paid Whisper model on OpenRouter
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

      // If Whisper fails (e.g. 402 Payment Required) and it is not Groq, return the error
      if (!success) {
        return res.status(402).json({
          error: 'Error de la API de OpenRouter: Payment Required / Sin Créditos.',
          details: 'Tu clave de OpenRouter requiere saldo. Añade saldo en openrouter.ai o introduce una clave de API de Groq (100% gratuita) en la pestaña Ajustes.'
        });
      }

      return res.json({ text: transcriptionText });

    } catch (error: any) {
      console.error('Error durante la transcripción de audio:', error);
      return res.status(500).json({ 
        error: 'Error interno al procesar el audio.', 
        details: error.message 
      });
    }
  });

  // Word Document high-fidelity template exporter using HTML-to-docx
  app.post('/api/export-docx', async (req, res) => {
    try {
      const { html, filename } = req.body;
      if (!html) {
        return res.status(400).json({ error: 'No se recibió contenido HTML.' });
      }

      // Add high-fidelity styled page wrapper to the HTML for conversion
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
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
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12pt;
              margin-bottom: 12pt;
            }
            th, td {
              border: 1px solid #bec8d2;
              padding: 6pt;
              font-size: 10pt;
            }
            th {
              background-color: #009FE3;
              color: #ffffff;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;

      // Read extracted watermark image from template directory to use as repeating background watermark
      const watermarkPath = path.join(process.cwd(), 'src', 'assets', 'template', 'image1.jpeg');
      let headerHtml = '';
      if (fs.existsSync(watermarkPath)) {
        const base64Watermark = fs.readFileSync(watermarkPath, 'base64');
        headerHtml = `
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1000; opacity: 0.08; text-align: center;">
            <img src="data:image/jpeg;base64,${base64Watermark}" style="width: 550px; margin-top: 250px;" />
          </div>
        `;
      }

      const fileBuffer = await htmlToDocx(fullHtml, headerHtml, {
        table: { row: { cantSplit: true } },
        footer: true,
        header: true,
        pageNumber: true,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || 'Presupuesto'}.docx"`);
      return res.send(fileBuffer);

    } catch (error: any) {
      console.error('Error al generar el documento Word desde HTML:', error);
      return res.status(500).json({ error: 'Error al compilar el documento Word.', details: error.message });
    }
  });

  // Vite development or static files serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ALCEBO SERVER] Escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ALCEBO SERVER] Error fatal al iniciar el servidor:', err);
});
