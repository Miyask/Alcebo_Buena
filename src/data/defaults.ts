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
    textToInclude: 'La paloma bravía (Columba livia) es la especie de paloma más extendida en el mundo y el ancestro de las variantes domésticas. Mide 33 cm, con una envergadura de 60-70 cm y un peso de 240-380 g. Su plumaje es gris con bandas negras en las alas y reflejos iridiscentes en la cabeza. No es migratoria y su canto es un arrullo corto y fuerte. Se reproduce todo el año, con picos en primavera y verano. Incuba 1-2 huevos durante 16-19 días, y los pichones vuelan a los 35 días. Habita en zonas rocosas, pero su adaptación la ha llevado a entornos urbanos, anidando en edificios, monumentos, parques y almacenes, donde encuentra fácil acceso a alimento. Esta especie es escasa en ambientes naturales, ha logrado establecerse con éxito en ciudades de todo el mundo, donde frecuentemente se le considera una plaga.',
    isActive: true
  },
  {
    id: 'rule-gaviotas',
    title: 'Exclusión de Gaviotas (Laridae)',
    birdType: 'Gaviotas',
    condition: 'Ave = Gaviotas',
    textToInclude: 'Las gaviotas (Laridae) son en general pájaros grandes, en su mayoría de plumaje gris o blanco, a menudo con señales negras en la cabeza o las alas. Las gaviotas adultas tienen la cabeza, el cuello, la cola y la parte inferior del cuerpo de un color blanco puro, mientras que la espalda y el dorso de las alas son de color gris pálido. Son típicamente costeras pero han colonizado poblaciones del interior siguiendo los ríos y atraídas por los vertederos. Su variada alimentación incluye todo tipo de animales marinos, pequeños pájaros, ratas, huevos y desperdicios del hombre. Se emparejan para toda la vida y suelen anidar cada año en el mismo lugar de forma muy gregaria, mostrando gran agresividad protectora.',
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
    textToInclude: 'El gorrión común (Passer domesticus) es un ave pequeña, adaptada al hábitat urbano y muy acostumbrada a vivir cerca del ser humano, hasta el punto de ser la más frecuente y conocida. Pesa alrededor de 30 g y mide de 14 a 16 cm de longitud. El gorrión doméstico es de conformación robusta y patas cortas. Su pico es grueso, fuerte y cónico. El plumaje de la espalda es pardo, con manchas negras y rojizas. Anidan en grietas de edificios, debajo de tejas o en troncos de coníferas. Los huevos son puestos en cualquier momento durante la primavera, pudiendo haber hasta 4 puestas, y en cada puesta 4 o 5 huevos. A los 10 días los polluelos rompen el cascarón, y a los 14 ya tienen plumas.',
    isActive: true
  },
  {
    id: 'rule-cotorras',
    title: 'Control de Cotorras (Myiopsitta monachus)',
    birdType: 'Cotorras',
    condition: 'Ave = Cotorras',
    textToInclude: 'Las cotorras en nuestro país corresponden principalmente a la Cotorra de Kramer (Psittacula krameri) y la Cotorra Argentina o Monje (Myiopsitta monachus), consideradas especies exóticas invasoras. La de Kramer es arborícola, de color verde-amarillento, cola muy larga y pico rojo ganchudo. La Argentina construye nidos coloniales comunales de ramas adosados que pueden llegar a pesar más de 100 kg, comprometiendo la seguridad estructural de árboles y postes. Se alimentan de gran variedad de frutos y semillas, alterando los ecosistemas locales y desplazando a las especies autóctonas.',
    isActive: true
  },
  {
    id: 'rule-cigueñas',
    title: 'Control de Cigüeñas (Ciconia ciconia)',
    birdType: 'Cigüeñas',
    condition: 'Ave = Cigüeñas',
    textToInclude: 'La cigüeña blanca (Ciconia ciconia) es una especie de ave Ciconiiforme de gran tamaño. Su plumaje es mayoritariamente blanco con negro en las alas. Los adultos adquieren un color rojo en patas y pico. Mide de 100 a 115 cm desde la punta del pico hasta el final de la cola, con una envergadura alar de 155 a 215 cm. Es un ave migratoria de grandes distancias que se empareja para toda la vida. Construyen nidos de gran tamaño que reutilizan y amplían año tras año, lo que puede causar graves problemas de sobrepeso en chimeneas y cubiertas. Diversos cambios agrícolas hicieron declinar su población en los siglos XIX y XX, por lo que se la considera un ave protegida.',
    isActive: true
  }
];

export const DEFAULT_QUOTES: Quote[] = [];
