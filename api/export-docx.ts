import type { VercelRequest, VercelResponse } from '@vercel/node';
import htmlToDocx from 'html-to-docx';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { html, filename } = req.body;
    if (!html) {
      return res.status(400).json({ error: 'No se recibió contenido HTML.' });
    }

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
    return res.status(200).send(fileBuffer);
  } catch (error: any) {
    console.error('Error al generar el documento Word desde HTML:', error);
    return res.status(500).json({ error: 'Error al compilar el documento Word.', details: error.message });
  }
}
