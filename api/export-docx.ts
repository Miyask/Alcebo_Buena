import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { html, filename } = req.body;
    if (!html) {
      return res.status(400).json({ error: 'No se recibió contenido HTML.' });
    }

    // 1. Extract variables from HTML spans
    const extractSpan = (className: string, defaultValue: string = ''): string => {
      const regex = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/span>`, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].replace(/<[^>]+>/g, '').trim();
      }
      return defaultValue;
    };

    const refCode = extractSpan('ref-code-field', 'Ref-@@@@@@@@@@@');
    const clientName = extractSpan('client-name-field', '@@@@@@@@');
    const clientAddress = extractSpan('client-address-field', '@@@@@@@@');
    const postalCode = extractSpan('postal-code-field', '@@@@');
    const postalCodePrefix = extractSpan('postal-code-prefix-field', '@@');
    const attName = extractSpan('att-name-field', '@@@@@@@@');
    const day = extractSpan('day-field', '@@');
    const month = extractSpan('month-field', '@@@@@');
    const year = extractSpan('year-field', '@@');
    const plaga = extractSpan('plaga-field', '@@@@');
    const zonasAfectadas = extractSpan('zonas-afectadas-field', '@@@@@@@@ y @@@@@@@@');
    
    // Technical observations
    const introTecnica = extractSpan('transcription-field', '');
    const problemaPrincipal = extractSpan('problema-principal-field', '@@@@@@@@');
    const detalleAdicional = extractSpan('detalle-adicional-field', '@@@@@@@@');
    
    // Protection zones
    const zona1 = extractSpan('zona-1-field', '@@@@@@@@');
    const zona2 = extractSpan('zona-2-field', '@@@@@@@@');
    const zona3 = extractSpan('zona-3-field', '@@@@@@@@');
    
    // Prices
    const price1 = extractSpan('price-field-1', '@@@@@');
    const price2 = extractSpan('price-field-2', '@@@@@');
    const price3 = extractSpan('price-field-3', '@@@@@');
    
    // Tech & contact
    const tecnico = extractSpan('tecnico-field', '@@@@@@@@@@@');
    const telefono = extractSpan('telefono-field', '@@@@@@@@');

    // 2. Extract base64 images from HTML img tags
    const images: Record<string, string> = {};
    
    // Map by data-img-id first
    const imgRegex = /<img[^>]+src="data:image\/(jpeg|png);base64,([^"]+)"[^>]*data-img-id="([^"]+)"/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      images[match[3]] = match[2];
    }
    
    // Fallback: Map by order of appearance
    const imgRawRegex = /<img[^>]+src="data:image\/(jpeg|png);base64,([^"]+)"/gi;
    let idx = 0;
    let matchRaw;
    while ((matchRaw = imgRawRegex.exec(html)) !== null) {
      idx++;
      const base64 = matchRaw[2];
      const imgId = `img_template_${idx}`;
      if (!images[imgId]) {
        images[imgId] = base64;
      }
    }

    // 3. Load native Word template file Ppo-mail-2022.docx
    const templatePath = path.join(process.cwd(), 'Ppo-mail-2022.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ error: 'La plantilla Ppo-mail-2022.docx no se encuentra en el servidor.' });
    }
    const templateContent = fs.readFileSync(templatePath);
    const zip = new PizZip(templateContent);
    let docXml = zip.file('word/document.xml').asText();

    // 4. Modify XML text placeholders in word/document.xml
    // Match 1: Reference code on cover page
    docXml = docXml.replace('w:t>@@@@@@@@</w:t>', `w:t>${refCode}</w:t>`);
    
    // Match 2: Client name on cover page
    docXml = docXml.replace('Com. Prop. @@@@@@@@', `Com. Prop. ${clientName}`);
    
    // Match 3: Client address on cover page
    docXml = docXml.replace('C/ @@@@@@@@', `C/ ${clientAddress}`);
    
    // Match 4: Postal code on cover page
    docXml = docXml.replace('28 @@@@   Madrid', `28${postalCode}   Madrid`);
    
    // Match 5: Attention name on cover page
    docXml = docXml.replace('D. @@@@@@@@', `D. ${attName}`);
    
    // Match 6, 7, 8: Date on cover page (@@ of @@@@@ of 20@@)
    docXml = docXml.replace('w:t>@@</w:t>', `w:t>${day}</w:t>`);
    docXml = docXml.replace('w:t>@@@@@</w:t>', `w:t>${month}</w:t>`);
    docXml = docXml.replace('w:t>@@</w:t>', `w:t>${year}</w:t>`);
    
    // Match 9: Client address in Section 5
    docXml = docXml.replace('en C/ @@@@@@@@, en Madrid', `en C/ ${clientAddress}, en Madrid`);
    
    // Match 10: Bird count
    docXml = docXml.replace('@@@@palomas', `${plaga} ${plaga.toLowerCase().includes('paloma') ? '' : 'palomas'}`);
    
    // Match 11: Affected areas
    docXml = docXml.replace('@@@@@@@@ y @@@@@@@@', zonasAfectadas);
    
    // Match 12: Technical description
    const lines = introTecnica.split('\n').filter(l => l.trim().length > 0);
    let introXml = '';
    if (lines.length > 0) {
      introXml = lines.join('</w:t></w:r></w:p><w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr><w:t>');
    } else {
      introXml = 'se observó presencia activa de aves en la edificación';
    }
    docXml = docXml.replace('Durante la visita pudimos comprobar cómo @@@@@@@@.', `Durante la visita pudimos comprobar cómo ${introXml}.`);
    
    // Match 13: Main problem
    docXml = docXml.replace('El problema principal @@@@@@@@', `El problema principal ${problemaPrincipal}`);
    
    // Match 14: Additional details
    docXml = docXml.replace('Además, también pudimos comprobar que @@@@@@@@', `Además, también pudimos comprobar que ${detalleAdicional}`);
    
    // Match 15, 16, 17: Protection zones
    docXml = docXml.replace('Protección de @@@@@@@@', `Protección de ${zona1}`);
    docXml = docXml.replace('Protección de @@@@@@@@', `Protección de ${zona2}`);
    docXml = docXml.replace('w:t>Protección de @@@@@@@@</w:t>', `w:t>Protección de ${zona3}</w:t>`);
    
    // Match 18: Telephone
    docXml = docXml.replace('TlfMv @@@@@@@@', `TlfMv ${telefono}`);
    
    // Match 19: Postal code in Section 6
    docXml = docXml.replace('280@@', `280${postalCodePrefix}`);
    
    // Match 20: Reference code in Section 6
    docXml = docXml.replace('Ref-@@@@@@@@@@@', `Ref-${refCode}`);
    
    // Match 21, 22, 23: Prices
    docXml = docXml.replace('................ @@@@@', `................ ${price1}`);
    docXml = docXml.replace('........ @@@@@', `........ ${price2}`);
    docXml = docXml.replace('w:t>@@@@</w:t>', `w:t>${price3}</w:t>`);
    
    // Match 24: Technical Commercial Name
    docXml = docXml.replace('Técnico Comercial: @@@@@@@@@@@', `Técnico Comercial: ${tecnico}`);
    
    // Match 25: Client address in Section 6 header
    docXml = docXml.replace('6.- PRESUPUESTO Y GARANTÍAS  C/ @@@@@@@@', `6.- PRESUPUESTO Y GARANTÍAS  C/ ${clientAddress}`);

    // 5. Overwrite/replace images in ZIP package
    if (images['img_template_2']) {
      zip.file('word/media/image2.jpeg', Buffer.from(images['img_template_2'], 'base64'), { binary: true });
    }
    if (images['img_template_3']) {
      zip.file('word/media/image3.jpeg', Buffer.from(images['img_template_3'], 'base64'), { binary: true });
    }
    if (images['img_template_4']) {
      zip.file('word/media/image4.jpeg', Buffer.from(images['img_template_4'], 'base64'), { binary: true });
    }

    // 6. Delete unused images from word/document.xml if they were removed in the editor
    if (!html.includes('data-img-id="img_template_2"') && !html.includes('Foto_Inspeccion_1.jpg')) {
      const pRegex = /<w:p[^>]*>[\s\S]*?r:embed="rId11"[\s\S]*?<\/w:p>/g;
      docXml = docXml.replace(pRegex, '');
    }
    if (!html.includes('data-img-id="img_template_3"') && !html.includes('Foto_Inspeccion_2.jpg')) {
      const pRegex = /<w:p[^>]*>[\s\S]*?r:embed="rId12"[\s\S]*?<\/w:p>/g;
      docXml = docXml.replace(pRegex, '');
    }
    if (!html.includes('data-img-id="img_template_4"') && !html.includes('Propuesta_Tecnica.jpg')) {
      const pRegex = /<w:p[^>]*>[\s\S]*?r:embed="rId14"[\s\S]*?<\/w:p>/g;
      docXml = docXml.replace(pRegex, '');
    }

    // 7. Write modified XML back into zip
    zip.file('word/document.xml', docXml);

    // 8. Generate DOCX file buffer and send response
    const fileBuffer = zip.generate({ type: 'nodebuffer' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'Presupuesto'}.docx"`);
    return res.status(200).send(fileBuffer);

  } catch (error: any) {
    console.error('Error al generar el documento Word desde la plantilla:', error);
    return res.status(500).json({ error: 'Error al rellenar la plantilla Word.', details: error.message });
  }
}
