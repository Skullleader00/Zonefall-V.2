/* ═══════════════════════════════════════════════════════════════
   ZONEFALL · RIFT LOBBY — data layer
   ชั้นนี้ไม่แต่งคอนเทนต์ใหม่: อ่านจากตัวเกมจริงใน game/js/data.js
   (rulebook Dev V.24 · สแกนการ์ด 52 ใบ SB01/SD01/SD04 · เอนจิน + AI)
   แล้วเพิ่มเฉพาะข้อมูลที่ lobby ต้องใช้: เกรดสำหรับร้านค้า, อีเวนต์,
   cosmetic, โค้ดรับรางวัล, โควตา/ข้อจำกัดแรงก์, และโน้ตสมดุลที่ค้างอยู่
   ═══════════════════════════════════════════════════════════════ */
const ZF = { ver: '1.1', series: 'Z SERIES · DEV V.24', game: 'game/index.html' };

/* ── faction = สีประจำเด็ค (ไอคอนใช้ไฟล์จริงจากเกม) ───────────── */
ZF.factions = [
  { id: 'Yellow', icon: 'thronis',       en: 'THRONIS · CELESTIAL',  th: 'ทรอนิส · สวรรค์',       hue: 'Deity · Sacred Power ·Ascend' },
  { id: 'Blue',   icon: 'aegis',         en: 'AEGIS · MACHINA',      th: 'อีจิส · แมไคนา',         hue: 'Machine · Operation · Repair' },
  { id: 'Red',    icon: 'ashen',         en: 'ASHEN · HELLFIRE',     th: 'แอสเชน · นรกไฟ',         hue: 'Fiend · Dragon · Magical' },
  { id: 'Green',  icon: 'verdant',       en: 'VERDANT · SYLVAN',     th: 'เวอร์แดนท์ · Sylvan',    hue: 'Sylvan · Insect · Beast · Plant' },
  { id: 'Purple', icon: 'nyx-horizon',   en: 'NYX HORIZON · VOID',   th: 'นิกซ์ ฮอไรซัน · สูญตา',  hue: 'Witch · Vampire · Esper · Void' },
  { id: 'Colorless',icon:'aegis',         en: 'OUTLAND · NEUTRAL',    th: 'เอาแลนด์ · กลาง',        hue: 'Protection · Generic' }
];
ZF.tones = () => ({ Yellow: '#f2c744', Blue: '#4ea8ff', Red: '#ff6a4d', Green: '#5fd66f', Purple: '#b48cff', Colorless: '#a8b6d4' });
ZF.tone = c => (COLORS[c] || { tone: '#a8b6d4' }).tone;
ZF.fac = c => ZF.factions.find(f => f.id === c) || ZF.factions[5];

/* ── เกรด = ใช้เฉพาะระบบซอง/คลังของ lobby (ไม่ใช่ rarity บนพิมพ์) ─ */
ZF.grade = c => (c.cost >= 9 ? 'G4' : c.cost >= 6 ? 'G3' : c.cost >= 4 ? 'G2' : 'G1');
ZF.gradeLabel = { G1: 'Standard', G2: 'Advanced', G3: 'Premium', G4: 'Elite Ace' };
ZF.ODDS = { G1: 46, G2: 33, G3: 16, G4: 5 };

/* ── sets / booster packs (อ้างอิงชุดสแกนจริง) ────────────────── */
ZF.sets = { SB01: 'Starter Battle Vol.1', SD01: 'Starter Deck · Verdant Sylvan', SD04: 'Starter Deck · Blue Machina' };
ZF.packs = [
  { id: 'P-SB01', set: 'SB01', no: 'SB01', en: 'Starter Battle Vol.1 Booster', th: 'ซอง Starter Battle Vol.1',
    price: 200, five: 900, ten: 1500, c1: '#d8ff4d', c2: '#39e6ff',
    desc: { en: '5 cards from SB01 · 22 cards in set · guarantee 1 [Trigger] or 6+ cost.',
            th: '5 ใบจากชุด SB01 · ในชุดมี 22 ใบ · การันตี 1 ใบที่เป็น [Trigger] หรือ Cost 6 ขึ้นไป' } },
  { id: 'P-SD01', set: 'SD01', no: 'SD01', en: 'Verdant Sylvan Pack', th: 'ซอง Verdant Sylvan (เขียว)',
    price: 250, five: 1100, ten: 1900, c1: '#5fd66f', c2: '#f2c744',
    desc: { en: '5 cards from SD01 · the Sylvan/Green spine incl. multiTerrain cards.',
            th: '5 ใบจาก SD01 ·แกนเขียว/Sylvan รวมทั้งใบ terrain ที่ไม่กินโควตา' } },
  { id: 'P-SD04', set: 'SD04', no: 'SD04', en: 'Blue Machina Pack', th: 'ซอง Blue Machina (น้ำเงิน)',
    price: 250, five: 1100, ten: 1900, c1: '#4ea8ff', c2: '#b48cff',
    desc: { en: '5 cards from SD04 · Machina/Blue spine: drone economy + repair.',
            th: '5 ใบจาก SD04 ·แกนน้ำเงิน/Machina: โดรนเศรษฐกิจ + การ์ดซ่อม' } },
  { id: 'P-MIX', set: null, no: 'Z-04', en: 'Rift Draft Boost', th: 'ซอง drafted Rift',
    price: 400, five: 1800, ten: 3400, c1: '#b48cff', c2: '#ff6a4d',
    desc: { en: '5 cards across all three sets · current pulled odds + foil alt window.',
            th: '5 ใบรวมสามชุด · อัตราตามของจริง + ช่องอาร์ตฟอยล์' } }
];

/* ── อีเวนต์ (อ้างอิงสถานะสมดุลจริงที่ค้างอยู่ใน README) ──────── */
ZF.events = [
  { id: 'EV-01', status: 'live', kind: { en: 'Premier · Ranked', th: 'เพียร์ · แรงก์' },
    name: { en: 'ZONEFALL RIFT OPEN · DEV V.24', th: 'ZONEFALL RIFT OPEN · DEV V.24' },
    blurb: { en: 'Solo vs AI premier on the shipped engine (52 real cards, Arcanum disabled). Best of 3, same deck list each game.',
            th: 'แข่ง Solo vs AI บนเอนจินจริง (การ์ด 52 ใบ, ปิด Arcanum ตามคำสั่ง) · Bo3 ใช้เด็คเดิมทุกเกม' },
    date: '2026-11-08T14:00', venue: 'Online · PWA client', fee: 1500, prize: 120000, format: 'BO3 · 7.Core-Point',
    slots: { used: 186, cap: 256 }, restrict: 'Dev V.24 quota · no rework cards',
    rules: { en: 'Deck 40–60 · [Protection] ≤6 · main colour ≥50% · one secondary colour · Extra Zone main colour only.',
            th: 'เด็ค 40–60 ใบ · [Protection] ≤6 · สีหลัก ≥50% · คู่สีรอง 1 สี · Extra Zone ต้องสีหลักเท่านั้น' },
    prizes: [{ place: '1st', coins: 60000, extra: { en: 'Foil alt “Diomedium, Hero of the Celestial Realm”', th: 'ฟอยล์ alt “Diomedium, Hero of the Celestial Realm”' } },
             { place: 'Top 8', coins: 20000, extra: { en: 'field theme unlock', th: 'ปลดล็อกฉากสนาม' } },
             { place: 'ทุก 5 ชัยชนะ', coins: 5000, extra: { en: '3× SB01 packs', th: 'ซอง SB01 3 ซอง' } }] },

  { id: 'EV-02', status: 'open', kind: { en: 'Balance Test', th: 'ทดสอบสมดุล' },
    name: { en: 'FIRST-PLAYER HANDICAP LAB', th: 'แล็บทดสอบสิทธิ์ผู้เริ่มก่อน' },
    blurb: { en: 'Known open issue on build v1.4: the side that moves first wins ~78–83% in mirror. The lab runs three handicaps and reports which one you prefer.',
            th: 'ประเด็นที่ยังค้างใน build v1.4: ฝั่งเริ่มก่อนชนะราว 78–83% ใน mirror · แล็บนี้ทดสอบ 3 วิธีแก้ แล้วโหวตว่าชอบแบบไหน' },
    date: '2026-11-15T20:00', venue: 'Online · auto (seeded)', fee: 0, prize: 40000, format: 'BO1 × 6 (seeded)',
    slots: { used: 74, cap: 128 }, restrict: 'official decks only',
    rules: { en: 'Variants: (a) second player +1 Flare on turn 1 · (b) second player picks Core Zone side · (c) keep rulebook “no first draw”.',
            th: 'ตัวเลือก: (a) ฝั่งหลังได้ +1 Flare เทิร์นแรก · (b) ฝั่งหลังเลือกฝั่ง Core Zone · (c) คงกติกา “ไม่จั่วเทิร์นแรก”' },
    prizes: [{ place: 'ครบ 6 เกม', coins: 8000, extra: { en: 'data contribution + Beta card preview', th: 'ร่วมส่งข้อมูล + พรีวิวการ์ด Beta' } }] },

  { id: 'EV-03', status: 'soon', kind: { en: 'Clinic', th: 'คลาสสอนเล่น' },
    name: { en: 'ROOKIE SURGE · CORE POINT CLINIC', th: 'ROOKIE SURGE · คลาส Core Point' },
    blurb: { en: 'Learn the loop: 7 Core Point, Flare 3→8, declare/response, persistent power, Trigger Check.',
            th: 'เรียนรู้ลูปเกม: Core Point 7, Flare 3→8, ประกาศ-ตอบโต้, พลังค้าง(trade), Trigger Check' },
    date: '2026-11-02T11:00', venue: 'Discord Voice · Stage 3', fee: 0, prize: 8000, format: 'Workshop + 2 rounds',
    slots: { used: 52, cap: 80 }, restrict: 'Open (SD01/SD04 preset allowed)',
    prizes: [{ place: 'Every entrant', coins: 4000, extra: { en: 'free legal deck + 10 packs', th: 'เด็คถูกกติกา + ซอง 10' } }] },

  { id: 'EV-04', status: 'soon', kind: { en: 'Deck Check', th: 'ตรวจเด็ค' },
    name: { en: 'DECKCHECK GAUNTLET', th: 'DECKCHECK GAUNTLET' },
    blurb: { en: 'Bring a deck that passes test/deckcheck.js, then face three escalating AI decks (Sylvan → Machina → mixed).',
            th: 'เอาเด็คที่ผ่าน test/deckcheck.js มา แล้วเจอ AI สามระดับ (Sylvan → Machina → ผสม)' },
    date: '2026-11-22T13:00', venue: 'Online · auto', fee: 2500, prize: 90000, format: 'Gauntlet · BO1',
    slots: { used: 61, cap: 96 }, restrict: 'Dev V.24 quota', prizes:
    [{ place: '3 wins', coins: 30000, extra: { en: 'unlock SD04 foil set', th: 'ปลดล็อกฟอยล์ SD04' } }] },

  { id: 'EV-05', status: 'done', kind: { en: 'Qualifier', th: 'คัดเลือก' },
    name: { en: 'MACHINA QUALIFIER #4', th: 'MACHINA QUALIFIER #4' },
    blurb: { en: 'Closed. SD04 list archetype took 3 of the top 4 — flagged for the balance lab.',
            th: 'ปิดแล้ว · เด็คสาย SD04 เข้า Top 4 ถึง 3 อันดับ → ส่งเข้าแล็บสมดุล' },
    date: '2026-10-25T14:00', venue: 'Online', fee: 1000, prize: 30000, format: 'Swiss 4', slots: { used: 128, cap: 128 }, restrict: 'Dev V.24',
    prizes: [{ place: '1st', coins: 18000 }] },

  { id: 'EV-06', status: 'live', kind: { en: 'Casual', th: 'กันเอง' },
    name: { en: 'OPEN RIFT · FREE MIRROR', th: 'OPEN RIFT · mirror อิสระ' },
    blurb: { en: 'Always open room: mirror or cross-set decks, no fee, coins on every win.',
            th: 'ห้องเปิดตลอด · mirror หรือข้ามชุดก็ได้ · ไม่มีค่าเข้า มี coin ทุกชัยชนะ' },
    date: '2026-12-01T00:00', venue: 'Auto · Anytime', fee: 0, prize: 0, format: 'BO1 casual', slots: { used: 812, cap: 2000 }, restrict: 'Dev V.24',
    prizes: [{ place: 'Each win', coins: 250 }] }
];

/* ── ข้อจำกัด/แบน (แรงก์ + อีเวนต์) — อ้างใบจริงใน set ─────────── */
ZF.ban = [
  { id: 'sd01010', lim: 2, note: { en: 'Shield Guard — free battle-cancel + back-move warpsDeclare/Response tempo.', th: 'Shield Guard · กันล้างความเสียหายจากการต่อสู้ + เลื่อนกลับ ทำให้หน้าต่างตอบโต้เสียจังหวะ' } },
  { id: 'sd04003', lim: 2, note: { en: 'Operation: Vanguard Surge — two-row ready plus Trigger stacks.', th: 'Operation: Vanguard Surge · ทำให้ยูนิตพร้อมสู้ 2 แถว + มี [Trigger]' } },
  { id: 'sb01016', lim: 1, note: { en: 'Oskopus, Otherworldly Anomaly — cost 10 / 3000 CP with free Action loop.', th: 'Oskopus, Otherworldly Anomaly · Cost 10 พลัง 3000 พร้อม Action วนได้' } },
  { id: 'sb01001', lim: 1, note: { en: 'Diomedium — Ascend/Merge + point gain; one copy only in Premier.', th: 'Diomedium · Ascend/Merge แล้วนับคะแนน · ใช้ได้ 1 ใบในPremier' } }
];

/* ── known open items (จาก README ของโปรเจกต์) ────────────────── */
ZF.openIssues = [
  { t: { en: 'First-player advantage', th: 'ฝั่งเริ่มก่อนได้เปรียบ' }, d: { en: 'Mirror win rate ≈ 78–83% for the player who moves first; the rulebook “second player skips the first draw” makes it worse. Three fixes under test in EV-02.', th: 'ใน mirror ฝั่งเริ่มก่อนชนะราว 78–83% และกฎ “ฝั่งหลังไม่จั่วเทิร์นแรก” ซ้ำเติมอีก · กำลังทดสอบ 3 วิธีในอีเวนต์ EV-02' } },
  { t: { en: 'SD04 above SD01', th: 'เด็ค SD04 เหนือกว่า SD01' }, d: { en: 'Cross-set games still favour the Blue Machina plan. Balance owner decision pending.', th: 'เกมข้ามชุดเด็คน้ำเงิน Machina ยังเหนือกว่า · รอเจ้าของเกมตัดสินใจ' } },
  { t: { en: 'Auto-built demo decks', th: 'เด็คตัวอย่างที่ระบบประกอบให้' }, d: { en: 'Official DECKS are generated lists, not necessarily what the team plays. Submit your list through the deck board and it appears in the engine picker.', th: 'DECKS ทางการเป็นรายการที่ระบบเรียงให้ อาจไม่ใช่เด็คที่ทีมใช้จริง · ส่งเด็คผ่านแผงเด็คแล้วจะโผล่ใน dropdown ของเอนจินจริง' } },
  { t: { en: 'handCostReduce counters', th: 'ตัวนับของ handCostReduce' }, d: { en: 'Agrony / Ahenla count “terrain destroyed this turn”. Confirm against the paper rulebook wording.', th: 'Agrony / Ahenal นับ “Terrain ที่ถูกทำลายในเทิร์นนี้” · โปรดยืนยันถ้อยคำจากรulebook จริง' } }
];

/* ── cosmetic: ใช้ asset จริงของเกม ──────────────────────────── */
ZF.skins = [
  { id: 'FIELD-BLUE', type: 'field', en: 'สนามคราม · Blue Field', th: 'สนามคราม · Blue Field', price: 0, img: 'game/assets/bg/field-blue.jpg' },
  { id: 'FIELD-GREEN', type: 'field', en: 'สนามมุข · Sylvan Field', th: 'สนามมุข · Sylvan Field', price: 1400, img: 'game/assets/bg/field-green.jpg' },
  { id: 'FIELD-RED', type: 'field', en: 'สนามอัคนี · Ashen Field', th: 'สนามอัคนี · Ashen Field', price: 1400, img: 'game/assets/bg/field-red.jpg' },
  { id: 'AV-Y', type: 'avatar', en: 'Avatar · Thronis', th: 'อวตาร · ทรอนิส', price: 600, img: 'game/assets/faction/thronis.png' },
  { id: 'AV-B', type: 'avatar', en: 'Avatar · Aegis', th: 'อวตาร · อีจิส', price: 600, img: 'game/assets/faction/aegis.png' },
  { id: 'AV-R', type: 'avatar', en: 'Avatar · Ashen', th: 'อวตาร · แอสเชน', price: 600, img: 'game/assets/faction/ashen.png' },
  { id: 'AV-G', type: 'avatar', en: 'Avatar · Verdant', th: 'อวตาร · เวอร์แดนท์', price: 600, img: 'game/assets/faction/verdant.png' },
  { id: 'AV-P', type: 'avatar', en: 'Avatar · Nyx Horizon', th: 'อวตาร · นิกซ์ ฮอไรซัน', price: 600, img: 'game/assets/faction/nyx-horizon.png' },
  { id: 'SLV-KRAFT', type: 'sleeve', en: 'Sleeve · Kraft Hex', th: 'ปลอก · Kraft Hex', price: 800, c1: '#12303a', c2: '#d8ff4d' },
  { id: 'SLV-VOID', type: 'sleeve', en: 'Sleeve · Nyx Void', th: 'ปลอก · Nyx Void', price: 800, c1: '#1b1330', c2: '#b48cff' },
  { id: 'FRM-HEX', type: 'frame', en: 'Cost ring · Hex', th: 'วง Cost · Hex', price: 500, c1: '#f2c744' },
  { id: 'FRM-BLEED', type: 'frame', en: 'Cost ring · Bleed', th: 'วง Cost · Bleed', price: 900, c1: '#ff6a4d' }
];
ZF.tiers = [
  { id: 'Z0', en: 'ZONE 0 · DRIFTER', th: 'โซน 0 · ผู้เร่ร่อน', pts: 0 },
  { id: 'Z2', en: 'ZONE 2 · SCAVENGER', th: 'โซน 2 · นักเก็บของ', pts: 400 },
  { id: 'Z4', en: 'ZONE 4 · RIFTWALKER', th: 'โซน 4 · ผู้เดินรอยแยก', pts: 1000 },
  { id: 'Z6', en: 'ZONE 6 · WARFRAME', th: 'โซน 6 · เกราะสงคราม', pts: 1800 },
  { id: 'Z8', en: 'ZONE 8 · CHOIRMASTER', th: 'โซน 8 · จ้าวบทเพลง', pts: 2800 },
  { id: 'Z10', en: 'ZONE 10 · PRISM', th: 'โซน 10 · พริซึม', pts: 4000 }
];

/* ── โค้ดรับรางวัล (ให้ใบจริงตาม id) ─────────────────────────── */
ZF.codes = {
  'ZONEFALL-V24': { coins: 6000, packs: { 'P-SB01': 4 }, cards: ['sd01010', 'sd04010'], note: { en: 'Dev V.24 launch gift', th: 'ของขวัญเปิด V.24' } },
  'SYLVAN-ROOT': { coins: 1500, packs: { 'P-SD01': 2 }, cards: ['sd01007'] },
  'MACHINA-DRIVE': { coins: 1500, packs: { 'P-SD04': 2 }, cards: ['sd04004'] },
  'DIO-OFFICIAL': { cards: ['sb01001'], note: { en: 'Ascend ace from the official list', th: 'ใบ Ascend จากลิสต์ทางการ' } },
  'ROOKIE-DECK': { coins: 2500, packs: { 'P-MIX': 2 } }
};

/* ── กติกาที่ lobby แสดง (สรุปจากรulebook V.24 + README) ─────── */
ZF.rules = [
  { h: { en: 'Objective', th: 'เป้าหมาย' }, b: { en: 'Collect 7 Core Point. Each unit you control standing in the Core Zone (row 3) counts 1 at your End Phase. A player who cannot draw also loses.', th: 'เก็บ Core Point ให้ครบ 7 · นับยูนิตที่คุณครองใน Core Zone (แถว 3) ตอน End Phase ใบละ 1 · และถ้าฝ่ายตรง จั่วไม่ได้ก็แพ้ทันที' } },
  { h: { en: 'Board · 5 rows × 3 columns', th: 'สนาม · 5 แถว × 3 ช่อง' }, b: { en: 'Your back row (5) is where units/commands enter; row 4 is your front line; row 3 is the shared Core Zone; rows 2–1 belong to the opponent. Units may not enter the enemy back row. Terrain does not block movement.', th: 'แถวหลังของคุณ (5) ใช้ลงยูนิต/Command · แถว 4 เป็นแนวหน้า · แถว 3 คือ Core Zone กลาง · แถว 2–1 เป็นฝั่งศัตรู · ยูนิตห้ามเข้าแถวหลังศัตรู · Terrain ไม่บล็อกทางเดิน' } },
  { h: { en: 'Flare', th: 'Flare' }, b: { en: 'Start at 3 Flare, +1 on each of your turns, ceiling 8. It does not carry over. Attacks cost 1 Flare; some cards give free attacks or reduce cost.', th: 'เริ่ม 3 Flare แล้ว +1 ทุกเทิร์นของคุณจนถึง 8 · ไม่สะสมข้ามเทิร์น · โจมตีใช้ 1 Flare · บางใบทำให้โจมตีฟรีหรือลดคอสต์' } },
  { h: { en: 'One action per unit · persistent power', th: '1 แอ็คต่อยูนิิต · พลังค้าง' }, b: { en: 'A unit does one thing per turn (move 1 space free, attack, or an [Action]/[Activate] ability). Combat subtracts attacker CP from defender CP; at 0 the unit is Outzoned and the attacker pays nothing. Power resets at the start of the turn.', th: 'ยูนิต 1 ตัวทำอะไร 1 อย่างต่อเทิร์น (เดิน 1 ช่องฟรี / โจมตี / [Action]·[Activate]) · การต่อสู้เอา CP ผู้โจมตีไปลบ CP ผู้ป้องกัน เหลือ 0 = Outzone โดยผู้โจมตีไม่เสียพลัง · พลังรีเซ็ตต้นเทิร์น' } },
  { h: { en: 'Declare → Response window', th: 'หน้าต่างประกาศ → ตอบโต้' }, b: { en: 'Every action opens one response window for the opponent. [Quick-Cast] / [Counter] cards in hand (such as Shield Guard, Barrier, Null Magic) can be paid there; unit [Counter] triggers before [Attack]. No chains.', th: 'ทุกแอ็คเปิดหน้าต่างให้อีกฝ่ายตอบโต้ 1 ครั้ง · การ์ด [Quick-Cast]/[Counter] ในมือ (Shield Guard, Barrier, Null Magic) ใช้ตรงนั้นได้ · [Counter] ของยูนิตทำงานก่อน [Attack] · ไม่มี chain' } },
  { h: { en: 'End Phase · Trigger Check', th: 'End Phase · Trigger Check' }, b: { en: 'Count Core Point → opponent Trigger Check (the top card rises with a flash + buzz and its owner chooses: use the effect or keep it in hand) → specified Terrain fades → check 7 points → pass the turn and repeat.', th: 'นับ Core Point →ฝั่งตรงข้าม Trigger Check (การ์ดบนสุดเด้งขึ้น + สั่นสั้น ๆ เจ้าของเลือก “ใช้เอฟเฟกต์” หรือ “เก็บขึ้นมือ”) → Terrain ที่ระบุสลาย → เช็ค 7 แต้ม → ส่งเทิร์น' } },
  { h: { en: 'Field quotas & hand', th: 'โควตาบนสนามและมือ' }, b: { en: 'Units ≤ 4 on the field · Terrain ≤ 1 (cards marked multiTerrain such as the Sylvan pair don’t consume it) · a unit may be placed over a Terrain space · hand ≤ 10 (excess is Removezoned) · Outzone / Removezone / Extra Zone are all public.', th: 'ยูนิต ≤ 4 · Terrain ≤ 1 (ใบที่ระบุ multiTerrain เช่นคู่ Sylvan ไม่กินโควตา) · ยูนิตวางทับช่องที่มี Terrain ได้ · มือ ≤ 10 (เกิน → Removezone) · Outzone / Removezone / Extra Zone เปิดดูได้หมด' } },
  { h: { en: 'Deck construction (checked live)', th: 'การจัดเด็ค (มีตัวตรวจ)' }, b: { en: '40–60 cards in the main deck · ≤3 copies per name · main colour ≥ 50% of the list · at most one secondary colour · [Protection] cards ≤ 6 · Extra Zone ≤ 5 and only main colour / Colorless.', th: 'เด็คหลัก 40–60 ใบ · ซ้ำชื่อละ ≤3 · สีหลัก ≥ ครึ่งของเด็ค · คู่สีรองได้ 1 สี · [Protection] ≤ 6 · Extra Zone ≤ 5 และต้องเป็นสีหลัก/Colorless เท่านั้น' } }
];
ZF.keywords = {
  'On Play': 'เมื่อลงสนาม (Deploy)', 'Activate': 'กดใช้ (มีต้นทุน)', 'Cont': 'ผลต่อเนื่องขณะอยู่บนสนาม',
  'Trigger': 'Trigger Check ตอน End Phase', 'Attack': 'ผลเมื่อโจมตี', 'Counter': 'ตอบโต้ในหน้าต่างฝั่งตรงข้าม',
  'Quick-Cast': 'ร่ายในหน้าต่างตอบโต้', 'Action': 'แอ็คเสริม 1 ครั้ง/เทิร์น', 'Passive': 'ผลถาวรอัตโนมัติ',
  'Cast': 'ร่ายจากมือ', 'Ascend': 'วางทับยูนิตเพื่อ Ascend/Merge', 'Fused': 'สถานะหลัง Ascend'
};
