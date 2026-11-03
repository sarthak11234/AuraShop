// Seed catalogue — the canonical demo data used by `prisma/seed.ts`.
// Kept outside src/ so the application itself never imports static products;
// the runtime catalogue is read from the database (see src/lib/products.ts).

export interface SeedVariant {
  size: string;
  stock: number;
}

export interface SeedProduct {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  priceRaw: number;
  category: string;
  categoryCode: string;
  description: string;
  details: string[];
  variants: SeedVariant[];
  images: string[]; // image URLs or colour swatches
  version: string;
  isNew?: boolean;
  inStock?: boolean;
}

const apparelSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const trouserSizes = ['28', '30', '32', '34', '36', '38'];
const bootSizes = ['6', '7', '8', '9', '10', '11', '12'];
const zeroStockVariants = (sizes: readonly string[]): SeedVariant[] =>
  sizes.map((size) => ({ size, stock: 0 }));

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: '01',
    slug: 'core-shell',
    title: 'CORE_SHELL',
    subtitle: 'Neural Exoskeleton Jacket',
    priceRaw: 840,
    category: 'OUTERWEAR',
    categoryCode: 'N.01',
    description:
      'The CORE_SHELL is engineered for the interface between organic and digital. Eight adaptive pressure zones respond in real-time to biometric data, shifting structural tension to maximise range of motion.',
    details: [
      'Graphene-reinforced shell membrane',
      'Adaptive pressure zone matrix (8-point)',
      'Embedded NFC-ready data port',
      'Thermal regulation layer — range: −20°C to 45°C',
      'Machine washable at 30°C',
    ],
    variants: [
      { size: 'XS', stock: 12 },
      { size: 'S', stock: 20 },
      { size: 'M', stock: 25 },
      { size: 'L', stock: 25 },
      { size: 'XL', stock: 14 },
      { size: 'XXL', stock: 6 },
    ],
    images: [
      '/images/products/core-shell.webp',
      '/images/products/core-shell-side-01.jpg',
      '/images/products/core-shell-side-02.jpg',
    ],
    version: 'v.2.5',
    isNew: true,
  },
  {
    id: '02',
    slug: 'neural-unit',
    title: 'NEURAL_UNIT',
    subtitle: 'Cognitive Interface Headset',
    priceRaw: 1200,
    category: 'TECH',
    categoryCode: 'T.02',
    description:
      'The NEURAL_UNIT bridges the gap between thought and action. Ultra-thin electrode mesh reads surface EEG signals, translating intent into device commands with sub-50ms latency.',
    details: [
      '128-channel EEG electrode mesh',
      'Bluetooth 5.3 LE & USB-C connectivity',
      '12-hour continuous operational battery',
      'Open-source SDK for third-party integration',
      'Titanium-alloy frame, under 180g',
    ],
    variants: [
      { size: 'ONE SIZE', stock: 30 },
      { size: 'COMPACT', stock: 11 },
    ],
    images: [
      '/images/products/neural-unit.webp',
      '/images/products/neural-unit-angle-01.jpg',
      '/images/products/neural-unit-angle-02.jpg',
    ],
    version: 'v.3.1',
    isNew: true,
  },
  {
    id: '03',
    slug: 'void-frame',
    title: 'VOID_FRAME',
    subtitle: 'Photonic Lens Accessory',
    priceRaw: 560,
    category: 'ACCESSORY',
    categoryCode: 'A.03',
    description:
      'VOID_FRAME lenses refract ambient photonic data into a heads-up overlay. The polarisation filter adapts dynamically to ambient light, maintaining perfect contrast from arctic noon to urban midnight.',
    details: [
      'Adaptive photonic polarisation',
      'AR-ready micro-display substrate',
      'Titanium beta wire frame',
      'UV400 + blue-light blocking coating',
      'Compatible with NEURAL_UNIT',
    ],
    variants: [{ size: 'ONE SIZE', stock: 40 }],
    images: ['/images/products/void-frame.webp'],
    version: 'v.1.8',
  },
  {
    id: '04',
    slug: 'pulse-vest',
    title: 'PULSE_VEST',
    subtitle: 'Biometric Monitoring Vest',
    priceRaw: 920,
    category: 'GEAR',
    categoryCode: 'G.04',
    description:
      'The PULSE_VEST turns your torso into a biometric command centre. Embedded sensors provide continuous cardiac, respiratory, and galvanic skin response data streamed live to the VEXO neural network.',
    details: [
      'Continuous cardiac rhythm monitor',
      'Respiratory rate sensors (front + rear)',
      'Galvanic skin response mesh',
      'VEXO Neural Network cloud sync',
      'Water-resistant (IPX5)',
    ],
    variants: [
      { size: 'XS', stock: 8 },
      { size: 'S', stock: 15 },
      { size: 'M', stock: 18 },
      { size: 'L', stock: 18 },
      { size: 'XL', stock: 9 },
    ],
    images: [
      '/images/products/pulse-vest.webp',
      '/images/products/pulse-vest-side-01.jpg',
      '/images/products/pulse-vest-side-02.jpg',
    ],
    version: 'v.2.0',
  },
  {
    id: '05',
    slug: 'echo-frame',
    title: 'ECHO_FRAME',
    subtitle: 'Data Stream Exo-Pants',
    priceRaw: 680,
    category: 'OUTERWEAR',
    categoryCode: 'N.05',
    description:
      'Engineered for unrestricted movement, the ECHO_FRAME pants feature articulated knee panels and a 4D-stretch waistband with embedded motion sensors that feed data to your VEXO ecosystem.',
    details: [
      '4D-stretch carbon composite fabric',
      'Articulated knee panels for mobility',
      'Embedded inertial movement unit (IMU)',
      'Six reinforced weatherproof pockets',
      'Reflective VEXO logo detail at hem',
    ],
    variants: [
      { size: '28', stock: 10 },
      { size: '30', stock: 16 },
      { size: '32', stock: 22 },
      { size: '34', stock: 22 },
      { size: '36', stock: 12 },
      { size: '38', stock: 5 },
    ],
    images: [
      '/images/products/echo-frame.webp',
      '/images/products/echo-frame-side-01.jpg',
      '/images/products/echo-frame-side-02.jpg',
    ],
    version: 'v.1.5',
  },
  {
    id: '06',
    slug: 'singularity-bag',
    title: 'SINGULARITY',
    subtitle: 'Smart Cargo Carrier',
    priceRaw: 490,
    category: 'ACCESSORY',
    categoryCode: 'A.06',
    description:
      'The SINGULARITY cargo carrier integrates a 15W wireless charging bay, RFID-blocking compartments, and a tamper-alert system that notifies you via the VEXO app.',
    details: [
      '15W Qi wireless charging bay',
      'RFID-blocking main compartment',
      'Tamper-alert haptic notification',
      '30L modular capacity',
      'Ballistic nylon outer shell',
    ],
    variants: [{ size: 'ONE SIZE', stock: 35 }],
    images: ['/images/products/singularity-bag.webp'],
    version: 'v.2.2',
  },
  {
    id: '07',
    slug: 'kinetic-vest',
    title: 'KINETIC_VEST',
    subtitle: 'Thermal Adaptive Vest',
    priceRaw: 760,
    category: 'GEAR',
    categoryCode: 'G.07',
    description:
      'The KINETIC_VEST adapts to your core temperature via micro-channel thermodynamic panels, keeping you in the optimal 36–38°C range regardless of external conditions.',
    details: [
      'Active thermodynamic micro-channel panels',
      'Core temperature target: 36–38°C',
      'Breathable aerogel insulation layer',
      'VEXO Core App integration',
      'Machine washable at 40°C',
    ],
    variants: [
      { size: 'XS', stock: 7 },
      { size: 'S', stock: 13 },
      { size: 'M', stock: 20 },
      { size: 'L', stock: 20 },
      { size: 'XL', stock: 10 },
    ],
    images: ['/images/products/kinetic-vest.webp'],
    version: 'v.3.0',
    isNew: true,
  },
  {
    id: '08',
    slug: 'legacy-core',
    title: 'LEGACY_CORE',
    subtitle: 'Generational Data Archive',
    priceRaw: 1800,
    category: 'ARTIFACT',
    categoryCode: 'A.08',
    description:
      'The LEGACY_CORE is a limited-edition data artifact. Encased in aerospace aluminium, it stores a cryptographic identity key, your biometric signature, and a 1TB personal archive — designed to last 100 years.',
    details: [
      'Aerospace 7075 aluminium housing',
      '1TB encrypted personal archive',
      'Cryptographic identity key (ECC-521)',
      '100-year data retention guarantee',
      'Edition of 500 — individually numbered',
    ],
    variants: [{ size: 'LIMITED ED.', stock: 3 }],
    images: ['/images/products/legacy-core.webp'],
    version: 'v.LEGACY',
    isNew: false,
  },
  {
    id: '09',
    slug: 'obsidian-architectural-trench',
    title: 'OBSIDIAN_TRENCH',
    subtitle: 'Architectural Trench Coat',
    priceRaw: 1080,
    category: 'OUTERWEAR',
    categoryCode: 'N.09',
    description:
      'A long black trench with a double-breasted front and defined waist. A restrained, architectural outer layer from the VEXO Edit.',
    details: [
      'Longline trench silhouette',
      'Double-breasted front',
      'Defined waist with belt',
      'Black finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: ['/images/products/color-obsidian-black.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '10',
    slug: 'crimson-field-shell',
    title: 'CRIMSON_FIELD_SHELL',
    subtitle: 'Technical Field Shell',
    priceRaw: 980,
    category: 'OUTERWEAR',
    categoryCode: 'N.10',
    description:
      'A crimson field shell with a high collar and utility pocket layout. Its structured silhouette brings a precise note of colour to the outerwear collection.',
    details: [
      'High collar with hood',
      'Multiple front utility pockets',
      'Crimson finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: [
      '/images/products/color-crimson-red.jpg',
      '/images/products/crimson-field-shell-angle-01.jpg',
      '/images/products/crimson-field-shell-angle-02.jpg',
    ],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '11',
    slug: 'graphite-modular-vest',
    title: 'GRAPHITE_MODULAR_VEST',
    subtitle: 'Modular Utility Vest',
    priceRaw: 640,
    category: 'GEAR',
    categoryCode: 'G.08',
    description:
      'A graphite utility vest with layered front pockets and strap detailing, designed as a structured outer layer.',
    details: [
      'Layered front pocket layout',
      'Strapped shoulder and side details',
      'Graphite finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: ['/images/products/color-graphite-grey.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '12',
    slug: 'silver-reflective-anorak',
    title: 'SILVER_REFLECTIVE_ANORAK',
    subtitle: 'Reflective Technical Anorak',
    priceRaw: 1080,
    category: 'OUTERWEAR',
    categoryCode: 'N.11',
    description:
      'A reflective silver anorak with a hooded, high-collar silhouette and utility pocket detailing, shown in the Chrome District colour story.',
    details: [
      'Hooded high-collar silhouette',
      'Front utility pocket',
      'Reflective silver finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: [
      '/images/products/color-metallic-silver.jpg',
      '/images/products/silver-anorak-angle-01.jpg',
      '/images/products/silver-anorak-angle-02.jpg',
    ],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '13',
    slug: 'olive-articulated-cargo',
    title: 'OLIVE_ARTICULATED_CARGO',
    subtitle: 'Articulated Cargo Trousers',
    priceRaw: 560,
    category: 'OUTERWEAR',
    categoryCode: 'N.12',
    description:
      'Olive cargo trousers with articulated knee panels and a multi-pocket layout, presented as a distinct colourway from the black ECHO_FRAME trouser.',
    details: [
      'Articulated knee panels',
      'Multiple cargo pockets',
      'Olive finish',
    ],
    variants: zeroStockVariants(trouserSizes),
    images: ['/images/products/color-olive-green.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '14',
    slug: 'sand-textured-knit',
    title: 'SAND_TEXTURED_KNIT',
    subtitle: 'Textured Knit Sweater',
    priceRaw: 420,
    category: 'OUTERWEAR',
    categoryCode: 'N.13',
    description:
      'A relaxed sand-toned knit with a rounded neckline and visible surface texture, offering a softer contrast to the collection’s technical layers.',
    details: [
      'Relaxed knit silhouette',
      'Rounded neckline',
      'Sand finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: ['/images/products/color-sand-beige.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '15',
    slug: 'deep-burgundy-bomber',
    title: 'DEEP_BURGUNDY_BOMBER',
    subtitle: 'Bonded Bomber Jacket',
    priceRaw: 860,
    category: 'OUTERWEAR',
    categoryCode: 'N.14',
    description:
      'A deep burgundy bomber with a clean zip-front silhouette and dark hardware, adding a darker colour note to the outerwear range.',
    details: [
      'Bomber silhouette',
      'Zip-front closure',
      'Deep burgundy finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: ['/images/products/color-deep-burgundy.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '16',
    slug: 'bone-architectural-parka',
    title: 'BONE_ARCHITECTURAL_PARKA',
    subtitle: 'Technical Parka',
    priceRaw: 1120,
    category: 'OUTERWEAR',
    categoryCode: 'N.15',
    description:
      'A bone-white parka with a high collar, hood, and contrasting dark seam details, balancing a pale finish with a structured outline.',
    details: [
      'High collar with hood',
      'Dark contrast seam details',
      'Bone-white finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: ['/images/products/color-bone-white.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '17',
    slug: 'charcoal-tailored-coat',
    title: 'CHARCOAL_TAILORED_COAT',
    subtitle: 'Longline Tailored Coat',
    priceRaw: 1100,
    category: 'OUTERWEAR',
    categoryCode: 'N.16',
    description:
      'A long charcoal coat with notch lapels and a straight tailored silhouette, featured in the Obsidian Minimal editorial.',
    details: [
      'Longline silhouette',
      'Notch lapels',
      'Button-front closure',
      'Charcoal finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: [
      '/images/products/charcoal-coat-angle-01.jpg',
      '/images/products/charcoal-coat-angle-02.jpg',
      '/images/products/look-obsidian-minimal-portrait.jpg',
    ],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '18',
    slug: 'olive-field-jacket',
    title: 'OLIVE_FIELD_JACKET',
    subtitle: 'Utility Field Jacket',
    priceRaw: 780,
    category: 'OUTERWEAR',
    categoryCode: 'N.17',
    description:
      'An olive field jacket with a stand collar and front utility pockets, shown with coordinated layers in the Earth Frequency editorial.',
    details: [
      'Stand-collar silhouette',
      'Front utility pockets',
      'Olive finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: [
      '/images/products/olive-field-jacket-angle-01.jpg',
      '/images/products/olive-field-jacket-angle-02.jpg',
      '/images/products/look-earth-frequency-portrait.jpg',
    ],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '19',
    slug: 'legacy-core-jacket',
    title: 'LEGACY_CORE_JACKET',
    subtitle: 'Tailored Technical Jacket',
    priceRaw: 1200,
    category: 'OUTERWEAR',
    categoryCode: 'N.18',
    description:
      'A long, dark tailored outer layer from the Legacy Core image set. This apparel piece is separate from the existing LEGACY_CORE data artifact.',
    details: [
      'Longline silhouette',
      'Structured lapel and collar',
      'Dark finish',
    ],
    variants: zeroStockVariants(apparelSizes),
    images: [
      '/images/products/legacy-core-jacket-angle-01.jpg',
      '/images/products/legacy-core-jacket-angle-02.jpg',
    ],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '20',
    slug: 'obsidian-technical-boot',
    title: 'OBSIDIAN_TECHNICAL_BOOT',
    subtitle: 'Technical Lace-Up Boot',
    priceRaw: 640,
    category: 'ACCESSORY',
    categoryCode: 'A.09',
    description:
      'A black lace-up boot visible in the Obsidian Minimal look, with a high-top profile and a substantial sole.',
    details: [
      'Lace-up closure',
      'High-top silhouette',
      'Black finish',
    ],
    variants: zeroStockVariants(bootSizes),
    images: ['/images/products/look-obsidian-minimal-portrait.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
  {
    id: '21',
    slug: 'modular-shoulder-harness',
    title: 'MODULAR_SHOULDER_HARNESS',
    subtitle: 'Layered Shoulder Harness',
    priceRaw: 420,
    category: 'GEAR',
    categoryCode: 'G.09',
    description:
      'A sculptural shoulder harness with layered straps and dark hardware, shown in close detail in the VEXO manifesto imagery.',
    details: [
      'Layered shoulder straps',
      'Dark hardware details',
      'Asymmetrical silhouette',
    ],
    variants: [{ size: 'ONE SIZE', stock: 0 }],
    images: ['/images/products/manifesto-silk-harness-detail.jpg'],
    version: 'v.1.0',
    isNew: true,
    inStock: false,
  },
];
