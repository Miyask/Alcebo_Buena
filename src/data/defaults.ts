import { Quote, Template, ConditionalText, SystemConfig } from '../types';

export const DEFAULT_CONFIG: SystemConfig = {
  groqApiKey: import.meta.env.VITE_GROQ_API_KEY || '',
  baseUrl: 'https://api.groq.com/openai/v1',
  isWhisperActive: true,
};

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'temp-red',
    name: 'Plantilla Red Network',
    description: 'Protección perimetral mediante red de polietileno de alta densidad (U.V.) contra palomas y otras aves.',
    systems: ['Red'],
    basePricePerMeter: 35.00,
    introText: 'Dadas las características de las instalaciones de su propiedad y las zonas de posado, refugio y anidación identificadas, se propone la protección mediante sistema de Red Network Alcebo. Este sistema está diseñado para impedir de forma permanente el acceso de las aves a balcones, fachadas y patios de luces.',
    footerText: 'Garantía oficial de Alcebo de 5 años en todos los materiales y 2 años en mano de obra. Instalación por técnicos especialistas en trabajos verticales con formación en altura.'
  },
  {
    id: 'temp-varillas',
    name: 'Plantilla Varillas Inoxidables',
    description: 'Sistema mecánico disuasorio mediante varillas inoxidables Avipoint en cornisas y repisas.',
    systems: ['Varillas'],
    basePricePerMeter: 18.50,
    introText: 'Detallamos la propuesta disuasoria mediante sistema de varillas inoxidables Avipoint. Consiste en alambre de acero inoxidable 302 de 1,4 mm de diámetro embutido en una base de policarbonato estabilizado contra rayos U.V., con puntas romas que no dañan a las aves pero impiden físicamente su posado en repisas, cornisas y molduras.',
    footerText: 'Garantía de 5 años contra la corrosión de las púas metálicas. Montaje realizado con polímeros adhesivos selladores de alta resistencia para exteriores.'
  },
  {
    id: 'temp-electrico',
    name: 'Plantilla Sistema Eléctrico',
    description: 'Sistema de exclusión discreto mediante impulsos electroestáticos de baja frecuencia.',
    systems: ['Eléctrico'],
    basePricePerMeter: 45.00,
    introText: 'Proponemos la protección mediante el sistema electroestático disuasorio perimetral Alcebo. Es una solución de alta discreción visual, ideal para edificios catalogados o zonas de alto valor estético, que emite pulsos de baja frecuencia no dañinos para disuadir a las aves permanentemente.',
    footerText: 'Garantía de 3 años en el generador de impulsos y 5 años en la línea perimetral de conductores.'
  },
  {
    id: 'temp-capturas',
    name: 'Plantilla Jaulas de Captura',
    description: 'Jaulas trampa homologadas para la reducción poblacional selectiva y controlada.',
    systems: ['Capturas'],
    basePricePerMeter: 25.00,
    introText: 'Se detalla el plan de capturas selectivas Alcebo. Consiste en la instalación de jaulas trampa homologadas con comederos y bebederos en zonas de azotea o almacenes para reducir de manera rápida y controlada el censo de aves plaga.',
    footerText: 'El servicio incluye visitas periódicas de control, cebado, retirada de aves de forma humanitaria y cumplimiento de la normativa autonómica de sanidad y protección animal.'
  }
];

export const DEFAULT_CONDITIONAL_TEXTS: ConditionalText[] = [
  {
    id: 'rule-palomas',
    title: 'Exclusión de Palomas (Columba livia)',
    birdType: 'Palomas',
    condition: 'Ave = Palomas',
    textToInclude: 'La Paloma Bravía (Columba livia) es una especie sedentaria altamente proliferativa en entornos urbanos. Su presencia conlleva riesgos sanitarios al ser vectores de patógenos y ácaros, así como daños estructurales graves derivados de la acumulación de guano, cuya acidez corroe piedra y metales. Se prescribe la limpieza y desinfección previa de las zonas de anidación, seguido de la instalación de redes de exclusión o varillas disuasorias para asegurar un sellado permanente.',
    isActive: true
  },
  {
    id: 'rule-gaviotas',
    title: 'Exclusión de Gaviotas (Laridae)',
    birdType: 'Gaviotas',
    condition: 'Ave = Gaviotas',
    textToInclude: 'Las Gaviotas (Laridae) ejercen una presión de posado y anidación muy alta en cubiertas planas. Son aves corpulentas y territoriales que pueden mostrarse agresivas durante la época de cría. Su deyección es de gran volumen y obstruye canalones de pluviales. Se prescribe el uso de redes reforzadas con tensores especiales o sistemas de cables tensados gruesos para evitar su nidificación sobre azoteas.',
    isActive: true
  },
  {
    id: 'rule-urracas',
    title: 'Exclusión de Urracas (Pica pica)',
    birdType: 'Urracas',
    condition: 'Ave = Urracas',
    textToInclude: 'La Urraca (Pica pica) destaca por su comportamiento oportunista y gregarismo en jardines o fachadas. Su gran tamaño e inteligencia les permite evadir sistemas de disuasión simples. Producen ruidos molestos a primeras horas. Se propone el uso de redes de malla estrecha o varillas Avipoint en molduras de descanso.',
    isActive: true
  },
  {
    id: 'rule-golondrinas',
    title: 'Protección de Golondrinas (Hirundo rustica)',
    birdType: 'Golondrinas',
    condition: 'Ave = Golondrinas',
    textToInclude: 'La Golondrina común (Hirundo rustica) y el Avión común son aves insectívoras migratorias cuyos nidos de barro se adhieren bajo aleros de fachadas. Al ser especies protegidas por ley, toda acción de limpieza o colocación de barreras (redes finas o varillas anti-nido) debe ejecutarse de forma estricta fuera de su temporada de cría y nidificación (septiembre a febrero) para evitar multas.',
    isActive: true
  },
  {
    id: 'rule-gorriones',
    title: 'Exclusión de Gorriones (Passer domesticus)',
    birdType: 'Gorriones',
    condition: 'Ave = Gorriones',
    textToInclude: 'El Gorrión común (Passer domesticus) anida típicamente en huecos pequeños de tejas y fachadas. Provoca taponamiento de salidas de ventilación y acumulación de materiales altamente inflamables. Se prescribe el sellado perimetral de aleros mediante mallas electrosoldadas de luz fina o red de 19mm para bloquear el acceso de especímenes pequeños.',
    isActive: true
  },
  {
    id: 'rule-cotorras',
    title: 'Control de Cotorras (Myiopsitta monachus)',
    birdType: 'Cotorras',
    condition: 'Ave = Cotorras',
    textToInclude: 'La Cotorra Argentina y cotorra de Kramer son consideradas especies exóticas invasoras. Construyen grandes nidos coloniales de ramas que pueden llegar a pesar más de 100 kg, comprometiendo la seguridad de ramas y estructuras de soporte. Se prescribe la retirada autorizada de nidos en periodo invernal y control poblacional mediante trampeo selectivo.',
    isActive: true
  },
  {
    id: 'rule-cigueñas',
    title: 'Control de Cigüeñas (Ciconia ciconia)',
    birdType: 'Cigüeñas',
    condition: 'Ave = Cigüeñas',
    textToInclude: 'La Cigüeña Blanca (Ciconia ciconia) es un ave protegida de gran tamaño que reutiliza sus nidos año tras año en chimeneas y tejados, acumulando ramas hasta provocar sobrepeso estructural y atasco de humos. Toda actuación requiere autorización administrativa previa para el desmontaje del nido fuera del periodo de cría, seguido de la instalación perimetral de dispositivos mecánicos disuasorios (pirámides o paraguas anti-cigüeña).',
    isActive: true
  }
];

export const DEFAULT_QUOTES: Quote[] = [];
