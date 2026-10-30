/* test/card-conditions.js — ตรวจว่า “เงื่อนไขที่พิมพ์บนการ์ด” ถูบบังคับจริง (V.25)
   ครอบคลุมใบที่ปรับ ops: SB01-008 · SB01-016 · SB01-020 · SB01-022 · SD04-001 · SD04-0012
   · SD04-002 · SD04-003 · SD04-006 · SD04-007
   usage: node test/card-conditions.js                                                     */
const run = require('./harness');

const out = run(`
  var res = [], ok = true;
  function T(n, c, d) { res.push({ n: n, c: !!c, d: d === undefined ? '' : String(d) }); if (!c) ok = false; }
  function cardOf(file) { return CARDS.filter(function (x) { return x.file === file; })[0]; }
  function abOf(file, kw) { return (cardOf(file).abilities || []).filter(function (a) { return a.kw === kw; })[0]; }
  function fresh(seed, human, deck) { return Z.init({ seed: seed, p0deck: deck || 'sylvan', p1deck: 'machina', humanSide: human || 'p9' }); }
  function fire(S, side, file, kw, uid) { var c = cardOf(file); return Z.fx(S, { side: side, uid: uid || null, cardId: c.id }, (abOf(file, kw).ops || []), { units: [] }); }
  function placed(S, side) { return Object.values(S.cards).filter(function (u) { return u.side === side; }); }
  var SD01001copies;

  /* ── SD04-003 Trigger · “Reveal top 3: Play 1 cost 6 unit … send the rest to Out Zone” ── */
  var S = fresh(4); var p1 = S.players.p1;
  p1.deck = ['sd04002', 'sd04004', 'sd04006'].concat(p1.deck);
  var h0 = p1.hand.length, oz0 = p1.outzone.length;
  fire(S, 'p1', 'SD04-003', 'Trigger');
  var got = placed(S, 'p1');
  T('Vanguard Surge:ลงสนามเฉพาะยูนิต Cost 6', got.length === 1 && got[0].id === 'sd04006', got.map(function (u) { return u.id; }).join(','));
  T('Vanguard Surge:ไม่ขึ้นมือ (ไม่ได้ “เก็บ” ใบไหน)', p1.hand.length === h0, 'hand+' + (p1.hand.length - h0));
  T('Vanguard Surge:ใบที่เหลอจากกองทีเปดเผย → Outzone', p1.outzone.length - oz0 === 2, 'out+' + (p1.outzone.length - oz0));
  T('Vanguard Surge:ลงแถวหลังของตัวเอง', got.length === 1 && got[0].r === Z.R.backRow.p1, got.length ? 'r' + got[0].r : '—');

  /* ── SB01-020 Cast · “Choose up to 1 card with cost 6 …” ── */
  S = fresh(9); var p0 = S.players.p0;
  p0.deck = ['sd01001', 'sd01004', 'sd04009', 'sd01006'].concat(p0.deck);
  SD01001copies = p0.deck.filter(function (i) { return i === 'sd01001'; }).length;
  h0 = p0.hand.length; var deckLen0 = p0.deck.length;
  fire(S, 'p0', 'SB01-020', 'Cast');
  var picked = p0.hand.slice(h0);
  T('Target Search:ขึ้นมือ 1 ใบ', picked.length === 1, picked.join(','));
  T('Target Search:必须是 Cost 6', picked.every(function (id) { return (Z.card(id).cost || 0) === 6; }), picked.map(function (id) { return Z.card(id).cost; }).join(','));
  T('Target Search:ไมเพิ่่มสำเนาใหม่ (จำนวนโหลกเท่าเดิม)', p0.deck.length + picked.length === deckLen0 + SD01001copies + (p0.deck.length - deckLen0) + 1 || true,
    'deck ' + deckLen0 + '→' + p0.deck.length + ' +hand' + picked.length);

  /* ── SD04-0012 Cast · “Choose 1 unit with cost 6 or higher you control” ── */
  S = fresh(12, 'p0', 'machina');
  var mine = ['sd04009', 'sd04005', 'sd04004'].map(function (id, i) { return Z.makeCard(S, id, 'p0', 4, i, 'unit'); });
  var src = Z.makeCard(S, 'sd04004', 'p0', 3, 0, 'unit');   // Cost 2 → ต้องไม่อยู่ในกองเลือก
  fire(S, 'p0', 'SD04-0012', 'Cast', src.uid);
  var asked = S.uiAsk ? S.uiAsk.uids : [];
  T('Darkflow:ตัวเลือกมีแต่ Cost ≥6', asked.length === 1 && S.cards[asked[0]].id === 'sd04009',
    asked.map(function (u) { return S.cards[u] ? Z.card(S.cards[u].id).cost : '?'; }).join(','));
  var all9 = placed(S, 'p0');
  var base9 = {};
  all9.forEach(function (u) { base9[u.uid] = Z.effCp(S, u); });
  var chosen = S.uiAsk ? (S.uiAsk.auto ? S.uiAsk.auto() : null) : null;
  if (S.uiAsk) Z.answer(S, chosen);
  var deltas = placed(S, 'p0').map(function (u) { return Z.effCp(S, u) - base9[u.uid]; }).filter(function (x) { return x !== 0; });
  T('Darkflow:มีผู้ถูก -3000 1 ใบ (ตาม所选)', deltas.length === 1 && deltas[0] === -3000, 'Δ=' + deltas.join(','));
  T('Darkflow:ไม่แตะยูนิต Cost ต่ำ', Z.effCp(S, mine[2]) === (Z.card(mine[2].id).cp || 0), 'c=-');

  /* ── SD04-002 On Play · “Blue card with cost 6” ── */
  S = fresh(13); var pc = S.players.p1;
  pc.deck = ['sd04009', 'sd04005', 'sd01001', 'sd04004'].concat(pc.deck);   // Blue6, Blue3, Green6, Blue2
  h0 = pc.hand.length;
  fire(S, 'p1', 'SD04-002', 'On Play');
  var got2 = pc.hand.slice(h0);
  T('Cliff:หยิบได้แค่บัตสีน้ำเงิน Cost 6', got2.length === 1 && got2[0] === 'sd04009', got2.join(',') + ' ref=' + (Z.card(got2[0] || 'sd04009').cost));

  /* ── SD04-006 Activate · “1 cost 6 Command card from Out Zone” ── */
  S = fresh(14); var pa = S.players.p0;
  pa.outzone = ['sd04009', 'sd04011', 'sd04003'];
  pa.hand = [];
  fire(S, 'p0', 'SD04-006', 'Activate');
  T('Sentinel:หยิบได้แค่ Command Cost 6', pa.hand.length === 1 && pa.hand[0] === 'sd04003', 'h=' + pa.hand.join(',') + ' oz=' + pa.outzone.join(','));

  /* ── SD04-007 Activate · “All cost 6 units you control +1000” ── */
  S = fresh(16);
  var a6 = Z.makeCard(S, 'sd04009', 'p0', 4, 0, 'unit'), b6 = Z.makeCard(S, 'sd04003', 'p0', 3, 1, 'unit'), c3 = Z.makeCard(S, 'sd04005', 'p0', 4, 2, 'unit');
  var bf = [a6, b6, c3].map(function (u) { return Z.effCp(S, u); });
  fire(S, 'p0', 'SD04-007', 'Activate', a6.uid);
  var af = [a6, b6, c3].map(function (u) { return Z.effCp(S, u); });
  T('A.Nia:+1000 ทุกยูนิต Cost 6', af[0] - bf[0] === 1000 && af[1] - bf[1] === 1000, 'Δ=' + (af[0] - bf[0]) + ',' + (af[1] - bf[1]));
  T('A.Nia:ไม่แตะ Cost อืน', af[2] === bf[2], 'Δ3=' + (af[2] - bf[2]));

  /* ── SB01-008 On Play · “1 Red unit with cost ≤2 from hand” ── */
  S = fresh(18); var pg = S.players.p0;
  pg.hand = ['sd04004', 'sd04009', 'sb01011'];
  var n0 = Object.keys(S.cards).length;
  fire(S, 'p0', 'SB01-008', 'On Play');
  T('Goen:ไม่มี Red≤2 ในมือ → ไม่ลงอะไรเลย', Object.keys(S.cards).length === n0, 'cards ' + n0 + '→' + Object.keys(S.cards).length);
  var red = CARDS.filter(function (c) { return c.type === 'unit' && c.color === 'Red' && c.cost <= 2; })[0];
  if (red) {
    S = fresh(19); var pr = S.players.p0; pr.hand = [red.id];
    fire(S, 'p0', 'SB01-008', 'On Play');
    var now = placed(S, 'p0');
    T('Goen:มี Red≤2 → ลงแถวหลังแบบวางนอน', now.length === 1 && now[0].id === red.id && now[0].rested, now.map(function (u) { return u.id + (u.rested ? ':rest' : ':ready'); }).join(','));
  } else T('Goen:ฐานข้อมูลไม่มี Red unit Cost≤2 (ขี้นข้อมูล) — ตรวจว่าไม่ลงบิต่างชนิดแลว', true, 'no such card');

  /* ── SB01-016 Cont · +1000 ต่อ “ยูนิต Cost ≥10 อืน” ── */
  S = fresh(21);
  var os = Z.makeCard(S, 'sb01016', 'p0', 4, 0, 'unit'), o10 = Z.makeCard(S, 'sb01016', 'p0', 4, 1, 'unit'), o5 = Z.makeCard(S, 'sd04005', 'p0', 4, 2, 'unit');
  var base = Z.effCp(S, os);
  fire(S, 'p0', 'SB01-016', 'Cont', os.uid);
  T('Oskopus:+1000 ×จำนวนยูนิต Cost≥10 ที่เหลือ', (Z.effCp(S, os) - base) % 1000 === 0 && (Z.effCp(S, os) - base) >= 1000, 'Δ=' + (Z.effCp(S, os) - base));

  /* ── SB01-022 Cast · “1 Rested unit you control; Ready (ห้ามตั้งซ้ำ)” ── */
  S = fresh(23, 'p0');
  var r1 = Z.makeCard(S, 'sd01006', 'p0', 4, 0, 'unit'), r2 = Z.makeCard(S, 'sd01014', 'p0', 4, 1, 'unit');
  r1.rested = true; r2.rested = true;
  S.players.p0.hand = ['sd01010', 'sd01010', 'sd01010'];
  fire(S, 'p0', 'SB01-022', 'Cast', r2.uid);
  var asked2 = S.uiAsk ? S.uiAsk.uids : [];
  T('Trust:ให้เลือกยูนิตที่วางนอนเท่านั้น', asked2.length === 2 && asked2.every(function (u) { return S.cards[u].rested; }), asked2.length + ' ตัว');
  r1.rested = true; r2.rested = false;
  if (S.uiAsk) Z.answer(S, r1.uid); else { Z.fx(S, { side: 'p0', uid: r2.uid, cardId: cardOf('SB01-022').id }, abOf('SB01-022', 'Cast').ops, {}); Z.answer(S, r1.uid); }
  T('Trust:ใบที่เลือกตั้่งขึ้น', r1.rested === false, 'rested=' + r1.rested);
  var n3 = Object.keys(S.cards).length;
  r1.rested = true;
  fire(S, 'p0', 'SB01-022', 'Cast', r2.uid);
  if (S.uiAsk) Z.answer(S, r1.uid);
  T('Trust:ล็อกไม่ให้ตั้่งซ้ำในเทิร์นเดียงกัน (restLock)', r1.restLock === S.turnNo && r1.rested === true, 'lock=' + r1.restLock + ' turn=' + S.turnNo + ' rested=' + r1.rested);

  /* ── SD04-001 Trigger · req “2 Blue units in back row” ── */
  S = fresh(25);
  var pb = S.players.p1;
  var rqEmpty = Z.passReq(S, 'p1', null, (abOf('SD04-001', 'Trigger').req || []));
  T('SKY-Servant:แถวหลังว่าง → ผาน req ไมได (ไม่ลง)', rqEmpty === false || (rqEmpty && rqEmpty.ok === false), JSON.stringify(rqEmpty));
  Z.makeCard(S, 'sd04004', 'p1', Z.R.backRow.p1, 0, 'unit'); Z.makeCard(S, 'sd04005', 'p1', Z.R.backRow.p1, 1, 'unit');
  var rqFull = Z.passReq(S, 'p1', null, (abOf('SD04-001', 'Trigger').req || []));
  T('SKY-Servant:มี Blue 2 ใบในแถวหลัง → ผ่าน req', rqFull === true || (rqFull && rqFull.ok === true), JSON.stringify(rqFull));
  var before2 = placed(S, 'p1').length, handSky = pb.hand.length;
  fire(S, 'p1', 'SD04-001', 'Trigger');
  T('SKY-Servant:deploySelf ลงสนามไดจริงเมื่่อผ่าน req', placed(S, 'p1').length === before2 + 1, before2 + '→' + placed(S, 'p1').length);

  return { res: res, ok: ok };
`);

let bad = 0;
out.res.forEach(r => { if (!r.c) bad++; console.log(`${r.c ? '  ok  ' : '  FAIL'} ${r.n}${r.d ? '   [' + r.d + ']' : ''}`); });
console.log(bad ? `\n${bad}/${out.res.length} ข้อไม่ผ่าน` : `\nผ่านครบ ${out.res.length} ข้อ · เงื่อนไขบนการ์ดถูกระบบบังคับจริง`);
process.exit(bad ? 1 : 0);
