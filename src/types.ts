export interface Quote {
  id: string;
  title: string;
  date: string;
  status: 'Borrador' | 'Enviado' | 'Aprobado' | 'Descartado';
  text: string; // Original transcript
  birds: string[];
  systems: string[];
  estimationLineal: number;
  totalCost: number;
  clientName: string;
  clientAddress: string;
  clientEmail?: string; // 📧 Añadido para la sincronización con el gestor de correos
  notes: string;
  documentHtml?: string; // Rich HTML editor content with embedded annotated images
  images?: { id: string; url: string; originalName: string; caption: string; }[];
  introTecnica?: string;
  problemaPrincipal?: string;
  detalleAdicional?: string;
  refCode?: string;
  price1?: string;
  price2?: string;
  price3?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  systems: string[];
  basePricePerMeter: number;
  introText: string;
  footerText: string;
}

export interface ConditionalText {
  id: string;
  title: string;
  birdType?: string;
  systemType?: string;
  condition: string;
  textToInclude: string;
  isActive: boolean;
}

export interface SystemConfig {
  groqApiKey: string;
  llmApiKey: string;
  baseUrl: string;
  isWhisperActive: boolean;
}
