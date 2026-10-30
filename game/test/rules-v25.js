/* test/rules-v25.js — ตรวจกติกา Dev V.25
   · โจมตี = วางนอน (rest) เหมือนการเดิน ไม่ใช้ Flare
   · เงื่อนไขบนการ์ด (Cost/สี/เผ่า/ชนิด/สถานะ) ต้องกรองกองเป้าหมาย
   · Trigger Check เปิด 1 ใบ/ครั้ง · ครั้งเดียวต่อฝ่ายต่อเทิร์น · เกิดเมื่ออีกฝ่ายได้แต้ม
   · ใบที่ไม่มี [Trigger] → เจอแล้วเอาขึ้นมือเท่านั้น · ห้ามมีข้อความ ability ขึ้นต้นด้วย ":"
   · การลด Core Point ห้ามทำให้แต้ม ≥1 ตกลงเป็น 0
   · ไม่มี Extra Zone / Arcanum อีกต่อไป
   usage: node test/rules-v25.js                      */
const run = require('./harness');

const out = run(`
  var res = [], ok = true;
  function T(name, cond, detail) {
    res.push({ name: name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });
    if (!cond) ok = false;
  }
  function count(s, frag) { var n = 0; s.forEach(function (L) { if (String(L.msg).indexOf(frag) >= 0) n++; }); return n; }

  /* ---------- 0 · RULES ---------- */
  T('RULES.attackFlare = 0', Z.R.attackFlare === 0, Z.R.attackFlare);
  T('RULES.attackRests = true', Z.R.attackRests === true);
  T('RULES.corePointFloor = 1', Z.R.corePointFloor === 1);
  T('RULES.triggerCheckOncePerTurn = true', Z.R.triggerCheckOncePerTurn === true);
  T('RULES ไม่มี arcanum / extraZoneMax', (!('arcanum' in RULES)) && (!('extraZoneMax' in RULES)));
  var S0 = Z.init({ seed: 3, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  T('state ไม่มี extra zone', !('extra' in S0.players.p0) && !('extra' in S0.players.p1));
  T('engine ไม่มี arcPlayable / summonArc', typeof Z.arcPlayable === 'undefined' && typeof Z.summonArc === 'undefined');

  /* ---------- 1 · โจมตี = rest, ไม่กิน Flare, ได้หลายตัวต่อเทิร์น ---------- */
  var S = Z.init({ seed: 99, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  var a1 = Z.makeCard(S, 'sd01004', 'p0', 3, 0, 'unit'), a2 = Z.makeCard(S, 'sd01004', 'p0', 3, 1, 'unit'), a3 = Z.makeCard(S, 'sd01004', 'p0', 3, 2, 'unit');
  var d1 = Z.makeCard(S, 'sd04004', 'p1', 1, 0, 'unit'), d2 = Z.makeCard(S, 'sd04004', 'p1', 1, 1, 'unit'), d3 = Z.makeCard(S, 'sd04004', 'p1', 1, 2, 'unit');
  [a1, a2, a3, d1, d2, d3].forEach(function (u) { u.fresh = false; u.deployed = false; });
  S.players.p0.flare = 2;
  var flareBefore = S.players.p0.flare, fires = 0;
  [[a1, d1], [a2, d2], [a3, d3]].forEach(function (pr) {
    var r = Z.doAction(S, { side: 'p0', kind: 'attack', uid: pr[0].uid, tgtUid: pr[1].uid });
    if (r && r.ok) { fires++; var g = 0; while (S.pending && g++ < 8) Z.respond(S, null); }
  });
  T('โจมตี 3 ครั้งโดยไม่ใช้ Flare', fires === 3 && S.players.p0.flare === flareBefore, 'fires=' + fires + ' flare ' + flareBefore + '→' + S.players.p0.flare);
  T('ผู้โจมตีถูกวางนอนหลังโจมตี', [a1, a2, a3].filter(function (u) { return S.cards[u.uid] && S.cards[u.uid].rested; }).length >= 2);
  T('ไม่มีข้อความ "ต้องใช้ Flare" โผล่มา', count(S.log, 'Flare') === 0 || !S.log.some(function (L) { return String(L.msg).indexOf('โจมตีต้องใช้ Flare') >= 0; }));

  /* ---------- 2 · candidatesFor เคารพเงื่อนไข Cost / สถานะ ---------- */
  S = Z.init({ seed: 7, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  var u6 = Z.makeCard(S, 'sd04009', 'p0', 4, 0, 'unit');   // Cost 6
  var u3 = Z.makeCard(S, 'sd04005', 'p0', 4, 1, 'unit');   // Cost 3
  var u1 = Z.makeCard(S, 'sd01014', 'p0', 4, 2, 'unit');   // Cost 1
  var uids = function (l) { return l.map(function (x) { return x.uid; }); };
  T('minCost 6 → เหลือแค่ Cost ≥ 6', uids(Z.candidatesFor(S, { side: 'p0', uid: u6.uid }, { to: 'target', minCost: 6 })).join() === u6.uid);
  T('costIs 1 → เจอแค่ Cost 1', uids(Z.candidatesFor(S, { side: 'p0', uid: u6.uid }, { to: 'target', costIs: 1 })).join() === u1.uid);
  T('maxCost 3 → ไม่มี Cost สูงกว่า 3', Z.candidatesFor(S, { side: 'p0', uid: u6.uid }, { to: 'target', maxCost: 3 }).every(function (u) { return (Z.card(u.id).cost || 0) <= 3; }));
  u1.rested = true; u3.rested = false; u6.rested = false;
  T('restedOnly → เฉพาะใบที่วางนอน', Z.candidatesFor(S, { side: 'p0', uid: u6.uid }, { to: 'target', restedOnly: true }).every(function (u) { return u.rested; }));
  T('tribe Machine → เฉพาะเผ่า Machine', Z.candidatesFor(S, { side: 'p1', uid: null }, { to: 'target', tribe: 'Machine' }).every(function (u) { return (Z.card(u.id).tribe || '').indexOf('Machine') >= 0; }));

  /* ---------- 3 · Trigger Check ---------- */
  S = Z.init({ seed: 21, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  var q1 = S.players.p1;
  q1.deck = ['sd04004'].concat(q1.deck.slice());          // ใบบนสุดไม่มี [Trigger] → วัดเฉพาะการเปิด
  S.players.p0.tcDone = false; q1.tcDone = false;
  var dA = q1.deck.length, hA = q1.hand.length;
  Z.triggerCheck(S, 'p1');
  T('เปิดครั้งละ 1 ใบ', dA - q1.deck.length === 1, 'deck delta ' + (dA - q1.deck.length));
  T('ใบที่เช็คขึ้นมือ (ไม่ใช้เอฟเฟกต์)', q1.hand.length - hA === 1);
  var dB = q1.deck.length;
  Z.triggerCheck(S, 'p1');
  T('ฝ่ายเดิมเช็คซ้ำในเทิร์นเดียวกันไม่ได้', q1.deck.length === dB, 'delta ' + (dB - q1.deck.length));
  q1.tcDone = false;                                        // เทิร์นใหม่
  var cB = count(S.log, 'Trigger Check (');
  Z.triggerCheck(S, 'p1');
  T('พอล็อกถูกรีเซ็ตถึงเช็คได้อีก', count(S.log, 'Trigger Check (') - cB === 1, 'checks +' + (count(S.log, 'Trigger Check (') - cB));

  var S2 = Z.init({ seed: 33, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  [0, 1, 2].forEach(function (k) { var u = Z.makeCard(S2, 'sd01006', 'p0', Z.R.coreRow, k, 'unit'); u.fresh = false; });
  S2.active = 'p0'; S2.phase = 'main';
  var p1DeckBefore = S2.players.p1.deck.length;
  Z.endTurn(S2);
  T('ครอง Core Zone 3 ใบ → อีกฝ่ายเช็คแค่ 1 ครั้ง 1 ใบ',
    count(S2.log, 'Trigger Check (') === 1 && p1DeckBefore - S2.players.p1.deck.length <= 1,
    'checks=' + count(S2.log, 'Trigger Check (') + ' flips=' + (p1DeckBefore - S2.players.p1.deck.length));

  /* ---------- 4 · floor ของการลด Core Point ---------- */
  S = Z.init({ seed: 55, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  S.players.p1.corePoints = 3;
  Z.fx(S, { side: 'p0', uid: null, cardId: 'sd01012' }, [{ op: 'foePoint', n: -5 }]);
  T('ลดจาก 3 → หยุดที่ 1 (ไม่ลง 0)', S.players.p1.corePoints === 1, S.players.p1.corePoints);
  S.players.p1.corePoints = 0;
  Z.fx(S, { side: 'p0', uid: null, cardId: 'sd01012' }, [{ op: 'foePoint', n: -2 }]);
  T('ที่ 0 อยู่แล้ว → อยู่ 0 ต่อ', S.players.p1.corePoints === 0, S.players.p1.corePoints);
  S.players.p1.corePoints = 5;
  Z.fx(S, { side: 'p0', uid: null, cardId: 'sd01012' }, [{ op: 'foePoint', n: -4 }]);
  T('ลดเท่าที่กระทบจริง (5 −4 → 1)', S.players.p1.corePoints === 1, S.players.p1.corePoints);

  /* ---------- 5 · ใบที่ไม่มี [Trigger] → Trigger Check ได้แค่เอาขึ้นมือ ---------- */
  var noT = CARDS.filter(function (c) {
    return !(c.abilities || []).some(function (a) { return /^trigger$/i.test(String(a.kw)); });
  })[0];
  var nTrig = CARDS.filter(function (c) {
    return (c.abilities || []).some(function (a) { return /^trigger$/i.test(String(a.kw)); });
  }).length;
  T('มีใบที่พิมพ์ [Trigger] ' + nTrig + ' ใบ ที่เหลือไม่มี (ตามมาสเตอร์เด็ค)', nTrig > 0 && nTrig < CARDS.length, nTrig + '/' + CARDS.length);

  S = Z.init({ seed: 71, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  var pp = S.players.p0;
  pp.deck = [noT.id].concat(pp.deck);
  var hB = pp.hand.length, oB = pp.outzone.length, rB = pp.remove.length;
  Z.triggerCheck(S, 'p0');
  T('ใบไม่มี [Trigger] (' + noT.file + ') → ขึ้นมือเท่านั้น (ไม่เข้า Out/Remove)',
    pp.hand.length === hB + 1 && pp.outzone.length === oB && pp.remove.length === rB,
    'hand +' + (pp.hand.length - hB) + ' out +' + (pp.outzone.length - oB) + ' rem +' + (pp.remove.length - rB));
  T('ใบไม่มี [Trigger] → ไม่ถามใช้เอฟเฟกต์ (ไม่มี uiAsk ค้าง)', !S.uiAsk, S.uiAsk ? S.uiAsk.kind : 'none');

  var lead = CARDS.reduce(function (n, c) {
    return n + (c.abilities || []).filter(function (a) { return String(a.text || '').trim()[0] === ':'; }).length;
  }, 0);
  T('ข้อความ ability ไม่มีใบใดขึ้นต้นด้วย ":" (ข้อมูลสะอาดหลัง OCR)', lead === 0, lead + ' จุด');

  return { res: res, ok: ok };
`);

let bad = 0;
out.res.forEach(r => { if (!r.pass) bad++; console.log(`${r.pass ? '  ok  ' : '  FAIL'} ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`); });
console.log(bad ? `\n${bad}/${out.res.length} ข้อไม่ผ่าน` : `\nผ่านครบ ${out.res.length} ข้อ · กติกา Dev V.25`);
process.exit(bad ? 1 : 0);
