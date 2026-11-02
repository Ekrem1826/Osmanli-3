/**
 * Pure mathematical, topographical, historical region, quest, NPC & interior logic
 * for Fatih Istanbul Historical Open World (1451–1481 & 1557–1560).
 */

export interface LandmarkInfo {
  id: string;
  name: string;
  date: string;
  periodTag: '1451-1481' | '1500-1560';
  patronArchitect: string;
  certainty: 'Belgeli' | 'Kısmen belgeli' | 'Varsayımsal yeniden kurgu';
  description: string;
  pos: [number, number, number];
  camOffset: [number, number, number];
  category: 'saray' | 'cami' | 'meydan' | 'kemer' | 'sur' | 'liman' | 'bizans';
  interiorType?: 'saray' | 'cami' | 'han' | 'hamam' | 'dukkan' | 'avlu';
}

export interface HistoricalRegion {
  id: string;
  name: string;
  periodNote: string;
  center: [number, number];
  radius: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  giverName: string;
  description: string;
  targetPos: [number, number];
  rewardAkce: number;
  type: 'lost_item' | 'escort' | 'explore' | 'history' | 'buy_item';
  requiredItem?: string;
}

export interface TourKeyframe {
  timeSec: number;
  locationId: string;
  camPos: [number, number, number];
  lookAt: [number, number, number];
  timeOfDay: number;
  season: 'Bahar' | 'Yaz' | 'Sonbahar' | 'Kış';
  weather: 'Açık' | 'Bulutlu' | 'Sisli' | 'Hafif yağmur';
  title: string;
  narration: string;
}

/** Deterministic seeded PRNG (Mulberry32) */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, z * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

export function getCoastBoundsZ(x: number): { northZ: number; southZ: number } {
  const t = Math.max(0, Math.min(1, (x + 480) / 920));
  const northZ =
    -185 +
    115 * Math.pow(t, 0.75) +
    14 * Math.sin(t * Math.PI * 2.0) +
    (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 1.6) * 85 : 0);

  const southZ =
    280 -
    238 * Math.pow(t, 1.22) -
    16 * Math.sin(t * Math.PI * 3.0) -
    (t > 0.85 ? Math.pow((t - 0.85) / 0.15, 1.6) * 20 : 0);

  return { northZ, southZ };
}

export const SEVEN_HILLS = [
  { name: '1. Tepe (Sarayburnu / Ayasofya)', x: 325, z: 10, rx: 115, rz: 85, h: 24 },
  { name: '2. Tepe (Çemberlitaş / Nuruosmaniye mevkii)', x: 185, z: 20, rx: 95, rz: 80, h: 28 },
  { name: '3. Tepe (Süleymaniye / Eski Saray)', x: 55, z: -20, rx: 120, rz: 95, h: 36 },
  { name: '4. Tepe (Fatih Külliyesi)', x: -125, z: -45, rx: 115, rz: 95, h: 35 },
  { name: '5. Tepe (Yavuz Selim / Fener üstü)', x: -235, z: -78, rx: 95, rz: 75, h: 34 },
  { name: '6. Tepe (Edirnekapı / Mihrimah)', x: -385, z: -98, rx: 110, rz: 85, h: 38 },
  { name: '7. Tepe (Kocamustafapaşa / Yedikule üstü)', x: -310, z: 125, rx: 155, rz: 105, h: 26 },
] as const;

export function getPeninsulaElevation(x: number, z: number): number {
  if (x >= -510 && x <= 442) {
    const { northZ, southZ } = getCoastBoundsZ(x);
    if (z >= northZ && z <= southZ && southZ > northZ + 8) {
      const width = southZ - northZ;
      const distFromEdge = Math.min(z - northZ, southZ - z);
      const eastDist = 440 - x;
      const shoreFactor = Math.min(
        1,
        Math.max(0, distFromEdge / Math.min(75, width * 0.45))
      );
      const eastTipFactor = Math.min(1, Math.max(0, eastDist / 45));
      const westSlope = x < -480 ? Math.max(0, 1 - (-480 - x) / 30) : 1;
      const envelope = Math.pow(shoreFactor * eastTipFactor * westSlope, 0.65);

      if (envelope <= 0.001) return -2.5;

      let hillSum = 4.5;
      for (const hill of SEVEN_HILLS) {
        const dx = (x - hill.x) / hill.rx;
        const dz = (z - hill.z) / hill.rz;
        const d2 = dx * dx + dz * dz;
        if (d2 < 2.8) {
          hillSum += hill.h * Math.exp(-d2 * 1.15);
        }
      }

      const lycusZ = -20 + (x + 150) * -0.25;
      const lycusDist = Math.abs(z - lycusZ);
      if (x < 20 && x > -460 && lycusDist < 70) {
        hillSum -= 6.5 * Math.exp(-Math.pow(lycusDist / 38, 2));
      }

      if (x > -90 && x < 20 && Math.abs(z + 30) < 65) {
        hillSum -= 4.5 * Math.exp(-Math.pow((x + 35) / 42, 2));
      }

      const detail = (fbm2D(x * 0.012 + 7.1, z * 0.012 + 3.4, 3) - 0.5) * 3.8;
      return Math.max(0.4, (hillSum + detail) * envelope);
    }
  }

  if (x >= -120 && x <= 380) {
    const { northZ } = getCoastBoundsZ(Math.min(350, Math.max(-120, x)));
    const galataSouthZ = northZ - 88;
    const galataNorthZ = -430;
    if (z <= galataSouthZ && z >= galataNorthZ) {
      const distSouth = galataSouthZ - z;
      const distEast = 380 - x;
      const distWest = x + 120;
      const env = Math.min(1, distSouth / 60) * Math.min(1, distEast / 55) * Math.min(1, distWest / 60);
      if (env > 0.02) {
        return Math.max(0.5, 18 * env + fbm2D(x * 0.015, z * 0.015, 2) * 5);
      }
    }
  }

  if (x >= 610 && x <= 840 && z >= -260 && z <= 280) {
    const distWest = x - 610;
    const distZ = Math.min(z + 260, 280 - z);
    const env = Math.min(1, distWest / 70) * Math.min(1, distZ / 80);
    if (env > 0.02) {
      return Math.max(0.5, 16 * env + fbm2D(x * 0.01, z * 0.01, 2) * 4);
    }
  }

  return -3.5;
}

export function isPeninsulaLand(x: number, z: number): boolean {
  if (x < -482 || x > 438) return false;
  const { northZ, southZ } = getCoastBoundsZ(x);
  return z >= northZ + 3 && z <= southZ - 3 && getPeninsulaElevation(x, z) > 0.6;
}

/** 9 Historical Regions of Fatih Istanbul (1451–1481 focus) */
export const HISTORICAL_REGIONS: HistoricalRegion[] = [
  {
    id: 'topkapi-bolgesi',
    name: 'Topkapı Sarayı ve Çevresi (Saray-ı Cedîd)',
    periodNote: '1460–1478 arasında Fatih Sultan Mehmed tarafından Sur-ı Sultani içinde inşa ettirildi.',
    center: [355, -10],
    radius: 70,
  },
  {
    id: 'ayasofya-bolgesi',
    name: 'Ayasofya ve Çevresi',
    periodNote: '1453 fethiyle camiye tahvil edilen Ayasofya-i Kebîr, Fatih medresesi ve Aya İrini.',
    center: [305, 32],
    radius: 55,
  },
  {
    id: 'hipodrom-bolgesi',
    name: 'At Meydanı (Sultanahmet Mevkii) ve Hipodrom',
    periodNote: '1451–1481 döneminde antik Hipodrom dikilitaşları açıktadır; Sultanahmet Camii henüz yoktur.',
    center: [255, 58],
    radius: 60,
  },
  {
    id: 'kapalicarsi-bolgesi',
    name: 'Kapalıçarşı Öncülleri (Bedestenler) ve Ticaret Bölgesi',
    periodNote: '1460–1461 yıllarında Fatih vakfı olarak kurulan Cevahir (İç) ve Sandal Bedestenleri ile hanlar.',
    center: [125, 12],
    radius: 65,
  },
  {
    id: 'eminonu-bolgesi',
    name: 'Eminönü ve Liman Çevresi',
    periodNote: 'Haliç gümrük iskeleleri, zahire kapanları ve ticaret kadırgalarının yanaştığı kıyı kuşağı.',
    center: [175, -85],
    radius: 60,
  },
  {
    id: 'zeyrek-bolgesi',
    name: 'Zeyrek ve Bozdoğan Kemeri Çevresi',
    periodNote: 'Fatih Camii tamamlanana dek Molla Zeyrek tarafından ilk Osmanlı medresesi olarak kullanılan Pantokrator.',
    center: [-42, -55],
    radius: 65,
  },
  {
    id: 'fatih-bolgesi',
    name: 'Fatih Külliyesi ve Eski Yerleşim Bölgeleri',
    periodNote: '1463–1470 arasında Mimar Atik Sinan eliyle inşa edilen Fatih Camii ve Sahn-ı Semân medreseleri.',
    center: [-125, -45],
    radius: 85,
  },
  {
    id: 'edirnekapi-bolgesi',
    name: 'Edirnekapı ve Kara Surları',
    periodNote: '1453 kuşatmasının izlerini taşıyan ve Fatih emriyle onarılan üç kademeli Theodosius surları ve Yedikule (1458).',
    center: [-440, -98],
    radius: 95,
  },
  {
    id: 'halic-bolgesi',
    name: 'Haliç Kıyıları (Unkapanı, Fener ve Balat)',
    periodNote: 'Haliç deniz surları, balıkçı iskeleleri, Fener Rum Patrikhanesi ve Balat mahalleleri.',
    center: [-195, -135],
    radius: 85,
  },
];

export function findRegionAtPoint(x: number, z: number): HistoricalRegion {
  let best = HISTORICAL_REGIONS[6];
  let bestDist = Infinity;
  for (const reg of HISTORICAL_REGIONS) {
    const d = Math.hypot(x - reg.center[0], z - reg.center[1]);
    if (d < bestDist) {
      bestDist = d;
      best = reg;
    }
  }
  return best;
}

/** Resolve NPC-to-NPC and NPC-to-Player collision avoidance without passing through each other */
export function resolveNpcCollision(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  minDist = 1.6
): [number, number] {
  const dx = ax - bx;
  const dz = az - bz;
  const dist = Math.hypot(dx, dz);
  if (dist >= minDist || dist === 0) return [ax, az];
  const push = (minDist - dist) * 0.55;
  const nx = dx / dist;
  const nz = dz / dist;
  return [ax + nx * push, az + nz * push];
}

/** 5 Playable Historical Quests (1451–1481 Period Authentic) */
export const HISTORICAL_QUESTS: QuestDefinition[] = [
  {
    id: 'quest-lost-item',
    title: 'Esnafın Kaybolan Sandığı',
    giverName: 'Bakırcı İlyas Usta',
    description:
      'Bedesten esnafı İlyas Usta\'nın Eminönü iskelesinden gelirken düşürdüğü mühürlü bakır sandığı Unkapanı-Eminönü yolunda bul.',
    targetPos: [155, -55],
    rewardAkce: 45,
    type: 'lost_item',
  },
  {
    id: 'quest-escort-merchant',
    title: 'Tüccara Limana Kadar Eşlik Et',
    giverName: 'Tüccar Kasım Çelebi',
    description:
      'Bursa ipeği taşıyan Kasım Çelebi\'ye Cevahir Bedesteni\'nden Eminönü Gümrük İskelesi\'ne kadar güvenle eşlik et.',
    targetPos: [175, -82],
    rewardAkce: 60,
    type: 'escort',
  },
  {
    id: 'quest-explore-palace',
    title: 'Saray-ı Cedîd Çevresini Keşfet',
    giverName: 'Bölükbaşı Sinan Ağa',
    description:
      '1460–1478 arasında inşa edilen Yeni Saray (Topkapı Sarayı) Sur-ı Sultani kapısını ve Bâb-ı Hümâyûn nöbet mevkiini kontrol et.',
    targetPos: [345, -8],
    rewardAkce: 50,
    type: 'explore',
  },
  {
    id: 'quest-learn-history',
    title: 'Fatih Külliyesi\'nin İmar Hikâyesini Öğren',
    giverName: 'Müderris Alaüddin Efendi',
    description:
      'Dördüncü Tepe\'de 1463–1470 yılları arasında Mimar Atik Sinan tarafından inşa edilen Fatih Camii ve Sahn-ı Semân medreselerinin tarihçesini dinle.',
    targetPos: [-125, -45],
    rewardAkce: 40,
    type: 'history',
  },
  {
    id: 'quest-buy-bazaar',
    title: 'Bedesten\'den Darüşşifa İçin Baharat Al',
    giverName: 'Hekimbaşı Yardımcısı',
    description:
      'Kapalıçarşı Cevahir Bedesteni\'ndeki aktardan Darüşşifa için Şifalı Macun satın al ve teslim et.',
    targetPos: [122, 14],
    rewardAkce: 55,
    type: 'buy_item',
    requiredItem: 'Şifalı Macun',
  },
];

export const LANDMARKS: LandmarkInfo[] = [
  {
    id: 'genel-bakis',
    name: 'Genel Bakış (Tarihî Yarımada)',
    date: '1451–1481 (Fatih Devri) ve 1557–1560 (Klasik Dönem)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâniler: Fatih Sultan Mehmed ve Kanuni Sultan Süleyman',
    certainty: 'Belgeli',
    description:
      'Haliç, Marmara Denizi ve Boğaziçi\'nin kesişiminde Yedi Tepe üzerine kurulu payitaht İstanbul. 1453 fethinden itibaren Fatih Sultan Mehmed\'in imar ettiği Saray-ı Cedîd, Fatih Külliyesi, Bedestenler, Yedikule ve Mimar Sinan\'ın klasik dönem eserleriyle yaşayan açık dünya şehir dokusu.',
    pos: [35, 18, -5],
    camOffset: [135, 245, 395],
    category: 'meydan',
  },
  {
    id: 'topkapi-sarayi',
    name: 'Topkapı Sarayı (Saray-ı Cedîd-i Âmire)',
    date: '1460–1478 (Fatih Sultan Mehmed dönemi kuruluşu)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed · Mimarlar: Mimar Alaüddin, Acem Ali',
    certainty: 'Belgeli',
    description:
      'Sarayburnu zeytinlikleri üzerinde 1460–1478 yıllarında Sur-ı Sultani ile çevrili olarak kurulan devletin yönetim merkezi. Bâb-ı Hümâyûn, Alay Meydanı, Bâbüsselâm (Orta Kapı), Divan-ı Hümâyûn (Kubbealtı), Adalet Kulesi ve Enderun odalarının içine girilerek gezilebilir.',
    pos: [355, 22, -10],
    camOffset: [65, 45, 80],
    category: 'saray',
    interiorType: 'saray',
  },
  {
    id: 'ayasofya',
    name: 'Ayasofya-i Kebîr Camii ve Aya İrini',
    date: '532–537 (İnşa) · 1453 (Fatih Sultan Mehmed tarafından camiye tahvili)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: I. Justinianus (Vakfeden: Fatih Sultan Mehmed)',
    certainty: 'Belgeli',
    description:
      '1453 fethinin hemen ardından Fatih Sultan Mehmed\'in ilk cuma namazını kılarak Fethiye Camii olarak vakfettiği ulu mabed. 1451–1481 döneminde Fatih\'in eklettiği ilk minare ve kuzeyindeki Fatih Medresesi ile hizmet vermektedir; harim kısmına kapıdan girilebilir.',
    pos: [305, 24, 32],
    camOffset: [55, 36, 65],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'suleymaniye',
    name: 'Süleymaniye Camii ve Külliyesi',
    date: '1550–1557 (16. Yüzyıl Klasik Dönem · 1451–1481\'de Eski Saray arazisi)',
    periodTag: '1500-1560',
    patronArchitect: 'Bâni: Kanuni Sultan Süleyman · Mimar: Mimar Koca Sinan',
    certainty: 'Belgeli',
    description:
      'Üçüncü Tepe\'de Haliç\'e hâkim teraslar üzerinde yükselen külliye. Not: 1451–1481 Fatih Sultan Mehmed döneminde bu alan Eski Saray (Saray-ı Atîk) bahçelerinin devamı niteliğindedir; 1550–1557 arasında Mimar Sinan tarafından inşa edilmiştir.',
    pos: [62, 37, -38],
    camOffset: [68, 44, 76],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'fatih-camii',
    name: 'Fatih Camii ve Sahn-ı Semân Külliyesi (1463–1470)',
    date: '1463–1470 (1766 depremi öncesi özgün Fatih Sultan Mehmed devri yapısı)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed · Mimar: Atik Sinan (Sinanüddin Yusuf)',
    certainty: 'Varsayımsal yeniden kurgu',
    description:
      'Dördüncü Tepe\'de Şubat 1463\'te temeli atılıp 1470\'te tamamlanan ilk büyük selâtin külliyesi. Bir ana kubbe ve kıble yönünde tek bir yarım kubbeden oluşan özgün cami ile Karadeniz ve Akdeniz yönlerindeki sekizer Sahn-ı Semân medresesi, darüşşifası ve tabhanesiyle 1451–1481 döneminin en büyük imar eseridir.',
    pos: [-125, 36, -45],
    camOffset: [65, 44, 74],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'sehzade-camii',
    name: 'Şehzade Camii ve Eski Yeniçeri Odaları Mevkii',
    date: '1460\'lar (Eski Odalar) · 1543–1548 (Şehzade Külliyesi)',
    periodTag: '1500-1560',
    patronArchitect: 'Fatih Devri: Yeniçeri Eski Odaları · 1548: Mimar Koca Sinan',
    certainty: 'Belgeli',
    description:
      'Yarımadanın merkezinde Fatih Sultan Mehmed devrinde Yeniçeri Eski Odaları\'nın kurulduğu stratejik kavşak; 1543–1548 yıllarında Mimar Sinan tarafından dört yarım kubbeli Şehzade Mehmed Külliyesi inşa edilmiştir.',
    pos: [-30, 31, -8],
    camOffset: [52, 34, 62],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'beyazit-kapalicarsi',
    name: 'Kapalıçarşı Bedestenleri, Eski Saray ve Mahmud Paşa Külliyesi',
    date: '1454–1463 (Eski Saray: 1455, Bedestenler: 1460–61, Mahmud Paşa: 1463)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed ve Veziriazam Mahmud Paşa · Mimar Atik Sinan',
    certainty: 'Kısmen belgeli',
    description:
      '1454–1455\'te tamamlanan Eski Saray (Saray-ı Atîk), 1460–1461\'de Ayasofya vakfına gelir sağlamak üzere inşa edilen Cevahir (İç) ve Sandal Bedestenleri ile Veziriazam Mahmud Paşa\'nın 1463 tarihli külliyesi, hamamı ve Kürkçüler Hanı. Dükkânlara ve han avlusuna girilebilir.',
    pos: [105, 31, 15],
    camOffset: [64, 42, 74],
    category: 'cami',
    interiorType: 'han',
  },
  {
    id: 'at-meydani',
    name: 'At Meydanı (Hipodrom) ve Çemberlitaş',
    date: 'MÖ 203 – MS 1481 (Fatih devri şenlik ve sipahi talim meydanı)',
    periodTag: '1451-1481',
    patronArchitect: 'Bizans mirası · Osmanlı cülus ve sipahi meydanı',
    certainty: 'Belgeli',
    description:
      'Theodosius Dikilitaşı, Yılanlı Sütun ve Örme Dikilitaş\'ın yükseldiği açık U planlı At Meydanı. 1451–1481 döneminde Sultanahmet Camii henüz inşa edilmemiştir; meydan sipahi atlılarının talim alanı ve divan yolu geçişidir.',
    pos: [255, 24, 58],
    camOffset: [56, 35, 66],
    category: 'meydan',
    interiorType: 'avlu',
  },
  {
    id: 'bozdogan-kemeri',
    name: 'Bozdoğan (Valens) Su Kemeri ve Molla Zeyrek Medresesi',
    date: 'MS 375 (Kemer) · 1453–1470 (Molla Zeyrek Medresesi ve Camii)',
    periodTag: '1451-1481',
    patronArchitect: 'İmparator Valens · Müderris Molla Mehmed Zeyrek',
    certainty: 'Belgeli',
    description:
      'Üçüncü ve Dördüncü tepeleri bağlayan çift katlı su kemeri ve hemen kuzeyindeki Pantokrator Manastırı. 1453 fethinden sonra Fatih Külliyesi tamamlanana dek Molla Zeyrek yönetiminde Osmanlı İstanbul\'unun ilk medresesi olarak hizmet vermiştir.',
    pos: [-38, 28, -32],
    camOffset: [55, 34, 65],
    category: 'kemer',
    interiorType: 'avlu',
  },
  {
    id: 'halic-fener-balat',
    name: 'Haliç Kıyıları: Unkapanı, Fener ve Balat İskeleleri',
    date: '1453–1481 Liman, Kapan ve Mahalle Dokusu',
    periodTag: '1451-1481',
    patronArchitect: 'Fatih Sultan Mehmed\'in millet sistemi fermanıyla korunan mahalleler',
    certainty: 'Kısmen belgeli',
    description:
      'Haliç deniz surları boyunca Unkapanı buğday kapanı, Cibali, Fener ve Balat iskeleleri. Fatih Sultan Mehmed\'in 1454\'te Gennadios\'u patrik tayin ederek güvence altına aldığı Rum cemaati konakları, Balat mahalleleri ve balıkçı iskeleleri.',
    pos: [-195, 8, -165],
    camOffset: [55, 32, -75],
    category: 'liman',
    interiorType: 'dukkan',
  },
  {
    id: 'eminonu-limani',
    name: 'Eminönü ve Sirkeci Limanı (Gümrük Önü)',
    date: '1453–1481 Deniz Ticareti ve Kapan İskeleleri',
    periodTag: '1451-1481',
    patronArchitect: 'Osmanlı Gümrük Eminliği ve Liman Kethüdaları',
    certainty: 'Kısmen belgeli',
    description:
      'Haliç ağzında zahire, kereste, baharat ve ipek yüklü gemilerin yanaştığı ana gümrük limanı. Yeni Cami ve Mısır Çarşısı henüz mevcut değildir; kıyıda ahşap mahzenler, balıkçılar ve tüccar hanları yer alır.',
    pos: [175, 6, -85],
    camOffset: [45, 28, -68],
    category: 'liman',
    interiorType: 'dukkan',
  },
  {
    id: 'edirnekapi-surlar',
    name: 'Theodosius Kara Surları ve Edirnekapı',
    date: 'MS 413 (Surlar) · 1453–1458 (Fatih devri sur onarımları)',
    periodTag: '1451-1481',
    patronArchitect: 'II. Theodosius · Onarım: Fatih Sultan Mehmed',
    certainty: 'Belgeli',
    description:
      'Yarımadayı batıdan koruyan su hendeği, dış sur ve 96 burçlu yüksek iç sur. Fatih Sultan Mehmed\'in 29 Mayıs 1453\'te şehre törenle girdiği Edirnekapı (Charisius Kapısı) ve kervanların kontrol edildiği sur kapısı.',
    pos: [-440, 34, -98],
    camOffset: [-65, 38, 60],
    category: 'sur',
    interiorType: 'avlu',
  },
  {
    id: 'yedikule-hisari',
    name: 'Yedikule Hisarı ve Altınkapı (Hazine-i Hümâyûn)',
    date: '1457–1458 (Fatih Sultan Mehmed tarafından inşa ettirildi)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed · Mimar: Kemaleddin',
    certainty: 'Belgeli',
    description:
      'Fatih Sultan Mehmed\'in 1457–1458\'de Bizans Altınkapı\'sına dört büyük kule ekleterek inşa ettirdiği yedi kuleli yıldızvari hisar. Devletin altın hazinesi (Hazine-i Âmire) ve muhafız garnizonu burada korunmaktadır.',
    pos: [-455, 16, 215],
    camOffset: [-60, 38, 70],
    category: 'sur',
    interiorType: 'saray',
  },
  {
    id: 'marmara-kumkapi',
    name: 'Marmara Kıyıları: Kumkapı, Samatya ve Langa Bostanları',
    date: '1453–1481 Marmara Deniz Surları, Hamamlar ve Bostanlar',
    periodTag: '1451-1481',
    patronArchitect: 'Fatih Devri Vakıfları ve Deniz Surları Muhafızları',
    certainty: 'Belgeli',
    description:
      'Marmara deniz surları boyunca Kumkapı ve Samatya balıkçı limanları, antik Theodosius limanı yatağındaki verimli Langa bostanları ve mahalle hamamları.',
    pos: [-85, 14, 155],
    camOffset: [45, 32, 78],
    category: 'liman',
    interiorType: 'hamam',
  },
];

export const GUIDED_TOUR_KEYFRAMES: TourKeyframe[] = [
  {
    timeSec: 0,
    locationId: 'genel-bakis',
    camPos: [220, 210, 320],
    lookAt: [30, 20, -10],
    timeOfDay: 7.2,
    season: 'Bahar',
    weather: 'Açık',
    title: '1/10 · Dersaadet Sabahı',
    narration:
      'Sabah güneşi Boğaziçi\'nden doğarken Yedi Tepe üzerindeki Tarihî Yarımada, surları, bedestenleri ve külliyeleriyle uyanıyor.',
  },
  {
    timeSec: 20,
    locationId: 'topkapi-sarayi',
    camPos: [435, 68, 65],
    lookAt: [350, 22, -10],
    timeOfDay: 8.5,
    season: 'Bahar',
    weather: 'Açık',
    title: '2/10 · Topkapı Sarayı (Saray-ı Cedîd)',
    narration:
      'Fatih Sultan Mehmed\'in 1460–1478 arasında inşa ettirdiği Sur-ı Sultani içindeki Topkapı Sarayı: Bâb-ı Hümâyûn, Orta Kapı ve Adalet Kulesi.',
  },
  {
    timeSec: 40,
    locationId: 'ayasofya',
    camPos: [365, 58, 92],
    lookAt: [305, 25, 32],
    timeOfDay: 10.5,
    season: 'Bahar',
    weather: 'Açık',
    title: '3/10 · Ayasofya-i Kebîr ve At Meydanı',
    narration:
      '1453\'te camiye tahvil edilen Ayasofya ve hemen güneybatısında dikilitaşlarıyla açık At Meydanı (Hipodrom).',
  },
  {
    timeSec: 60,
    locationId: 'beyazit-kapalicarsi',
    camPos: [155, 68, 88],
    lookAt: [105, 30, 10],
    timeOfDay: 12.2,
    season: 'Yaz',
    weather: 'Açık',
    title: '4/10 · Cevahir ve Sandal Bedestenleri (Kapalıçarşı)',
    narration:
      'Öğle vaktinde ticaretin merkezi: 1460\'larda kurulan çok kubbeli İç ve Sandal Bedestenleri, Kürkçüler Hanı, Mahmud Paşa Külliyesi ve Eski Saray.',
  },
  {
    timeSec: 82,
    locationId: 'suleymaniye',
    camPos: [128, 76, 32],
    lookAt: [62, 38, -38],
    timeOfDay: 14.5,
    season: 'Yaz',
    weather: 'Açık',
    title: '5/10 · Üçüncü Tepe ve Haliç Yamaçları',
    narration:
      'Haliç\'e nazır Üçüncü Tepe terasları, külliye kubbeleri, medreseler ve darüşşifa.',
  },
  {
    timeSec: 104,
    locationId: 'bozdogan-kemeri',
    camPos: [18, 62, 35],
    lookAt: [-38, 28, -28],
    timeOfDay: 16.5,
    season: 'Sonbahar',
    weather: 'Açık',
    title: '6/10 · Bozdoğan Su Kemeri ve Molla Zeyrek',
    narration:
      'Üçüncü ve dördüncü tepeleri bağlayan çift katlı Bozdoğan Su Kemeri ve fetihten sonraki ilk medrese olan Molla Zeyrek.',
  },
  {
    timeSec: 124,
    locationId: 'fatih-camii',
    camPos: [-65, 75, 25],
    lookAt: [-125, 36, -45],
    timeOfDay: 17.8,
    season: 'Sonbahar',
    weather: 'Bulutlu',
    title: '7/10 · Fatih Camii ve Sahn-ı Semân Medreseleri (1470)',
    narration:
      'Gün batımında Dördüncü Tepe: 1463–1470 arasında inşa edilen özgün Fatih Camii ve iki yanındaki sekizer Sahn-ı Semân medresesi.',
  },
  {
    timeSec: 144,
    locationId: 'halic-fener-balat',
    camPos: [-140, 42, -235],
    lookAt: [-195, 12, -160],
    timeOfDay: 18.6,
    season: 'Sonbahar',
    weather: 'Sisli',
    title: '8/10 · Haliç Suları, Fener ve Balat İskeleleri',
    narration:
      'Haliç\'te kürek çeken Osmanlı kadırgaları, balıkçı kayıkları ve kıyıda Unkapanı, Fener ile Balat\'ın ahşap cumbalı mahalleleri.',
  },
  {
    timeSec: 162,
    locationId: 'edirnekapi-surlar',
    camPos: [-525, 68, -80],
    lookAt: [-440, 28, -110],
    timeOfDay: 20.5,
    season: 'Kış',
    weather: 'Açık',
    title: '9/10 · Theodosius Kara Surları ve Yedikule Hisarı (1458)',
    narration:
      'Gece çökerken batı sınırındaki üçlü Theodosius kara surları, Edirnekapı ve 1458\'de inşa edilen yedi kuleli Yedikule Hazine Hisarı.',
  },
  {
    timeSec: 180,
    locationId: 'genel-bakis',
    camPos: [160, 175, 260],
    lookAt: [60, 28, -20],
    timeOfDay: 22.0,
    season: 'Kış',
    weather: 'Açık',
    title: '10/10 · Dersaadet Gecesi ve Kandiller',
    narration:
      'Ay ışığı altında Haliç ve Marmara\'da yansıyan kandiller, aydınlanan sokaklar ve kubbelerle tarihî İstanbul\'a veda.',
  },
];

export function evaluateTourAtTime(elapsedSec: number): {
  camPos: [number, number, number];
  lookAt: [number, number, number];
  timeOfDay: number;
  season: TourKeyframe['season'];
  weather: TourKeyframe['weather'];
  title: string;
  narration: string;
  progress: number;
} {
  const totalDuration = GUIDED_TOUR_KEYFRAMES[GUIDED_TOUR_KEYFRAMES.length - 1].timeSec;
  const clamped = Math.max(0, Math.min(totalDuration, elapsedSec));
  let idx = 0;
  for (let i = 0; i < GUIDED_TOUR_KEYFRAMES.length - 1; i++) {
    if (clamped >= GUIDED_TOUR_KEYFRAMES[i].timeSec && clamped <= GUIDED_TOUR_KEYFRAMES[i + 1].timeSec) {
      idx = i;
      break;
    }
  }
  const a = GUIDED_TOUR_KEYFRAMES[idx];
  const b = GUIDED_TOUR_KEYFRAMES[Math.min(GUIDED_TOUR_KEYFRAMES.length - 1, idx + 1)];
  const span = Math.max(0.001, b.timeSec - a.timeSec);
  const rawT = (clamped - a.timeSec) / span;
  const t = rawT * rawT * (3 - 2 * rawT);

  const camPos: [number, number, number] = [
    a.camPos[0] + (b.camPos[0] - a.camPos[0]) * t,
    a.camPos[1] + (b.camPos[1] - a.camPos[1]) * t,
    a.camPos[2] + (b.camPos[2] - a.camPos[2]) * t,
  ];
  const lookAt: [number, number, number] = [
    a.lookAt[0] + (b.lookAt[0] - a.lookAt[0]) * t,
    a.lookAt[1] + (b.lookAt[1] - a.lookAt[1]) * t,
    a.lookAt[2] + (b.lookAt[2] - a.lookAt[2]) * t,
  ];
  const timeOfDay = a.timeOfDay + (b.timeOfDay - a.timeOfDay) * t;

  return {
    camPos,
    lookAt,
    timeOfDay,
    season: a.season,
    weather: a.weather,
    title: a.title,
    narration: a.narration,
    progress: clamped / totalDuration,
  };
}

/**
 * Axis-Aligned Bounding Box (AABB) representing the specific footprint of a 3D building or wall segment.
 */
export interface BuildingAABB {
  id?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Creates a BuildingAABB from center (cx, cz) and full dimensions (width W along X, depth D along Z).
 */
export function createBoxAABB(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  id?: string
): BuildingAABB {
  const hw = Math.abs(width) * 0.5;
  const hd = Math.abs(depth) * 0.5;
  return {
    id,
    minX: cx - hw,
    maxX: cx + hw,
    minZ: cz - hd,
    maxZ: cz + hd,
  };
}

/**
 * Resolves 2D circle-vs-AABB overlap so a player/agent of given radius never clips inside a rectangular building footprint.
 */
export function resolveCircleAABB(
  px: number,
  pz: number,
  radius: number,
  box: BuildingAABB
): { x: number; z: number; collided: boolean } {
  const closestX = Math.max(box.minX, Math.min(px, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
  const dx = px - closestX;
  const dz = pz - closestZ;
  const distSq = dx * dx + dz * dz;

  // Case 1: Player center is strictly inside or on the boundary of the AABB
  if (distSq < 1e-9) {
    const penLeft = px - box.minX;
    const penRight = box.maxX - px;
    const penTop = pz - box.minZ;
    const penBottom = box.maxZ - pz;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);

    if (minPen === penLeft) {
      return { x: box.minX - radius, z: pz, collided: true };
    }
    if (minPen === penRight) {
      return { x: box.maxX + radius, z: pz, collided: true };
    }
    if (minPen === penTop) {
      return { x: px, z: box.minZ - radius, collided: true };
    }
    return { x: px, z: box.maxZ + radius, collided: true };
  }

  // Case 2: Player bounding circle overlaps the exterior of the AABB
  if (distSq < radius * radius) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    return {
      x: px + (dx / dist) * push,
      z: pz + (dz / dist) * push,
      collided: true,
    };
  }

  return { x: px, z: pz, collided: false };
}

/**
 * Iteratively resolves a player's circle against an array of BuildingAABBs, preventing corner-clipping.
 */
export function resolveMultiAABBCollisions(
  px: number,
  pz: number,
  radius: number,
  colliders: readonly BuildingAABB[],
  iterations = 3
): { x: number; z: number; hitCount: number } {
  let curX = px;
  let curZ = pz;
  let hitCount = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let anyHitInPass = false;
    for (let i = 0; i < colliders.length; i++) {
      const res = resolveCircleAABB(curX, curZ, radius, colliders[i]);
      if (res.collided) {
        curX = res.x;
        curZ = res.z;
        anyHitInPass = true;
        hitCount++;
      }
    }
    if (!anyHitInPass) break;
  }

  return { x: curX, z: curZ, hitCount };
}

/**
 * Clips a 2D camera segment from (targetX, targetZ) to (camX, camZ) against BuildingAABBs using slab intersection
 * so the 3rd-person camera never clips behind or inside a building wall.
 */
export function clipCameraSegmentAgainstAABBs(
  targetX: number,
  targetZ: number,
  camX: number,
  camZ: number,
  colliders: readonly BuildingAABB[],
  margin = 0.45
): { x: number; z: number; clipped: boolean; t: number } {
  const dx = camX - targetX;
  const dz = camZ - targetZ;
  const segLen = Math.hypot(dx, dz);
  if (segLen < 1e-5) {
    return { x: camX, z: camZ, clipped: false, t: 1 };
  }

  let minT = 1.0;
  let clipped = false;

  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    // Expand box by camera margin
    const minX = b.minX - margin;
    const maxX = b.maxX + margin;
    const minZ = b.minZ - margin;
    const maxZ = b.maxZ + margin;

    // Skip if target itself is inside the expanded box (handled by player collision)
    if (targetX > minX && targetX < maxX && targetZ > minZ && targetZ < maxZ) {
      continue;
    }

    let tmin = 0.0;
    let tmax = 1.0;

    if (Math.abs(dx) < 1e-8) {
      if (targetX < minX || targetX > maxX) continue;
    } else {
      const invDx = 1.0 / dx;
      let t1 = (minX - targetX) * invDx;
      let t2 = (maxX - targetX) * invDx;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    }

    if (Math.abs(dz) < 1e-8) {
      if (targetZ < minZ || targetZ > maxZ) continue;
    } else {
      const invDz = 1.0 / dz;
      let t1 = (minZ - targetZ) * invDz;
      let t2 = (maxZ - targetZ) * invDz;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    }

    if ( tmax >= tmin && tmin >= 0 && tmin < minT ) {
      minT = Math.max(0.12, tmin - 0.02);
      clipped = true;
    }
  }

  return {
    x: targetX + dx * minT,
    z: targetZ + dz * minT,
    clipped,
    t: minT,
  };
}

/**
 * Qibla bearing from Istanbul (41.0082°N, 28.9784°E) to Mecca (21.4225°N, 39.8262°E) is ~151.6° SSE.
 */
export const ISTANBUL_QIBLA_DEG = 151.6;
export const ISTANBUL_QIBLA_RAD = (ISTANBUL_QIBLA_DEG * Math.PI) / 180;

/**
 * Validates and sanitizes camera fly-to target coordinates so invalid/NaN/null targets never crash
 * and always clamp safely above terrain, falling back to an aerial overview when needed.
 */
export function sanitizeFlyTarget(
  pos: readonly [number, number, number] | null | undefined,
  camOffset: readonly [number, number, number] | null | undefined,
  minTerrainAtLook = 1.0,
  minTerrainAtCam = 1.0
): {
  valid: boolean;
  usedFallback: boolean;
  targetLook: [number, number, number];
  targetPos: [number, number, number];
} {
  const isFiniteTriple = (arr: readonly [number, number, number] | null | undefined): arr is readonly [number, number, number] =>
    Array.isArray(arr) &&
    arr.length === 3 &&
    Number.isFinite(arr[0]) &&
    Number.isFinite(arr[1]) &&
    Number.isFinite(arr[2]);

  if (!isFiniteTriple(pos) || !isFiniteTriple(camOffset)) {
    return {
      valid: false,
      usedFallback: true,
      targetLook: [35, 18, -5],
      targetPos: [170, 263, 390],
    };
  }

  const safeLookY = Math.max(Number.isFinite(minTerrainAtLook) ? minTerrainAtLook + 1.5 : 2.5, pos[1]);
  const rawCamX = pos[0] + camOffset[0];
  const rawCamY = pos[1] + camOffset[1];
  const rawCamZ = pos[2] + camOffset[2];
  const safeCamY = Math.max(
    (Number.isFinite(minTerrainAtCam) ? minTerrainAtCam : 1.0) + 4.0,
    rawCamY
  );

  return {
    valid: true,
    usedFallback: false,
    targetLook: [
      Math.max(-680, Math.min(820, pos[0])),
      Math.max(1.5, Math.min(620, safeLookY)),
      Math.max(-480, Math.min(520, pos[2])),
    ],
    targetPos: [
      Math.max(-680, Math.min(820, rawCamX)),
      Math.max(4.5, Math.min(640, safeCamY)),
      Math.max(-480, Math.min(520, rawCamZ)),
    ],
  };
}

/**
 * Analytic Two-Bone Foot IK & Slope Adaptation Solver for Player and Near-LOD NPCs.
 * Computes hip/knee flexion angles via Law of Cosines, foot pitch/roll from terrain normal,
 * pelvis lowering to reach the lower foot, torso slope lean, uphill/downhill stride scaling,
 * and distance-based LOD weight.
 */
export interface FootIKSolution {
  ikWeight: number;
  hipPitch: number;
  kneeFlex: number;
  footPitch: number;
  footRoll: number;
  pelvisDrop: number;
  torsoLeanX: number;
  torsoLeanZ: number;
  strideScale: number;
  plantedFootY: number;
}

export function solveTwoBoneFootIK(
  hipWorldY: number,
  thighLen: number,
  calfLen: number,
  footGroundY: number,
  otherFootGroundY: number,
  slopeDz: number,
  slopeDx: number,
  speed: number,
  lodDistance: number
): FootIKSolution {
  // Smooth LOD blend: full IK within 32m, fades to 0 by 78m
  const ikWeight = Math.max(0, Math.min(1, (78 - lodDistance) / (78 - 32)));
  const maxReach = Math.max(0.05, (thighLen + calfLen) * 0.992);
  const minReach = Math.max(0.05, Math.abs(thighLen - calfLen) + 0.02);

  // Lower pelvis toward whichever foot is on lower ground on slopes
  const heightDiff = Math.max(0, Math.min(0.32, Math.abs(footGroundY - otherFootGroundY)));
  const pelvisDrop = heightDiff * 0.65 * ikWeight;

  const effectiveHipY = hipWorldY - pelvisDrop;
  const legSpan = Math.max(minReach, Math.min(maxReach, effectiveHipY - footGroundY));

  // Law of Cosines for two-bone chain (thigh a, calf b, distance c = legSpan)
  const a = Math.max(0.05, thighLen);
  const b = Math.max(0.05, calfLen);
  const c = legSpan;

  const cosHip = Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c)));
  const cosKnee = Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)));

  const hipPitch = -Math.acos(cosHip) * ikWeight;
  // Exterior knee bend angle (0 when straight, positive when flexed)
  const kneeFlex = (Math.PI - Math.acos(cosKnee)) * ikWeight;

  // Foot rotation aligned to terrain slope normal
  const clampedSlopeZ = Math.max(-0.55, Math.min(0.55, slopeDz));
  const clampedSlopeX = Math.max(-0.45, Math.min(0.45, slopeDx));
  const footPitch = Math.atan(clampedSlopeZ) * ikWeight;
  const footRoll = Math.atan(clampedSlopeX) * ikWeight;

  // Torso leans forward uphill and stabilizes downhill
  const speedFactor = Math.min(1.5, Math.max(0.2, speed));
  const torsoLeanX = clampedSlopeZ * 0.42 * speedFactor * ikWeight;
  const torsoLeanZ = -clampedSlopeX * 0.25 * ikWeight;

  // Shorten stride uphill (slopeDz > 0), widen stride slightly downhill (slopeDz < 0)
  const strideScale =
    clampedSlopeZ > 0
      ? Math.max(0.68, 1 - clampedSlopeZ * 0.55)
      : Math.min(1.24, 1 - clampedSlopeZ * 0.38);

  return {
    ikWeight,
    hipPitch,
    kneeFlex,
    footPitch,
    footRoll,
    pelvisDrop,
    torsoLeanX,
    torsoLeanZ,
    strideScale,
    plantedFootY: footGroundY,
  };
}

/**
 * Computes the 5 daily Islamic prayer times + Sunrise (Güneş) for Istanbul (~41°N) by season.
 */
export interface IstanbulPrayerSchedule {
  imsak: number; // Sabah / İmsak
  gunes: number; // Güneş doğuşu
  ogle: number; // Öğle (Zuhr / Cuma)
  ikindi: number; // İkindi (Asr)
  aksam: number; // Akşam (Maghrib)
  yatsi: number; // Yatsı (Isha)
}

export function computeIstanbulPrayerTimes(
  season: 'Bahar' | 'Yaz' | 'Sonbahar' | 'Kış'
): IstanbulPrayerSchedule {
  switch (season) {
    case 'Yaz':
      return { imsak: 3.75, gunes: 5.5, ogle: 13.15, ikindi: 17.1, aksam: 20.65, yatsi: 22.45 };
    case 'Kış':
      return { imsak: 6.45, gunes: 8.1, ogle: 13.2, ikindi: 15.65, aksam: 17.85, yatsi: 19.35 };
    case 'Sonbahar':
      return { imsak: 5.4, gunes: 6.95, ogle: 13.0, ikindi: 16.25, aksam: 18.85, yatsi: 20.3 };
    case 'Bahar':
    default:
      return { imsak: 4.85, gunes: 6.35, ogle: 13.1, ikindi: 16.65, aksam: 19.6, yatsi: 21.15 };
  }
}

export type PrayerStage = 'none' | 'qiyam' | 'ruku' | 'secde' | 'oturus';

export function getNextPrayerStatus(
  timeOfDay: number,
  season: 'Bahar' | 'Yaz' | 'Sonbahar' | 'Kış',
  isFriday = false
): {
  schedule: IstanbulPrayerSchedule;
  currentOrLastName: string;
  nextName: string;
  nextHour: number;
  minutesUntilNext: number;
  ezanActive: boolean;
  congregationActive: boolean;
  activePrayerName: string | null;
  prayerStage: PrayerStage;
} {
  const schedule = computeIstanbulPrayerTimes(season);
  const hour = ((timeOfDay % 24) + 24) % 24;

  const vakitList: Array<{ key: keyof IstanbulPrayerSchedule; name: string; h: number; isSalat: boolean }> = [
    { key: 'imsak', name: 'Sabah', h: schedule.imsak, isSalat: true },
    { key: 'gunes', name: 'Güneş', h: schedule.gunes, isSalat: false },
    { key: 'ogle', name: isFriday ? 'Öğle (Cuma)' : 'Öğle', h: schedule.ogle, isSalat: true },
    { key: 'ikindi', name: 'İkindi', h: schedule.ikindi, isSalat: true },
    { key: 'aksam', name: 'Akşam', h: schedule.aksam, isSalat: true },
    { key: 'yatsi', name: 'Yatsı', h: schedule.yatsi, isSalat: true },
  ];

  let nextIdx = vakitList.findIndex((v) => v.h > hour);
  let nextItem = nextIdx >= 0 ? vakitList[nextIdx] : vakitList[0];
  let currentItem =
    nextIdx > 0 ? vakitList[nextIdx - 1] : vakitList[vakitList.length - 1];

  let diffHours = nextItem.h - hour;
  if (diffHours < 0) diffHours += 24;
  const minutesUntilNext = Math.max(0, Math.round(diffHours * 60));

  let ezanActive = false;
  let congregationActive = false;
  let activePrayerName: string | null = null;
  let prayerStage: PrayerStage = 'none';

  for (const v of vakitList) {
    if (!v.isSalat) continue;
    let sinceStart = hour - v.h;
    if (sinceStart < -12) sinceStart += 24;
    // Ezan lasts for ~0.12 game hours (~7 min), congregation prayer lasts ~0.48 game hours (~29 min)
    if (sinceStart >= 0 && sinceStart <= 0.14) {
      ezanActive = true;
    }
    if (sinceStart >= 0 && sinceStart <= 0.48) {
      congregationActive = true;
      activePrayerName = v.name;
      const cycle = (sinceStart / 0.12) % 1;
      if (cycle < 0.38) prayerStage = 'qiyam';
      else if (cycle < 0.56) prayerStage = 'ruku';
      else if (cycle < 0.80) prayerStage = 'secde';
      else prayerStage = 'oturus';
      break;
    }
  }

  return {
    schedule,
    currentOrLastName: currentItem.name,
    nextName: nextItem.name,
    nextHour: nextItem.h,
    minutesUntilNext,
    ezanActive,
    congregationActive,
    activePrayerName,
    prayerStage,
  };
}

/**
 * Rulers, Viziers, and Palace/State Officials with Daily Schedules & Period Dress.
 */
export interface HistoricalRulerDefinition {
  id: string;
  name: string;
  title: string;
  headgear: 'sultan_kavuk' | 'vezir_kalevi' | 'ilmiye_urf' | 'bork' | 'baltaci' | 'kizlaragasi';
  kaftanColor: number;
  robeTrimColor: number;
  scale: number;
  bio: string;
  retinueCount: number;
}

export const RULERS_AND_VIZIERS: readonly HistoricalRulerDefinition[] = [
  {
    id: 'kanuni-suleyman',
    name: 'Kanuni Sultan Süleyman Han',
    title: 'Onuncu Osmanlı Padişahı ve Halife-i Rûy-i Zemîn (1520–1566)',
    headgear: 'sultan_kavuk',
    kaftanColor: 0x991b1b,
    robeTrimColor: 0xf5c542,
    scale: 1.18,
    bio: 'Kırk altı yıllık saltanatında imparatorluğu adalet kanunnameleri, seferler ve Mimar Sinan külliyeleriyle zirveye taşıyan Cihan Padişahı.',
    retinueCount: 4,
  },
  {
    id: 'rustem-pasa',
    name: 'Sadrazam Damad Rüstem Paşa',
    title: 'Veziriazam ve Mühr-i Hümâyûn Sahibi',
    headgear: 'vezir_kalevi',
    kaftanColor: 0x1e3a8a,
    robeTrimColor: 0xd4af37,
    scale: 1.12,
    bio: 'Kanuni Sultan Süleyman ve Hürrem Sultan’ın kızı Mihrimah Sultan’ın eşi; devlet hazinesini ve Divan-ı Hümâyûn’u dirayetle yöneten Sadrazam.',
    retinueCount: 2,
  },
  {
    id: 'sokollu-mehmed',
    name: 'İkinci Kubbe Veziri Sokollu Mehmed Paşa',
    title: 'Divan-ı Hümâyûn Kubbealtı Veziri',
    headgear: 'vezir_kalevi',
    kaftanColor: 0x065f46,
    robeTrimColor: 0xd4af37,
    scale: 1.11,
    bio: 'Kubbealtı Divanı’nın kıdemli veziri; devletin dış siyaset ve donanma işlerinde başmüşavir.',
    retinueCount: 1,
  },
  {
    id: 'piyale-pasa',
    name: 'Kapudan-ı Derya Piyale Paşa',
    title: 'Osmanlı Donanması Başkomutanı ve Cezayir Beylerbeyi',
    headgear: 'vezir_kalevi',
    kaftanColor: 0x0f766e,
    robeTrimColor: 0xf5c542,
    scale: 1.11,
    bio: 'Akdeniz’de Osmanlı donanmasını zaferden zafere taşıyan, Haliç Tersanesi ve Eminönü Kadırga Limanı’nı denetleyen Kapudan Paşa.',
    retinueCount: 2,
  },
  {
    id: 'sehzade-selim',
    name: 'Şehzade Selim (II. Selim)',
    title: 'Saruhan / Kütahya Sancakbeyi ve Veliaht Şehzade',
    headgear: 'sultan_kavuk',
    kaftanColor: 0x7c2d12,
    robeTrimColor: 0xf0cf65,
    scale: 1.1,
    bio: 'Kanuni Sultan Süleyman ve Hürrem Sultan’ın oğlu; payitaht ziyaretlerinde Topkapı Sarayı ve Süleymaniye merasimlerinde hazır bulunur.',
    retinueCount: 2,
  },
  {
    id: 'sehzade-bayezid',
    name: 'Şehzade Bayezid',
    title: 'Osmanlı Şehzadesi ve Şair (“Şâhî”)',
    headgear: 'sultan_kavuk',
    kaftanColor: 0x4338ca,
    robeTrimColor: 0xf0cf65,
    scale: 1.1,
    bio: 'İlim ve şiir meclisleriyle tanınan Osmanlı şehzadesi; Enderun ve At Meydanı çevresinde maiyetiyle görülür.',
    retinueCount: 2,
  },
  {
    id: 'ebussuud-efendi',
    name: 'Şeyhülislam Ebussuud Efendi',
    title: 'Müftiyyü’l-Enâm ve Osmanlı Baş Müftüsü (1545–1574)',
    headgear: 'ilmiye_urf',
    kaftanColor: 0xf8fafc,
    robeTrimColor: 0x065f46,
    scale: 1.11,
    bio: 'Kanuni’nin kanunnamelerini İslam hukukuyla telif eden, Süleymaniye Camii’nin temel taşını koyan büyük âlim ve müfessir.',
    retinueCount: 2,
  },
  {
    id: 'kizlaragasi',
    name: 'Darüssaâde / Harem Ağası Cafer Ağa',
    title: 'Harem-i Hümâyûn ve Bâbüssaâde Başağası',
    headgear: 'kizlaragasi',
    kaftanColor: 0x881337,
    robeTrimColor: 0xf5c542,
    scale: 1.11,
    bio: 'Harem-i Hümâyûn, Enderun ve Haremeyn vakıflarının idaresinden sorumlu yüksek saray görevlisi.',
    retinueCount: 1,
  },
  {
    id: 'baltacilar-kethudasi',
    name: 'Zülüflü Baltacılar Kethüdası Sinan Ağa',
    title: 'Teberdârân-ı Hâssa (Zülüflü Baltacılar) Ocağı Zabiti',
    headgear: 'baltaci',
    kaftanColor: 0xb91c1c,
    robeTrimColor: 0xd4af37,
    scale: 1.1,
    bio: 'Kubbealtı, Harem dış koridorları ve Bâbüsselâm çevresinin güvenliğini sağlayan zülüflü muhafız ocağı komutanı.',
    retinueCount: 2,
  },
  {
    id: 'bostancibasi',
    name: 'Bostancıbaşı Ferhad Ağa',
    title: 'Sarayburnu Hasbahçe ve Boğaziçi Sahil Muhafızı',
    headgear: 'bork',
    kaftanColor: 0xb91c1c,
    robeTrimColor: 0x15803d,
    scale: 1.12,
    bio: 'Topkapı Sarayı Hasbahçeleri, Sur-ı Sultani kıyı kapıları ve Hünkâr saltanat kayığının baş sorumlusu.',
    retinueCount: 2,
  },
  {
    id: 'yeniceri-agasi',
    name: 'Yeniçeri Ağası الداماد Ali Ağa',
    title: 'Dergâh-ı Âlî Yeniçeri Ocağı Başkomutanı',
    headgear: 'bork',
    kaftanColor: 0x991b1b,
    robeTrimColor: 0xf5c542,
    scale: 1.13,
    bio: 'Payitahtın asayişinden, Divan muhafızlığından ve Cuma selamlığı alay düzeninden sorumlu Yeniçeri Ağası.',
    retinueCount: 3,
  },
  {
    id: 'cavusbasi',
    name: 'Divan-ı Hümâyûn Çavuşbaşısı ve Solak Muhafızlar',
    title: 'Bâb-ı Hümâyûn ve Bâbüsselâm Merasim Muhafızları',
    headgear: 'bork',
    kaftanColor: 0x1e3a8a,
    robeTrimColor: 0xf5c542,
    scale: 1.1,
    bio: 'Gümüş çevganları ve sorguçlu börkleriyle Divan-ı Hümâyûn elçilerini karşılayan ve saray kapılarında nöbet tutan merasim bölüğü.',
    retinueCount: 3,
  },
];

export interface HistoricalScheduleState {
  activityText: string;
  locationName: string;
  worldPos: [number, number, number];
  isIndoors: boolean;
  interiorId: string | null;
  interiorPos: [number, number, number];
  pose: 'idle' | 'walk' | 'sit' | 'pray' | 'bow';
  facingYawRad: number;
}

export function getHistoricalFigureSchedule(
  figureId: string,
  timeOfDay: number,
  isFriday = false
): HistoricalScheduleState {
  const h = ((timeOfDay % 24) + 24) % 24;

  // 1. Kanuni Sultan Süleyman
  if (figureId === 'kanuni-suleyman') {
    if (h >= 4.7 && h < 6.2) {
      return {
        activityText: 'Şimdi: Enderun Hırka-i Saadet Dairesinde sabah namazı ve Kur’an tilaveti',
        locationName: 'Topkapı Sarayı · Has Oda (III. Avlu)',
        worldPos: [372, 22, -12],
        isIndoors: true,
        interiorId: 'topkapi-sarayi',
        interiorPos: [8.0, 0, -6.0],
        pose: 'pray',
        facingYawRad: ISTANBUL_QIBLA_RAD,
      };
    }
    if (h >= 7.5 && h < 11.2) {
      return {
        activityText: 'Şimdi: Kasr-ı Adl altın kafesli penceresinden Kubbealtı Divan toplantısını dinliyor',
        locationName: 'Topkapı Sarayı · Kubbealtı / Kasr-ı Adl',
        worldPos: [351, 22, -18.5],
        isIndoors: true,
        interiorId: 'topkapi-sarayi',
        interiorPos: [-11.0, 0, -13.2],
        pose: 'sit',
        facingYawRad: 0, // Facing south into Divan room
      };
    }
    if (isFriday && h >= 11.8 && h < 14.2) {
      return {
        activityText: 'Şimdi: Süleymaniye Camii’nde Cuma Selamlığı alayı ve Cuma namazı',
        locationName: 'Süleymaniye Camii Hünkâr Mahfili',
        worldPos: [62, 37, -38],
        isIndoors: h >= 12.6 && h <= 13.7,
        interiorId: 'suleymaniye',
        interiorPos: [-6.0, 0, -9.5],
        pose: h >= 12.6 && h <= 13.7 ? 'pray' : 'walk',
        facingYawRad: ISTANBUL_QIBLA_RAD,
      };
    }
    if (h >= 11.2 && h < 14.5) {
      return {
        activityText: 'Şimdi: Bâbüssaâde ardındaki Arz Odası’nda Taht-ı Hümâyûn üzerinde elçi ve vezir kabulü',
        locationName: 'Topkapı Sarayı · Arz Odası',
        worldPos: [372.5, 22, -8],
        isIndoors: true,
        interiorId: 'topkapi-sarayi',
        interiorPos: [5.5, 0.55, -11.5],
        pose: 'sit',
        facingYawRad: 0, // Facing south toward petitioners
      };
    }
    if (h >= 14.5 && h < 18.2) {
      return {
        activityText: 'Şimdi: Dördüncü Avlu mermer terasında ve İftariye kameriyesinde Haliç’i temaşa ve avlu gezintisi',
        locationName: 'Topkapı Sarayı · IV. Avlu ve Hasbahçe Terası',
        worldPos: [378, 22, -22],
        isIndoors: false,
        interiorId: null,
        interiorPos: [0, 0, 0],
        pose: 'walk',
        facingYawRad: -0.6,
      };
    }
    return {
      activityText: 'Şimdi: Harem-i Hümâyûn Hünkâr Sofası’nda Muhibbî mahlasıyla divan şiiri telifi ve dinlenme',
      locationName: 'Topkapı Sarayı · Harem-i Hümâyûn',
      worldPos: [365, 22, -28.5],
      isIndoors: true,
      interiorId: 'topkapi-sarayi',
      interiorPos: [5.5, 0.55, -11.5],
      pose: 'sit',
      facingYawRad: 0,
    };
  }

  // 2. Sadrazam Rüstem Paşa & 3. Sokollu Mehmed Paşa
  if (figureId === 'rustem-pasa' || figureId === 'sokollu-mehmed') {
    const isRustem = figureId === 'rustem-pasa';
    if (h >= 7.0 && h < 11.5) {
      return {
        activityText: 'Şimdi: Kubbealtı Divan-ı Hümâyûn sedirinde devlet işlerini ve mühimme defterlerini müzakere ediyor',
        locationName: 'Topkapı Sarayı · II. Avlu Kubbealtı Divanı',
        worldPos: [isRustem ? 350 : 353, 22, -18],
        isIndoors: true,
        interiorId: 'topkapi-sarayi',
        interiorPos: [isRustem ? -11.0 : -8.2, 0, -13.6],
        pose: 'sit',
        facingYawRad: 0, // Seated facing room center (+Z)
      };
    }
    if (h >= 11.5 && h < 13.0) {
      return {
        activityText: 'Şimdi: Matbah-ı Âmire’den gelen divan sofrasında vezirlerle öğle yemeği ve Arz Odası’na arz hazırlığı',
        locationName: 'Topkapı Sarayı · II. Avlu Divan Meydanı',
        worldPos: [isRustem ? 352 : 356, 22, -4],
        isIndoors: false,
        interiorId: null,
        interiorPos: [0, 0, 0],
        pose: 'walk',
        facingYawRad: 1.57,
      };
    }
    if (h >= 13.0 && h < 14.5) {
      return {
        activityText: 'Şimdi: Arz Odası’nda Padişah huzurunda divan kararlarını arz ediyor',
        locationName: 'Topkapı Sarayı · Arz Odası',
        worldPos: [370, 22, -8],
        isIndoors: true,
        interiorId: 'topkapi-sarayi',
        interiorPos: [isRustem ? 3.2 : 7.8, 0, -7.5],
        pose: 'bow',
        facingYawRad: Math.PI, // Facing the Sultan's throne (-Z)
      };
    }
    return {
      activityText: isRustem
        ? 'Şimdi: Eminönü ve Tahtakale’de inşa ettirdiği Rüstem Paşa Külliyesi ve hanlarını teftiş ediyor'
        : 'Şimdi: Bâb-ı Hümâyûn ve Ayasofya meydanında İkindi divanı dönüşü',
      locationName: isRustem ? 'Eminönü · Tahtakale' : 'Ayasofya Meydanı',
      worldPos: isRustem ? [162, 8, -72] : [316, 24, 18],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'walk',
      facingYawRad: 0.4,
    };
  }

  // 4. Kapudan-ı Derya Piyale Paşa
  if (figureId === 'piyale-pasa') {
    if (h >= 7.5 && h < 11.2) {
      return {
        activityText: 'Şimdi: Kubbealtı Divanı’nda Akdeniz donanma seferlerini ve Tersane-i Âmire bütçesini görüşüyor',
        locationName: 'Topkapı Sarayı · Kubbealtı',
        worldPos: [355, 22, -18],
        isIndoors: true,
        interiorId: 'topkapi-sarayi',
        interiorPos: [-13.6, 0, -13.6],
        pose: 'sit',
        facingYawRad: 0,
      };
    }
    return {
      activityText: 'Şimdi: Eminönü Gümrük İskelesi’nde Osmanlı kadırgalarını ve bahriye leventlerini denetliyor',
      locationName: 'Eminönü Limanı',
      worldPos: [178, 6, -82],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'walk',
      facingYawRad: 3.14,
    };
  }

  // 5. Şehzade Selim & 6. Şehzade Bayezid
  if (figureId === 'sehzade-selim' || figureId === 'sehzade-bayezid') {
    const isSelim = figureId === 'sehzade-selim';
    if (h >= 9.0 && h < 12.5) {
      return {
        activityText: 'Şimdi: Enderun-ı Hümâyûn mektebinde ve III. Avlu kütüphanesinde tarih ve siyasetname dersi',
        locationName: 'Topkapı Sarayı · III. Avlu (Enderun)',
        worldPos: [isSelim ? 375 : 379, 22, isSelim ? -4 : 4],
        isIndoors: false,
        interiorId: null,
        interiorPos: [0, 0, 0],
        pose: 'walk',
        facingYawRad: isSelim ? 0.5 : -0.5,
      };
    }
    return {
      activityText: isSelim
        ? 'Şimdi: At Meydanı ve İbrahim Paşa Sarayı önünde cirit ve okçuluk talimini izliyor'
        : 'Şimdi: Şehzadebaşı Külliyesi ve Bozdoğan Kemeri çevresinde alay gezintisi',
      locationName: isSelim ? 'At Meydanı (Hipodrom)' : 'Şehzade Külliyesi',
      worldPos: isSelim ? [258, 24, 52] : [-24, 31, -4],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'walk',
      facingYawRad: 1.1,
    };
  }

  // 7. Şeyhülislam Ebussuud Efendi
  if (figureId === 'ebussuud-efendi') {
    if (h >= 12.2 && h < 14.5) {
      return {
        activityText: 'Şimdi: Süleymaniye Camii mihrabında cemaate namaz kıldırıyor ve tefsir dersi veriyor',
        locationName: 'Süleymaniye Camii Harimi',
        worldPos: [62, 37, -38],
        isIndoors: true,
        interiorId: 'suleymaniye',
        interiorPos: [0, 0, -13.5],
        pose: 'pray',
        facingYawRad: ISTANBUL_QIBLA_RAD,
      };
    }
    return {
      activityText: 'Şimdi: Süleymaniye Medreseleri avlusunda müderrislerle fetva ve kanunname müzakeresi',
      locationName: 'Süleymaniye Külliyesi Avlusu',
      worldPos: [48, 37, -38],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'walk',
      facingYawRad: ISTANBUL_QIBLA_RAD,
    };
  }

  // 8. Kızlarağası, 9. Baltacılar, 10. Bostancıbaşı, 11. Yeniçeri Ağası, 12. Çavuşlar ve Muhafızlar
  if (figureId === 'kizlaragasi') {
    return {
      activityText: 'Şimdi: Bâbüssaâde (Ak Ağalar Kapısı) ve Harem-i Hümâyûn girişinde nöbet ve teşrifat denetimi',
      locationName: 'Topkapı Sarayı · Bâbüssaâde ve Harem Kapısı',
      worldPos: [362, 22, -12],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'idle',
      facingYawRad: -Math.PI / 2,
    };
  }
  if (figureId === 'baltacilar-kethudasi') {
    return {
      activityText: 'Şimdi: Zülüflü Baltacılar bölüğüyle Kubbealtı ve Harem dış koridorunda muhafızlık',
      locationName: 'Topkapı Sarayı · II. Avlu Kubbealtı Önü',
      worldPos: [348, 22, -12],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'idle',
      facingYawRad: 0,
    };
  }
  if (figureId === 'bostancibasi') {
    return {
      activityText: 'Şimdi: Sarayburnu Hasbahçe sahilini ve Sur-ı Sultani kulelerini teftiş ediyor',
      locationName: 'Topkapı Sarayı · Sarayburnu Hasbahçe',
      worldPos: [384, 18, -4],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'walk',
      facingYawRad: 1.57,
    };
  }
  if (figureId === 'yeniceri-agasi') {
    return {
      activityText:
        h >= 7.5 && h < 11.5
          ? 'Şimdi: II. Avlu’da ulufe ve çorba merasimi için Yeniçeri ortalarını denetliyor'
          : 'Şimdi: Bâb-ı Hümâyûn ve Divanyolu’nda kapıkulu devriyesine komuta ediyor',
      locationName: 'Topkapı Sarayı · Alay Meydanı ve Bâbüsselâm',
      worldPos: [336, 22, -2],
      isIndoors: false,
      interiorId: null,
      interiorPos: [0, 0, 0],
      pose: 'idle',
      facingYawRad: -Math.PI / 2,
    };
  }

  // Default: Divan Çavuşbaşısı ve Solak Muhafızlar at Bâb-ı Hümâyûn / Bâbüsselâm
  return {
    activityText: 'Şimdi: Bâb-ı Hümâyûn ve Orta Kapı (Bâbüsselâm) önünde merasim düzeninde nöbet tutuyor',
    locationName: 'Topkapı Sarayı · Bâb-ı Hümâyûn',
    worldPos: [321, 22, 12],
    isIndoors: false,
    interiorId: null,
    interiorPos: [0, 0, 0],
    pose: 'idle',
    facingYawRad: -Math.PI / 2, // Facing west toward incoming visitors at gate
  };
}

/**
 * PDF Architectural Scale Conversion Table (Kanuni Dönemi Suriçi Maket Rehberi):
 * Converts a real-world metric dimension (in meters) to model centimeters across
 * the 4 standard PDF scales: 1:2000 (Suriçi Genel), 1:500 (Külliye), 1:200 (Tek Yapı), 1:20 (Başoda İç Mekân).
 */
export function convertPdfScaleMeasurement(realMeters: number): {
  realMeters: number;
  scale1to2000Cm: number;
  scale1to500Cm: number;
  scale1to200Cm: number;
  scale1to20Cm: number;
} {
  const m = Number.isFinite(realMeters) && realMeters > 0 ? realMeters : 0;
  // 1 meter = 100 cm; in scale 1:S, cm = (m * 100) / S
  return {
    realMeters: m,
    scale1to2000Cm: Number(((m * 100) / 2000).toFixed(3)),
    scale1to500Cm: Number(((m * 100) / 500).toFixed(3)),
    scale1to200Cm: Number(((m * 100) / 200).toFixed(3)),
    scale1to20Cm: Number(((m * 100) / 20).toFixed(3)),
  };
}

/**
 * 1546 Tarihli İstanbul Vakıfları Tahrir Defteri (Barkan & Ayverdi) 13 Nahiye Dağılımı
 */
export interface Nahiye1546Record {
  no: number;
  center: string;
  mahalleCount: number;
  vakifCount: number;
  keyStructures: string;
}

export const PDF_1546_NAHIYELER: Nahiye1546Record[] = [
  { no: 1, center: 'Ayasofya-i Kebîr', mahalleCount: 14, vakifCount: 247, keyStructures: 'Ayasofya Camii, Medresesi, Haseki Çifte Hamamı (75 m), İshak Paşa Külliyesi' },
  { no: 2, center: 'Sultan باyezid', mahalleCount: 16, vakifCount: 300, keyStructures: 'II. Bayezid Külliyesi, Eski Saray (Sarây-ı Atîk), Cevâhir ve Sandal Bedestenleri' },
  { no: 3, center: 'Eminönü / Mahmud Paşa', mahalleCount: 15, vakifCount: 280, keyStructures: 'Mahmud Paşa Külliyesi, Rüstem Paşa Camii, Tahtakale Hanları, Gümrük İskeleleri' },
  { no: 4, center: 'Atik Ali Paşa / Çemberlitaş', mahalleCount: 8, vakifCount: 165, keyStructures: 'Atik Ali Paşa Külliyesi, Elçi Hanı (37×37 m avlu), Çemberlitaş, Tavukpazarı' },
  { no: 5, center: 'İbrahim Paşa / Atmeydanı', mahalleCount: 12, vakifCount: 190, keyStructures: 'İbrahim Paşa Sarayı (140 m cephe, 4 avlu), Firuz Ağa Camii, Binbirdirek Sarnıcı' },
  { no: 6, center: 'Zeyrek / Vefa / Şehzade', mahalleCount: 18, vakifCount: 260, keyStructures: 'Şehzade Külliyesi, Süleymaniye Külliyesi, Bozdoğan Kemeri, Molla Zeyrek Camii' },
  { no: 7, center: 'Fatih (Ebû’l-Feth Sultan Mehmed)', mahalleCount: 32, vakifCount: 486, keyStructures: 'Fatih Camii (1470 özgün plan), 8 Sahn-ı Semân + 8 Tetimme, Saraçhane (116 dükkân)' },
  { no: 8, center: 'Sultan Selim / Çukurbostan', mahalleCount: 19, vakifCount: 210, keyStructures: 'Yavuz Sultan Selim Külliyesi (24,35×24,30 m), Aspar Açık Sarnıcı, Fener mahalleleri' },
  { no: 9, center: 'Edirnekapı / Kariye', mahalleCount: 17, vakifCount: 185, keyStructures: 'Edirnekapı Mihrimah Sultan Külliyesi (37 m kubbe), Kariye Camii, Eğrikapı Maksemi' },
  { no: 10, center: 'Aksaray / Haseki / Langa', mahalleCount: 20, vakifCount: 230, keyStructures: 'Haseki Hürrem Sultan Külliyesi (Sekizgen Darüşşifa), Murad Paşa Camii, Langa Bostanı' },
  { no: 11, center: 'Davud Paşa / Hekimoğlu', mahalleCount: 14, vakifCount: 145, keyStructures: 'Davud Paşa Külliyesi (1485), Çukurbostan (Mocius Açık Sarnıcı), bostanlar' },
  { no: 12, center: 'Koca Mustafa Paşa / Samatya', mahalleCount: 18, vakifCount: 160, keyStructures: 'Koca Mustafa Paşa Külliyesi, İmrahor İlyas Bey Camii, Samatya balıkçı iskeleleri' },
  { no: 13, center: 'Yedikule / Silivrikapı', mahalleCount: 16, vakifCount: 120, keyStructures: 'Yedikule Hisarı, Altınkapı, Hadım İbrahim Paşa Camii (1551), debbağhâneler' },
];



