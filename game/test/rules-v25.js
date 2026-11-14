/* test/rules-v25.js — ตรวจกติกา Official Rulebook V.25
   · โจมตี = วางนอน (rest) เหมือนการเดิน ไม่ใช้ Flare
   · เงื่อนไขบนการ์ด (Cost/สี/เผ่า/ชนิด/สถานะ) ต้องกรองกองเป้าหมาย
   · Trigger Check เกิดทุกครั้งที่อีกฝ่ายได้แต้ม · เปิด 1 ใบ/ครั้ง (หลายแต้มพร้อมกัน = 1 ใบ) · ไม่มีล็อก 1 ครั้ง/เทิร์น
   · ใบที่ไม่มี [Trigger] → เจอแล้วเอาขึ้นมือเท่านั้น · ห้ามมีข้อความ ability ขึ้นต้นด้วย ":"
   · การลด Core Point ห้ามทำให้แต้ม ≥1 ตกลงเป็น 0
   · มือแรก 6 ใบ · Mulligan 1 ครั้ง (3 ใบลงใต้เด็ค แล้วจั่วใหม่+สับ) · ฝ่ายเริ่มก่อนไม่จั่วเทิร์นแรก · ไม่จำกัดขนาดมือ
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
  T('RULES.triggerCheckOncePerTurn = false (เช็คทุกครั้งที่อีกฝ่ายได้แต้ม)', Z.R.triggerCheckOncePerTurn === false);
  T('RULES.handStart = 6 (มือแรก 6 ใบ)', Z.R.handStart === 6, Z.R.handStart);
  T('RULES.firstPlayerNoFirstDraw = true', Z.R.firstPlayerNoFirstDraw === true);
  T('RULES ไม่มี handMax (ไม่จำกัดขนาดมือ)', !('handMax' in RULES), JSON.stringify(RULES.handMax));
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

  /* ---------- 3 · Trigger Check (Official txt §7/Q5: ทุกครั้งที่อีกฝ่ายได้แต้ม, 1 ใบ/ครั้ง, ไม่มีล็อก 1 ครั้ง/เทิร์น) ---------- */
  S = Z.init({ seed: 21, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  var q1 = S.players.p1;
  q1.deck = ['sd04004'].concat(q1.deck.slice());          // ใบบนสุดไม่มี [Trigger] → วัดเฉพาะการเปิด
  var dA = q1.deck.length, hA = q1.hand.length;
  Z.triggerCheck(S, 'p1');
  T('เปิดครั้งละ 1 ใบ', dA - q1.deck.length === 1, 'deck delta ' + (dA - q1.deck.length));
  T('ใบที่เช็คขึ้นมือ (ไม่ใช้เอฟเฟกต์)', q1.hand.length - hA === 1);
  var dB = q1.deck.length;
  Z.triggerCheck(S, 'p1');
  T('เช็คซ้ำได้ทันที (ไม่มีล็อก 1 ครั้ง/เทิร์น ตาม txt)', q1.deck.length === dB - 1, 'delta ' + (dB - q1.deck.length));

  var S2 = Z.init({ seed: 33, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  [0, 1, 2].forEach(function (k) { var u = Z.makeCard(S2, 'sd01006', 'p0', Z.R.coreRow, k, 'unit'); u.fresh = false; });
  S2.active = 'p0'; S2.phase = 'main';
  Z.endTurn(S2);
  var coreChecks = count(S2.log, 'Trigger Check (');
  T('ครอง Core Zone 3 ใบ (หลายแต้มพร้อมกัน) → เช็คแค่ 1 ครั้ง', coreChecks === 1, 'checks=' + coreChecks);

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

  /* ---------- 6 · มือแรก 6 ใบ + Mulligan + First-player-no-draw (txt §2) ---------- */
  var S3 = Z.init({ seed: 123, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p9' });
  T('มือแรก = 6 ใบทั้งสองฝ่าย', S3.players.p0.hand.length === 6 && S3.players.p1.hand.length === 6,
    'p0=' + S3.players.p0.hand.length + ' p1=' + S3.players.p1.hand.length);
  // ฝ่ายเริ่มก่อน (S.first) ไม่จั่วในเทิร์นแรก → มือยัง 6 (ไม่ได้เพิ่มเป็น 7)
  T('ฝ่ายเริ่มก่อนไม่จั่วเทิร์นแรก (มือยัง 6)', S3.players[S3.first].hand.length === 6, S3.players[S3.first].hand.length);
  // ฝ่ายเริ่มทีหลังเมื่อถึงเทิร์นตัวเองต้องจั่ว → มือ 7
  var other = S3.first === 'p0' ? 'p1' : 'p0';
  Z.endTurn(S3);
  T('ฝ่ายเริ่มทีหลังจั่วในเทิร์นแรก (มือ 7)', S3.players[other].hand.length === 7 && S3.active === other,
    'hand=' + S3.players[other].hand.length + ' active=' + S3.active);

  var S4 = Z.init({ seed: 5, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p0' });
  var p0 = S4.players.p0, deckBefore = p0.deck.length, handBefore = p0.hand.slice();
  var r = Z.mulligan(S4, 'p0', [0, 1, 2]);
  T('Mulligan 3 ใบ → มือยัง 6 ใบ', r.ok && p0.hand.length === 6, 'hand=' + p0.hand.length);
  T('Mulligan → เด็คขนาดคงเดิม (3 ลงใต้ + จั่ว 3)', p0.deck.length === deckBefore, 'deck ' + deckBefore + '→' + p0.deck.length);
  T('Mulligan → ใบที่เลือกทั้ง 3 ยังอยู่ในเด็ค (ยังไม่ถูกจั่วกลับมา)',
    handBefore.slice(0, 3).every(function (id) { return p0.deck.indexOf(id) >= 0; }),
    'handBefore=' + handBefore.slice(0, 3).join());
  var r2 = Z.mulligan(S4, 'p0', [0]);
  T('Mulligan ใช้ได้ครั้งเดียว (ครั้งที่ 2 ถูกห้าม)', r2.ok === false, JSON.stringify(r2));

  var S5 = Z.init({ seed: 6, p0deck: 'sylvan', p1deck: 'machina', humanSide: 'p0' });
  var keepBefore = S5.players.p0.hand.length, deckK = S5.players.p0.deck.length;
  var rk = Z.mulligan(S5, 'p0', []);
  T('Keep (เลือก 0 ใบ) = สละสิทธิ์ มือเท่าเดิม', rk.ok && rk.mulliganed === 0 && S5.players.p0.hand.length === keepBefore && S5.players.p0.deck.length === deckK);

  return { res: res, ok: ok };
`);

let bad = 0;
out.res.forEach(r => { if (!r.pass) bad++; console.log(`${r.pass ? '  ok  ' : '  FAIL'} ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`); });
console.log(bad ? `\n${bad}/${out.res.length} ข้อไม่ผ่าน` : `\nผ่านครบ ${out.res.length} ข้อ · Official Rulebook V.25`);
process.exit(bad ? 1 : 0);
