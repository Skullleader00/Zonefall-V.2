/* ═══════════════════════════════════════════════════════════════
   ZONEFALL · RIFT LOBBY — app layer
   ข้อมูลการ์ด/กติกาอ่านจากตัวเกมจริง (game/js/data.js: RULES·COLORS·CARDS·DECKS)
   โฟลเดอร์นี้เพิ่มเฉพาะ: บัญชี/คลัง/เด็ค/ร้านค้า/อีเวนต์/แรงก์ + ส่งเด็คเข้า engine
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const nf = n => (n || 0).toLocaleString('en-US');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = a => a[Math.floor(Math.random() * a.length)];
const wait = ms => new Promise(r => setTimeout(r, ms));
let LANG = localStorage.getItem('zf.lang') || 'th';
const T = (th, en) => (LANG === 'th' ? th : en);
const L = o => (o && typeof o === 'object') ? (o[LANG] || o.en || Object.values(o)[0]) : o;
const seeded = seed => { let x = [...String(seed)].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 7);
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(toast._i); toast._i = setTimeout(() => t.classList.remove('show'), 2800); }

/* ── real game data adapters ─────────────────────────────────── */
const CARD = id => CARD_INDEX[id];
const cardIdOf = file => (CARDS.find(c => c.file === file) || {}).id;
const fmtCP = cp => cp >= 1000 ? (cp / 1000) + 'k' : String(cp || 0);
const kws = c => (c.abilities || []).map(a => a.kw);
const hasTrigger = c => kws(c).includes('Trigger');
const typeLabel = t => ({ unit: 'UNIT', command: 'COMMAND', terrain: 'TERRAIN' }[t] || t);
const scanOf = c => 'game/img/' + c.file + '.jpg';
const artOf = c => 'game/assets/art/' + c.file + '.jpg';
const SETS = [...new Set(CARDS.map(c => c.file.slice(0, 4)))];
const gradeOf = ZF.grade;

/* ── store (local-first) ─────────────────────────────────────── */
const KEY = 'zf.db.v2';
const LSDECK = 'zonefall.lobbydecks.v1';
const TALLY = 'zf_tally';
let DB = null, S = { prof: null, name: null };
function dbLoad() {
  try { DB = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { DB = {}; }
  DB.users ||= {}; DB.share ||= {}; DB.used ||= {}; DB.rooms ||= [];
}
function dbSave() { localStorage.setItem(KEY, JSON.stringify(DB)); }
const hashPw = (u, p) => { let h = 2166136261 >>> 0; const s = u.toLowerCase() + '\u0001' + p + '@zf';
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
function newProf(name) {
  const vault = {}; CARDS.forEach(c => vault[c.id] = 3);
  return { name, pw: '', created: Date.now(), coins: 20000, vault, decks: [], activeDeck: null, equipped: { field: 'FIELD-BLUE', avatar: 'AV-G', sleeve: 'SLV-KRAFT', frame: 'FRM-HEX' },
    unlocked: ['FIELD-BLUE', 'AV-G', 'SLV-KRAFT', 'FRM-HEX'], redeemed: [], wins: 0, losses: 0, rp: 0, packs: 0, seen_packs: {},
    matches: [], events: {}, watchRooms: [], winStreak: 0, bio: '' };
}
function register(name, pw) {
  const k = name.toLowerCase(); if (DB.users[k]) return T('ชื่อนี้ถูกใช้แล้ว', 'name taken');
  const p = newProf(name); p.pw = hashPw(name, pw); DB.users[k] = p; dbSave(); S.name = name; S.prof = p;
  localStorage.setItem('zf.session', name); syncLobbyDecks(); return null;
}
function login(name, pw) {
  const u = DB.users[name.toLowerCase()];
  if (!u || u.pw !== hashPw(name, pw)) return T('บัญชีหรือรหัสผ่านไม่ถูกต้อง', 'wrong login/password');
  S.name = name; S.prof = u; localStorage.setItem('zf.session', name); syncLobbyDecks(); return null;
}
function logout() { S.name = null; S.prof = null; localStorage.removeItem('zf.session'); }
function restore() { const n = localStorage.getItem('zf.session');
  if (n && DB.users[n.toLowerCase()]) { S.name = n; S.prof = DB.users[n.toLowerCase()]; return true; } return false; }
const P = () => S.prof;
function save() { if (S.prof) { DB.users[S.name.toLowerCase()] = S.prof; dbSave(); syncLobbyDecks(); } }
function grant(o) {
  if (!S.prof) return;
  if (o.coins) P().coins += o.coins;
  if (o.packs) for (const id in o.packs) { P().seen_packs ||= {}; P().seen_packs[id] = (P().seen_packs[id] || 0) + o.packs[id]; }
  if (o.cards) o.cards.forEach(id => { if (CARD(id)) P().vault[id] = (P().vault[id] || 0) + 1; });
  if (o.skins) o.skins.forEach(s => { if (!P().unlocked.includes(s)) P().unlocked.push(s); });
  save();
}
const tally = () => { try { return JSON.parse(localStorage.getItem(TALLY) || '{"w":0,"l":0}'); } catch (e) { return { w: 0, l: 0 }; } };

/* ── deck model · main+extra · rulebook V.24 ─────────────────── */
const R = RULES;
const deckMain = d => d.main.map(x => CARD(x.id)).filter(Boolean);
const deckExtra = d => (d.extra || []).map(x => CARD(x.id)).filter(Boolean);
const nOf = (d, id) => (d.main.find(x => x.id === id) || {}).n || 0;
const deckSize = d => d.main.reduce((a, x) => a + x.n, 0);
const deckExtraSize = d => (d.extra || []).reduce((a, x) => a + x.n, 0);
function colorStat(d) {
  const c = {}; deckMain(d).forEach(cd => { const q = nOf(d, cd.id); c[cd.color] = (c[cd.color] || 0) + q; });
  const named = Object.keys(c).filter(k => k !== 'Colorless');
  const primary = (d.color && c[d.color]) ? d.color : named.sort((a, b) => c[b] - c[a])[0];
  return { c, primary, pct: primary ? Math.round(100 * (c[primary] || 0) / Math.max(1, deckSize(d))) : 0,
    secondaries: named.filter(k => k !== primary) };
}
function deckCheck(d) {
  const errs = [], warn = [];
  const size = deckSize(d), es = deckExtraSize(d), st = colorStat(d);
  if (size < R.deckMin || size > R.deckMax) errs.push(T(`ขนาดเด็ค ${size} ใบ ต้องอยู่ใน ${R.deckMin}–${R.deckMax}`, `deck size ${size} must be ${R.deckMin}–${R.deckMax}`));
  const over = d.main.filter(x => x.n > R.maxCopy);
  if (over.length) errs.push(T('ซ้ำเกิน 3 ใบ: ' + over.map(x => x.id).join(', '), `over ${R.maxCopy} copies: ${over.map(x => x.id).join(', ')}`));
  if (d.main.some(x => !CARD(x.id))) errs.push(T('มี id ที่ไม่มีในการ์ด', 'unknown card id'));
  if (st.pct < 50) errs.push(T(`สีหลัก ${st.primary || '—'} ${st.pct}% (ต้อง ≥50%)`, `main colour ${st.primary || '—'} ${st.pct}% (needs ≥50%)`));
  if (st.secondaries.length > 1) errs.push(T('คู่สีรองได้ 1 สี พบ ' + st.secondaries.length, `${st.secondaries.length} secondary colours (max 1): ${st.secondaries.join(', ')}`));
  const prot = deckMain(d).filter(c => c.protection).reduce((a, c) => a + nOf(d, c.id), 0);
  if (prot > R.protectionLimit) errs.push(T(`[Protection] ${prot} ใบ เกินโควตา ${R.protectionLimit}`, `[Protection] ${prot} > ${R.protectionLimit}`));
  const legacy = deckExtraSize(d);
  if (legacy) warn.push(T(`V.25 ไม่มี Extra Zone แล้ว — ไม่มานับ ${legacy} ใบ`, `no Extra Zone in V.25 — ${legacy} card(s) ignored`));
  const banned = d.main.filter(x => { const b = ZF.ban.find(z => z.id === x.id); return b && x.n > b.lim; });
  banned.forEach(x => warn.push(`${x.id} ×${x.n} → max ${ZF.ban.find(b => b.id === x.id).lim} (${T('แรงก์/อีเวนต์', 'ranked & events')})`));
  const units = deckMain(d).filter(c => c.type === 'unit').length, terr = deckMain(d).filter(c => c.type === 'terrain').length;
  if (units < 12) warn.push(T('ยูนิตน้อย (' + units + ') — สนาม 5×3 ต้องการตัวครองแถว', 'only ' + units + ' unit kinds — the 5×3 board needs bodies'));
  if (terr > 6) warn.push(T('Terrain ' + terr + ' ใบ โควตาบนสนามมี 1', `${terr} terrain kinds but the field quota is ${R.terrainLimitBase}`));
  return { size, extra: es, errs, warn, ok: !errs.length, stat: st, primary: st.primary, prot, units, terr };
}
function curve(d) { const a = new Array(R.flareMax + 1).fill(0); deckMain(d).forEach(c => a[c.cost] = (a[c.cost] || 0) + nOf(d, c.id)); return a; }
function officialDeck(key) {
  const D = DECKS[key]; if (!D) return null;
  const cnt = {}; D.main.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
  const ecnt = {}; (D.extra || []).forEach(id => ecnt[id] = (ecnt[id] || 0) + 1);
  return { id: 'OFF-' + key, key, name: D.name, color: D.color, official: true,
    main: Object.keys(cnt).map(id => ({ id, n: cnt[id] })), extra: Object.keys(ecnt).map(id => ({ id, n: ecnt[id] })) };
}
const officialKeys = () => Object.keys(DECKS);
function starterDeck(color) {
  const key = officialKeys().find(k => DECKS[k].color === color) || officialKeys()[0];
  const d = officialDeck(key); d.id = 'D' + Date.now().toString(36); d.official = false; d.name = (ZF.fac(color).en.split(' · ')[0]) + ' · official list copy';
  return d;
}
/* expand → array of ids for the real engine */
function expand(d) {
  const main = [], extra = [];
  d.main.forEach(x => { for (let i = 0; i < x.n; i++) main.push(x.id); });
  (d.extra || []).forEach(x => { for (let i = 0; i < x.n; i++) extra.push(x.id); });
  return { main, extra };
}
function syncLobbyDecks() {
  if (!S.prof && !S.name) return;
  const all = {};
  (S.prof?.decks || []).forEach(d => {
    if (d.official) return;
    const e = expand(d); const st = colorStat(d);
    all[d.id] = { name: d.name, color: st.primary || d.color || 'Colorless', main: e.main, extra: [], at: Date.now() };
  });
  try { localStorage.setItem(LSDECK, JSON.stringify(all)); } catch (e) { /* quota */ }
}

/* ── share / import code ─────────────────────────────────────── */
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode = n => [...Array(n)].map(() => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
function shareCode(d) {
  const mine = ((DB.userCode || {})[S.name.toLowerCase()] || {})[d.id];
  if (mine && DB.share[mine] && DB.share[mine].exp > Date.now()) { DB.share[mine].deck = JSON.parse(JSON.stringify(d)); dbSave(); return mine; }
  let code; do { code = randCode(8); } while (DB.share[code] && DB.share[code].by !== S.name);
  (DB.userCode ||= {})[S.name.toLowerCase()] = Object.assign(DB.userCode[S.name.toLowerCase()] || {}, { [d.id]: code });
  DB.share[code] = { by: S.name, deck: JSON.parse(JSON.stringify(d)), at: Date.now(), exp: Date.now() + 30 * 864e5 };
  dbSave(); return code;
}
function importCode(txt) {
  const code = (txt || '').trim().toUpperCase();
  if (DB.share[code]) { const r = DB.share[code];
    if (r.exp < Date.now()) return { err: T('รหัสหมดอายุแล้ว', 'code expired') };
    return JSON.parse(JSON.stringify(r.deck)); }
  const findCard = tok => {
    const up = tok.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!up) return null;
    let c = CARDS.find(x => x.file.toUpperCase() === up); if (c) return c;
    c = CARD(tok.toLowerCase()); if (c) return c;
    const m = up.match(/^([A-Z]{2,3})-?(\d{1,4})$/);
    if (m) { const set = m[1], num = m[2];
      for (const p2 of [3, 4, 2]) { const t = set + '-' + num.padStart(p2, '0');
        c = CARDS.find(x => x.file.toUpperCase() === t); if (c) return c; } }
    const d = up.match(/^\d+([A-Z]{2,3})(\d{3,4})$/); if (d) return findCard(d[1] + '-' + d[2]);
    return null;
  };
  const rows = (txt || '').split(/[\n,;]+/).map(t => t.replace(/^#.*$/, '').trim()).filter(Boolean);
  if (rows.length) {
    const main = [], extra = []; let target = main;
    rows.forEach(line => {
      if (/^extra\b/i.test(line)) { target = extra; return; }
      const m = line.match(/^\s*(\d+)\s*[xX]?\s*(.+)$/);
      if (!m) return;
      const c = findCard(m[2].trim().split(/\s+/)[0]);
      if (c) target.push({ id: c.id, n: clamp(+m[1], 1, R.maxCopy) });
    });
    if (main.length) {
      const cnt = {};
      main.forEach(x => cnt[x.id] = Math.min(R.maxCopy, (cnt[x.id] || 0) + x.n));
      const ec = {}; extra.forEach(x => ec[x.id] = Math.min(R.maxCopy, (ec[x.id] || 0) + x.n));
      const st = colorStat({ main: Object.keys(cnt).map(id => ({ id, n: cnt[id] })) });
      return { id: 'D' + Date.now().toString(36), name: 'Imported · ' + (code.slice(0, 8) || 'list'), color: st.primary || 'Colorless',
        main: Object.keys(cnt).map(id => ({ id, n: cnt[id] })), extra: Object.keys(ec).map(id => ({ id, n: ec[id] })) };
    }
  }
  return { err: T('ไม่พบรหัส หรือรายการการ์ดอ่านไม่ออก', 'code not found or list unreadable') };
}
function deckToText(d, fmt) {
  const head = ['# ' + d.name, '# Zonefall ' + ZF.series + ' · main ' + deckSize(d) + ' · extra ' + deckExtraSize(d), ''];
  const group = (arr) => arr.slice().sort((a, b) => (CARD(b.id)?.cost || 0) - (CARD(a.id)?.cost || 0) || CARD(a.id).file.localeCompare(CARD(b.id).file))
    .map(x => `${x.n}x ${CARD(x.id)?.file || x.id}  ${CARD(x.id)?.name || '?'}`);
  return head.concat(group(d.main)).join('\n');
}

/* ── card renderer (ใช้ภาพสแกนจริง) ──────────────────────────── */
function cardEl(c, o = {}) {
  const tone = ZF.tone(c.color), f = ZF.fac(c.color);
  const n = el('article', 'rcard' + (o.cls ? ' ' + o.cls : ''));
  n.dataset.id = c.id; n.dataset.type = c.type; n.dataset.grade = gradeOf(c); n.dataset.color = c.color;
  n.style.setProperty('--tone', tone);
  const own = o.own != null ? o.own : (S.prof ? (P().vault[c.id] || 0) : null);
  n.innerHTML =
    `<div class="rc-frame"><img loading="lazy" src="${scanOf(c)}" alt="${esc(c.name)}">` +
    `<span class="rc-cost">${c.cost}</span>` +
    (c.cp ? `<span class="rc-cp">${fmtCP(c.cp)}</span>` : '') +
    (c.protection ? `<span class="rc-tag prot">PROTECTION</span>` : '') +
    (hasTrigger(c) ? `<span class="rc-tag trig">TRIGGER</span>` : '') +
    (own != null ? `<span class="rc-own${own ? '' : ' zero'}">×${own}</span>` : '') +
    `<span class="rc-grade">${gradeOf(c)}</span></div>` +
    `<div class="rc-meta"><b>${esc(c.name)}</b><span class="rc-line" style="color:${tone}">${esc(c.color)} · ${esc(c.tribe)}</span>` +
    `<span class="rc-kw">${kws(c).map(k => `<i>${esc(k)}</i>`).join('')}</span></div>`;
  if (o.click !== false) n.addEventListener('click', () => openDetail(c));
  return n;
}
function openDetail(c) {
  const f = ZF.fac(c.color), tone = ZF.tone(c.color), wrap = $('#detail-content');
  wrap.innerHTML = '';
  const box = el('div', 'detail-wrap');
  const pic = el('div', 'rcard big');
  pic.style.setProperty('--tone', tone); pic.dataset.type = c.type;
  pic.innerHTML = `<div class="rc-frame"><img src="${scanOf(c)}" alt="${esc(c.name)}"><span class="rc-cost">${c.cost}</span>` +
    (c.cp ? `<span class="rc-cp">${fmtCP(c.cp)}</span>` : '') +
    (c.protection ? '<span class="rc-tag prot">PROTECTION</span>' : '') +
    (hasTrigger(c) ? '<span class="rc-tag trig">TRIGGER</span>' : '') + '</div>';
  box.appendChild(pic);
  const side = el('div', 'detail-side');
  const ban = ZF.ban.find(b => b.id === c.id);
  const inDecks = (P()?.decks || []).filter(d => d.main.some(x => x.id === c.id));
  side.innerHTML =
    `<div class="tag">${ZF.sets[c.file.slice(0, 4)] || c.file} · ${c.file} · ${typeLabel(c.type)}</div>` +
    `<h2>${esc(c.name)}</h2>` +
    `<div class="clanline" style="color:${tone}"><img src="game/assets/faction/${f.icon}.png" alt="" class="fac-ico"> ${esc(f.en)} · ${esc(c.tribe)}</div>` +
    `<div class="detail-numbers stat-grid">
      <div class="stat"><b>${c.cost}</b><span>Cost / Flare</span></div>
      <div class="stat cy"><b>${c.cp ? fmtCP(c.cp) : '—'}</b><span>${T('ค่าพลัง', 'Power CP')}</span></div>
      <div class="stat go"><b>${gradeOf(c)}</b><span>${ZF.gradeLabel[gradeOf(c)]}</span></div>
      <div class="stat vi"><b>${S.prof ? (P().vault[c.id] || 0) : 0}</b><span>${T('มีในคลัง', 'in vault')}</span></div>
     </div>` +
    `<div class="abil-list">${(c.abilities || []).map(a =>
      `<div class="abil"><span class="kw">${esc(a.kw)}</span>${a.once ? '<span class="lim">once</span>' : ''}${a.when === 'quick' ? '<span class="lim">response window</span>' : ''}
       <p>${esc(a.text)}</p>${a.ops && a.ops.length ? `<details class="opsbox"><summary>${T('ดูข้อมูลที่ engine ใช้ (ops)', 'engine ops for this ability')}</summary><pre class="ops">${esc(JSON.stringify(a.ops, null, 1))}</pre></details>` : ''}</div>`).join('') ||
      '<p class="muted">' + T('ไม่มีความสามารถ', 'vanilla body') + '</p>'}</div>` +
    (ban ? `<p class="warn">⚠ ${T('ข้อจำกัดแรงก์: ' + L(ban.note) + ' · ใช้ได้ ' + ban.lim + ' ใบ', 'ranked restriction: ' + L(ban.note) + ' · max ' + ban.lim)}</p>` : '') +
    (inDecks.length ? `<p class="muted" style="font-size:12.5px">${T('อยู่ในเด็คของคุณ: ', 'used in your decks: ') + inDecks.map(d => d.name).join(', ')}</p>` : '');
  const act = el('div', 'actions');
  if (S.prof) {
    act.appendChild(btnX(T('เติมเด็คปัจจุบัน +1', 'add to active deck +1'), () => addToActive(c.id), 'primary'));
    act.appendChild(btnX(T('ซื้อเดี่ยว 900 Coin', 'buy single 900 Coin'), () => buyOne(c.id), 'ghost'));
  }
  side.appendChild(act); box.appendChild(side); wrap.appendChild(box);
  $('#card-detail').showModal();
}
const btnX = (label, fn, cls) => { const b = el('button', cls || '', label); b.addEventListener('click', fn); return b; };
function buyOne(id) {
  if (P().coins < 900) return toast(T('Coin ไม่พอ', 'not enough Coin'), true);
  P().coins -= 900; P().vault[id] = (P().vault[id] || 0) + 1; save(); toast(T('ซื้อแล้ว ', 'bought ') + CARD(id).name); render();
}
function addToActive(id) {
  const d = P().decks.find(x => x.id === P().activeDeck) || P().decks[0];
  if (!d) return toast(T('ยังไม่มีเด็ค', 'no deck yet'), true);
  const row = d.main.find(x => x.id === id);
  if (row) { if (row.n >= R.maxCopy) return toast(T('ซ้ำครบ 3 ใบแล้ว', 'max 3 copies'), true); row.n++; }
  else d.main.push({ id, n: 1 });
  deckSize(d) > R.deckMax && (d.main.find(x => x.id === id).n = Math.max(1, R.deckMax - (deckSize(d) - 1)));
  save(); render();
}

/* ── router ──────────────────────────────────────────────────── */
const TABS = ['lobby', 'events', 'shop', 'collection', 'decks', 'battle', 'watch', 'ranked', 'customization', 'profile', 'banlist', 'about'];
const ALIAS = { event: 'events', events: 'events', store: 'shop', vault: 'collection', build: 'decks', play: 'battle', lounge: 'watch', ladder: 'ranked', style: 'customization', ban: 'banlist', home: 'lobby' };
let TAB = 'lobby';
const leaveStage = () => { if (typeof ZFStage !== 'undefined' && ZFStage.has()) ZFStage.close(true); };
function go(tab, push = true) {
  tab = (ALIAS[tab] || tab); if (!TABS.includes(tab)) tab = 'lobby';
  TAB = tab; leaveStage();
  const u = new URL(location.href); u.searchParams.set('menu', tab);
  if (push) history.replaceState(null, '', u);
  document.body.dataset.page = tab;
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.header-shortcuts button[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}
function applyCosmetics() {
  const p = S.prof; const eq = (p && p.equipped) || {}; const root = document.documentElement.style;
  const slv = ZF.skins.find(s => s.id === eq.sleeve), frm = ZF.skins.find(s => s.id === eq.frame), av = ZF.skins.find(s => s.id === eq.avatar);
  root.setProperty('--slv1', (slv && slv.c1) || '#122029'); root.setProperty('--slv2', (slv && slv.c2) || '#0b1410');
  root.setProperty('--ring', (frm && frm.c1) || '#f2c744');
  root.setProperty('--av', (av && av.img) || 'game/assets/faction/verdant.png');
}
function render() {
  applyCosmetics();
  const m = $('#content'); m.innerHTML = '';
  const needAuth = ['shop', 'collection', 'decks', 'battle', 'ranked', 'customization', 'profile'].includes(TAB);
  if (!S.prof && needAuth) { m.appendChild(el('div', 'empty', T('เข้าสู่ระบบเพื่อใช้คลังการ์ด · ร้านค้า · เด็ค (ข้อมูลเก็บในเครื่องคุณ)', 'sign in to use the vault, shop and decks — everything is stored in this browser')));
    const b = btnX(T('เข้าสู่ระบบ / สมัครบัญชี', 'sign in / register'), () => $('#account-dialog').showModal(), 'primary'); b.style.marginTop = '14px'; m.appendChild(b); return syncAuth(); }
  ({ lobby: vLobby, events: vEvents, shop: vShop, collection: vCollection, decks: vDecks, battle: vBattle,
     watch: vWatch, ranked: vRanked, customization: vCustom, profile: vProfile, banlist: vBanlist, about: vAbout }[TAB] || vLobby)(m);
  syncAuth();
}
function rail(t, sub) { const r = el('section', 'rail'); const h = el('div', 'rail-head');
  h.innerHTML = `<h2>${esc(t)}</h2>` + (sub ? `<span class="sub">${esc(sub)}</span>` : ''); r.appendChild(h); return r; }
function tools(r) { const d = el('div', 'tools'); r.querySelector('.rail-head').appendChild(d); return d; }
const statTile = (v, k, cls) => `<div class="stat ${cls || ''}"><b>${v}</b><span>${esc(k)}</span></div>`;
const tierOf = rp => { let t = ZF.tiers[0]; ZF.tiers.forEach(x => { if (rp >= x.pts) t = x; }); return t; };
const legalDecks = () => (P()?.decks || []).filter(d => deckCheck(d).ok);

/* ── VIEW · LOBBY ────────────────────────────────────────────── */
function vLobby(m) {
  const live = ZF.events.filter(e => e.status === 'live');
  const owned = CARDS.filter(c => (P()?.vault[c.id] || 0) > 0).length;
  const hero = el('section', 'hero');
  hero.innerHTML = `<div class="hero-in">
    <span class="kicker">${esc(ZF.series)} · ${T('ห้องโถงเริ่มต้น', 'STARTER LOBBY')} · ${CARDS.length} การ์ดจริง</span>
    <h1>ZONE<span class="hb1">FALL</span><span class="brandsub">RIFT LOBBY</span></h1>
    <p>${T('เว็บโถงกลางของการ์ดเกม Zonefall บนกติกา Dev V.24 — 5 แถว × 3 ช่อง, 7 Core Point, Flare 3→8, พลังค้าง และการโต้ตอบในหน้าต่าง Declaration–Response · คลังการ์ด ร้านค้า แผงเด็ค และอีเวนต์เชื่อมต่อเข้ากับ engine จริงในตัว',
      'The hub for the Zonefall card game on rulebook Dev V.24 — a 5×3 board, 7 Core Point, Flare 3→8, persistent power and a declare/response window. Vault, shop, deck board and events all feed the shipped engine in this folder.')}</p>
    <div class="hero-cta">
      <button class="primary" data-nav="battle">⚔ ${T('เปิดสนาม Engine จริง', 'Enter the real engine')}</button>
      <button class="ghost" data-nav="events">${T('ตารางอีเวนต์', 'Events')}</button>
      <button class="accent" data-nav="shop">${T('เปิดซอง SB01 / SD01 / SD04', 'Open sets')}</button>
      <button class="ghost" data-nav="decks">${T('แผงเด็ค + deckcheck', 'Deck board + deckcheck')}</button>
    </div>
    <div class="hero-cards">${['sb01001','sd04009','sd01007'].map((id,i)=>`<img src="${scanOf(CARD(id))}" alt="${esc(CARD(id).name)}" style="--r:${(i-1)*5}deg;--d:${i*90}ms">`).join('')}</div>
    <div class="hero-tags"><span>${CARDS.length} CARDS</span><span>${SETS.join(' · ')}</span><span>UNITS ${CARDS.filter(c => c.type === 'unit').length}</span>
      <span>COMMANDS ${CARDS.filter(c => c.type === 'command').length}</span><span>TERRAIN ${CARDS.filter(c => c.type === 'terrain').length}</span><span>ARCENUM OFF</span></div>
  </div>`;
  m.appendChild(hero);

  const r0 = rail(T('สถานะบัญชีคุณ', 'your account'));
  const sg = el('div', 'stat-grid');
  const tl = tally();
  sg.innerHTML = statTile(S.prof ? nf(P().coins) : '—', 'COIN') + statTile(S.prof ? owned + '/' + CARDS.length : '—', T('สะสม', 'collected')) +
    statTile(S.prof ? P().decks.length : '—', T('เด็ค', 'decks')) + statTile(tl.w + '-' + tl.l, T('สถิติจาก engine', 'engine record'), 'cy') +
    statTile(S.prof ? tierOf(P().rp).id : '—', 'ZONE', 'vi') + statTile(S.prof ? nf(P().rp) : '—', 'RP', 'go') +
    statTile(S.prof ? nf(P().packs) : '—', T('ซองที่เปิด', 'packs opened'), 'ru');
  r0.appendChild(sg); m.appendChild(r0);

  const r1 = rail(T('color faction', 'สีประจำเด็ค'), T('ไอคอนและฉากสนามใช้ asset จริงของเกม', 'icons and fields are the shipped assets'));
  const g1 = el('div', 'grid g-3');
  ZF.factions.slice(0, 5).forEach(f => {
    const cs = CARDS.filter(c => c.color === f.id);
    const p = el('div', 'panel hi'); p.style.borderColor = ZF.tone(f.id) + '55';
    p.innerHTML = `<h3 style="color:${ZF.tone(f.id)}"><img class="fac-ico" src="game/assets/faction/${f.icon}.png" alt=""> ${esc(f.en)}<small>${esc(f.hue)} · ${cs.length} ${T('ใบ', 'cards')}</small></h3>
      <p class="muted" style="font-size:13px">${esc(f.th)}</p>
      <div class="tribelist">${[...new Set(cs.map(c => c.tribe))].slice(0, 5).map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
    const row = el('div', 'flow'); row.style.marginTop = '12px';
    cs.slice(0, 3).forEach(c => row.appendChild(cardEl(c, { cls: 'mini', own: null })));
    p.appendChild(row);
    const b = btnX(T('ดูการ์ดสีนี้', 'browse colour'), () => { vaultFilter.color = f.id; go('collection'); }, 'ghost');
    b.style.marginTop = '12px'; p.appendChild(b); g1.appendChild(p);
  });
  r1.appendChild(g1); m.appendChild(r1);

  const r2 = rail(T('อีเวนต์ที่เปิดอยู่', 'Live events'));
  r2.appendChild(eventList(live)); m.appendChild(r2);

  const r3 = rail(T('เริ่มต้น 5 ขั้นตอน', 'Start in 5 steps'));
  const ol = el('ol', 'flow');
  [T('สมัครบัญชี · รับ 20,000 Coin คลังเริ่มต้น 3 ใบ/ชื่อ', 'Register · 20,000 Coin and 3 copies of every real card'),
   T('เล็งกติกา: Core Zone (แถว 3) คือที่ทำคะแนน ใบที่ครองตอน End Phase นับใบละ 1', 'Learn the loop: the Core Zone (row 3) is where you score, 1 point per unit at End Phase'),
   T('จัดเด็ค 40–60 ใบบนแผงเด็ค · deckcheck ตรวจสีหลัก/คู่สี/[Protection] ให้เอง', 'Build 40–60 on the deck board · deckcheck validates colour share and [Protection]'),
   T('กด “ส่งเข้าสนาม” เด็คจะไปอยู่ใน dropdown ของ engine จริงทันที', 'Hit “Send to engine” and the deck shows up in the real game picker'),
   T('ชนะใน engine → lobby อ่านค่า zf_tally แล้วจ่าย Coin/RP ให้อัตโนมัติ', 'Win in the engine → the lobby reads zf_tally and pays Coin/RP automatically')]
    .forEach(t => ol.appendChild(el('li', null, t)));
  r3.appendChild(ol); m.appendChild(r3);
}

/* ── VIEW · EVENTS ───────────────────────────────────────────── */
let EV_FILTER = 'all';
function countdown(target) {
  const ms = new Date(target) - Date.now();
  if (ms <= 0) return 'GO / LIVE';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function eventCard(e) {
  const c = el('article', 'panel event'), entered = S.prof && P().events?.[e.id]?.entered;
  c.innerHTML = `<div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
      <span class="badge ${e.status}">${{ live: T('กำลังแข่ง', 'IN PROGRESS'), open: T('เปิดรับสมัคร', 'ACCEPTING'), soon: T('เร็วๆ นี้', 'UPCOMING'), done: T('ปิดรับ', 'ARCHIVED') }[e.status]}</span>
      <span class="tag">${L(e.kind)} · ${esc(e.format)}</span>
    </div>
    <h2>${L(e.name)}</h2><p class="muted" style="margin-top:8px">${L(e.blurb)}</p>
    <div class="meta">
      <span>${T('เริ่ม', 'Starts')} <b>${new Date(e.date).toLocaleString(LANG === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</b></span>
      <span>${T('สนาม', 'Venue')} <b>${esc(e.venue)}</b></span>
      <span>${T('ค่าเข้า', 'Entry')} <b>${e.fee ? nf(e.fee) + ' Coin' : T('ฟรี', 'FREE')}</b></span>
      <span>${T('รวมรางวัล', 'Prize pool')} <b style="color:var(--gold)">${nf(e.prize)} Coin</b></span>
      <span>slot <b>${nf(e.slots.used)}/${nf(e.slots.cap)}</b></span>
      <span>${T('กติกาการ์ด', 'Card legality')} <b>${esc(e.restrict)}</b></span>
    </div>
    ${e.rules ? `<p class="muted note">${L(e.rules)}</p>` : ''}
    <div class="cta"></div></div>
    <div><div class="countdown">${countdown(e.date)}<small>${T('นับถอยหลัง', 'COUNTDOWN')}</small></div>
      <div class="bar cy" style="margin-top:12px"><i style="width:${Math.round(e.slots.used / e.slots.cap * 100)}%"></i></div>
      <p class="muted slotline">${nf(e.slots.cap - e.slots.used)} ${T('ที่ว่าง', 'seats left')}</p></div>`;
  const act = c.querySelector('.cta');
  if (e.status === 'live' || e.status === 'open') {
    act.appendChild(btnX(entered ? T('▶ กลับเข้าห้อง', '▶ re-enter room') : T('สมัคร & เข้าสนาม', 'Enter & deploy'), () => enterEvent(e), 'primary'));
  }
  act.appendChild(btnX(T('รายละเอียดรางวัล', 'prize details'), () => {
    const w = $('#detail-content'); w.innerHTML = '';
    const box = el('div', 'detail-side'); box.style.cssText = 'padding:22px;grid-column:1/-1';
    box.innerHTML = `<h2>${L(e.name)} · ${T('รางวัล', 'Prizes')}</h2><div style="margin-top:14px">` +
      e.prizes.map(x => `<div class="room-row"><b>${esc(x.place)}</b><span class="num" style="color:var(--lime)">${nf(x.coins)} Coin</span><span class="vs">${x.extra ? L(x.extra) : ''}</span></div>`).join('') +
      `</div><p class="muted" style="margin-top:14px">${L(e.blurb)}</p>`;
    w.appendChild(box); $('#card-detail').showModal();
  }, 'ghost'));
  return c;
}
const eventList = list => { const w = el('div'); list.forEach(e => w.appendChild(eventCard(e))); return w; };
function vEvents(m) {
  if (!S.prof) return render();
  const order = { live: 0, open: 1, soon: 2, done: 3 };
  const r = rail(T('ตารางอีเวนต์', 'Event calendar'), esc(ZF.series));
  const tl = tools(r);
  ['all', 'live', 'open', 'soon', 'done'].forEach(k => {
    const b = el('button', 'chip' + (EV_FILTER === k ? ' on' : ''), k === 'all' ? T('ทั้งหมด', 'all') : k);
    b.addEventListener('click', () => { EV_FILTER = k; render(); }); tl.appendChild(b);
  });
  let list = ZF.events.slice().sort((a, b) => order[a.status] - order[b.status] || new Date(a.date) - new Date(b.date));
  if (EV_FILTER !== 'all') list = list.filter(e => e.status === EV_FILTER);
  r.appendChild(eventList(list)); m.appendChild(r);
  const ri = rail(T('ประเด็นสมดุลที่ทีมเปิดค้างไว้', 'Open balance questions'), T('อ้างอิงจาก README ของตัวเกม', 'quoted from the game README'));
  const gi = el('div', 'grid g-2');
  ZF.openIssues.forEach(x => { const p = el('div', 'panel'); p.innerHTML = `<h3 style="color:var(--gold)">${L(x.t)}</h3><p class="muted" style="margin-top:8px">${L(x.d)}</p>`; gi.appendChild(p); });
  ri.appendChild(gi); m.appendChild(ri);
}
function enterEvent(e) {
  if (!S.prof) return $('#account-dialog').showModal();
  const d = legalDecks()[0];
  if (!d) return toast(T('ยังไม่มีเด็คที่ผ่าน deckcheck · ไปที่แผงเด็ค', 'no deck passes deckcheck — open the deck board'), true);
  if (e.fee) { if (P().coins < e.fee) return toast(T('Coin ไม่พอจ่ายค่าเข้า', 'not enough Coin for entry'), true); P().coins -= e.fee; }
  (P().events ||= {})[e.id] = { entered: Date.now(), fee: e.fee, deck: d.id };
  P().rp += 40; save(); toast(T('สมัคร ', 'entered ') + L(e.name));
  const foe = e.id === 'EV-02' ? pick(officialKeys()) : e.id === 'EV-04' ? 'machina' : pick(officialKeys());
  launchMatch({ own: d.id, foe, first: e.id === 'EV-02' ? 'rps' : 'p0', event: e.id, bo: e.format.startsWith('BO3') ? 3 : 1 });
}

/* ── VIEW · SHOP ─────────────────────────────────────────────── */
function pull(pack, force) {
  const pool = pack.set ? CARDS.filter(c => c.file.startsWith(pack.set)) : CARDS;
  const roll = () => { let r = Math.random() * 100, acc = 0;
    for (const g of ['G4', 'G3', 'G2', 'G1']) { acc += ZF.ODDS[g]; if (r <= acc) return g; } return 'G1'; };
  let grade = roll(); if (force && grade === 'G1') grade = Math.random() < .2 ? 'G3' : 'G2';
  let list = pool.filter(c => gradeOf(c) === grade); if (!list.length) list = pool;
  return pick(list);
}
function openPack(pack, mult) {
  if (!S.prof) return $('#account-dialog').showModal();
  const cost = mult === 10 ? pack.ten : mult === 5 ? pack.five : pack.price;
  if (P().coins < cost) return toast(T('Coin ไม่พอ · ต้อง ', 'need ') + nf(cost) + ' Coin', true);
  P().coins -= cost; P().packs += mult;
  const got = [];
  for (let i = 0; i < 5 * mult; i++) {
    const c = pull(pack, i % 5 === 4);
    const before = P().vault[c.id] || 0; P().vault[c.id] = before + 1;
    got.push({ c, refund: before >= R.maxCopy ? 300 : before >= 1 ? 150 : 0 });
  }
  P().seen_packs ||= {}; P().seen_packs[pack.id] = (P().seen_packs[pack.id] || 0) + mult;
  const refund = got.reduce((a, x) => a + x.refund, 0); P().coins += refund; save();
  showOpener(pack, got, refund, mult);
}
function showOpener(pack, got, refund, mult) {
  const ov = el('div'); ov.id = 'opener';
  ov.innerHTML = `<div class="opener-rift" style="--c1:${pack.c1};--c2:${pack.c2}"><i><i></i></i><i></i>
      <svg viewBox="0 0 120 120"><path d="M22 18h76L60 60l38 42H22l38-42Z"/></svg></div>
    <div class="opener-txt">${esc(pack.en)} ×${mult}</div><div class="opener-cards"></div>
    <div class="opener-summary"></div><div class="opener-actions"><button class="primary">${T('เก็บเข้าคลัง', 'collect')}</button><button class="ghost">${T('เปิดอีกครั้ง', 'open again')}</button></div>`;
  document.body.appendChild(ov);
  const wrap = ov.querySelector('.opener-cards');
  got.slice(0, 5).forEach((g, i) => { const n = cardEl(g.c, { cls: 'mini', own: null, tagIn: g.refund ? '+' + g.refund : null });
    n.style.setProperty('--i', i); wrap.appendChild(n); });
  setTimeout(() => { wrap.innerHTML = ''; got.forEach((g, i) => { const n = cardEl(g.c, { cls: 'micro', own: null, tagIn: g.refund ? '+' + g.refund : null });
    n.style.setProperty('--i', i % 12); wrap.appendChild(n); }); ov.querySelector('.opener-rift').style.display = 'none'; }, 1300);
  const top = got.filter(g => g.c.cp >= 2000 || hasTrigger(g.c) || g.c.protection);
  ov.querySelector('.opener-summary').innerHTML = `${mult} ${T('ซอง', 'packs')} · ${got.length} ${T('ใบ', 'cards')} · ` +
    [4, 6, 9].map(c => `Cost ${c}+ <b>${top.filter(g => g.c.cost >= c).length}</b>`).join(' · ') +
    (refund ? ` · ${T('เงินคืนใบซ้ำ', 'dupe refund')} <b>+${nf(refund)}</b>` : '');
  $$('button', ov)[0].addEventListener('click', () => { ov.remove(); render(); });
  $$('button', ov)[1].addEventListener('click', () => { ov.remove(); openPack(pack, 1); });
}
function vShop(m) {
  const r = rail(T('ร้านค้า · ซองการ์ดจริง', 'Shop · real-set packs'), nf(P().coins) + ' Coin');
  tools(r).appendChild(btnX(T('ใส่โค้ดรับรางวัล', 'redeem code'), () => $('#redeem-dialog').showModal(), 'ghost'));
  m.appendChild(r);
  const g = el('div', 'stat-grid'); g.style.marginBottom = '18px';
  const seen = CARDS.filter(c => (P().vault[c.id] || 0) > 0).length;
  g.innerHTML = statTile(nf(P().coins), 'COIN') + statTile(seen + '/' + CARDS.length, T('สะสมแล้ว', 'seen')) +
    statTile(nf(P().packs), T('จำนวนซอง', 'packs opened'), 'cy') + statTile(nf(P().rp), 'RP', 'vi');
  r.appendChild(g);
  const rate = el('div', 'panel'); rate.style.marginBottom = '20px';
  rate.innerHTML = `<h3>${T('โอกาสต่อใบ (lobby-side grade)', 'per-card odds (lobby-side grade)')}<small>${T('เกรดคำนวณตาม Cost เพราะงานพิมพ์จริงยังไม่มี rarity · ปรับตัวเลขได้ที่ ZF.ODDS', 'grades come from cost since the print has no rarity · edit ZF.ODDS')}</small></h3>
    <div class="oddsline">${['G1', 'G2', 'G3', 'G4'].map(k => `<span>${k} <b>${ZF.ODDS[k]}%</b> <i>${ZF.gradeLabel[k]}</i></span>`).join('')}</div>
    <p class="muted">${T('ทุกซองการันตี 1 ใบระดับ G2+/Trigger และใบซ้ำคืน Coin อัตโนมัติ', 'every pack guarantees one G2+/Trigger card and duplicates refund Coin automatically')}</p>`;
  r.appendChild(rate);
  ZF.packs.forEach(p => {
    const inSet = p.set ? CARDS.filter(c => c.file.startsWith(p.set)) : CARDS;
    const line = el('div', 'packline');
    line.innerHTML = `<div class="pack-img" style="--c1:${p.c1};--c2:${p.c2}"><img src="${scanOf(inSet[0])}" alt=""><b>${esc(p.no)}</b></div>
      <div class="pack-info"><h2>${esc(p.en)} <span class="tag">${esc(p.th)}</span></h2>
      <p class="muted">${L(p.desc)}</p>
      <div class="pack-odds"><span>${T('ในชุด', 'in set')} <b>${inSet.length} ${T('ใบ', 'cards')}</b></span>
        <span>${T('unit/command/terrain', 'unit/command/terrain')} <b>${inSet.filter(c => c.type === 'unit').length}/${inSet.filter(c => c.type === 'command').length}/${inSet.filter(c => c.type === 'terrain').length}</b></span>
        <span>${T('เคยเปิด', 'opened')} <b>${P().seen_packs?.[p.id] || 0}</b></span></div>
      <div class="pack-buy">
        <button class="primary"><span>1 ×</span><span class="price">${nf(p.price)}</span></button>
        <button><span>5 ×</span><span class="price">${nf(p.five)}</span><small>${T('ถูกกว่า 10%', 'save 10%')}</small></button>
        <button><span>10 ×</span><span class="price">${nf(p.ten)}</span><small>${T('ถูกกว่า 25%', 'save 25%')}</small></button>
        <button class="ghost">${T('ดูลิสต์การ์ดในซอง', 'catalogue')}</button></div></div>`;
    const [b1, b5, b10, bcat] = $$('button', line);
    b1.addEventListener('click', () => openPack(p, 1));
    b5.addEventListener('click', () => openPack(p, 5));
    b10.addEventListener('click', () => openPack(p, 10));
    bcat.addEventListener('click', () => {
      $('#pack-catalog-title').textContent = p.en + ' · ' + inSet.length + ' cards';
      $('#pack-catalog-note').textContent = L(p.desc);
      const tb = $('#pack-catalog .pack-catalog-toolbar'), ls = $('#pack-catalog .pack-catalog-list');
      tb.innerHTML = ''; ls.innerHTML = '';
      const paint = f => { ls.innerHTML = ''; inSet.filter(c => f === 'all' || c.color === f || c.type === f).forEach(c => ls.appendChild(cardEl(c, { own: P().vault[c.id] }))); };
      ['all', ...ZF.factions.map(x => x.id), 'unit', 'command', 'terrain'].forEach(k => {
        const b = el('button', 'chip' + (k === 'all' ? ' on' : ''), k === 'all' ? T('ทั้งหมด', 'all') : k);
        b.addEventListener('click', () => { $$('.chip', tb).forEach(x => x.classList.remove('on')); b.classList.add('on'); paint(k); }); tb.appendChild(b); });
      paint('all'); $('#pack-catalog').showModal();
    });
    r.appendChild(line);
  });
}

/* ── VIEW · COLLECTION ──────────────────────────────────────── */
let vaultFilter = { color: 'all', type: 'all', grade: 'all', kw: 'all', set: 'all', owned: false, q: '', sort: 'cost', list: false };
function vaultList() {
  let list = CARDS.slice(); const f = vaultFilter;
  if (f.color !== 'all') list = list.filter(c => c.color === f.color);
  if (f.type !== 'all') list = list.filter(c => c.type === f.type);
  if (f.grade !== 'all') list = list.filter(c => gradeOf(c) === f.grade);
  if (f.set !== 'all') list = list.filter(c => c.file.startsWith(f.set));
  if (f.kw !== 'all') list = list.filter(c => kws(c).includes(f.kw));
  if (f.owned) list = list.filter(c => (P().vault[c.id] || 0) > 0);
  if (f.q) { const q = f.q.toLowerCase();
    list = list.filter(c => (c.name + ' ' + c.file + ' ' + c.tribe + ' ' + c.color + ' ' + kws(c).join(' ') + (c.abilities || []).map(a => a.text).join(' ')).toLowerCase().includes(q)); }
  const s = { cost: (a, b) => a.cost - b.cost || b.cp - a.cp, cp: (a, b) => b.cp - a.cp,
    type: (a, b) => a.type.localeCompare(b.type) || a.cost - b.cost, color: (a, b) => a.color.localeCompare(b.color) || a.cost - b.cost,
    name: (a, b) => a.name.localeCompare(b.name), file: (a, b) => a.file.localeCompare(b.file),
    grade: (a, b) => gradeOf(b).localeCompare(gradeOf(a)) || a.cost - b.cost };
  return list.sort(s[f.sort] || s.cost);
}
function vCollection(m) {
  const owned = CARDS.filter(c => (P().vault[c.id] || 0) > 0).length;
  const r = rail(T('คลังการ์ด · ' + CARDS.length + ' ใบจริง', 'Vault · ' + CARDS.length + ' real cards'), Object.values(ZF.sets).join(' · '));
  const tl = tools(r);
  tl.appendChild(btnX(vaultFilter.list ? T('▦ บัตรการ์ด', '▦ cards') : T('☰ รายการย่อย', '☰ list'), () => { vaultFilter.list = !vaultFilter.list; render(); }, 'ghost'));
  tl.appendChild(btnX(T('คัดลอกรายชื่อ', 'copy list'), async () => {
    const txt = vaultList().map(c => `${P().vault[c.id] || 0}x ${c.file}  ${c.name}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast(T('คัดลอกแล้ว', 'copied')); } catch (e) { toast('clipboard blocked', true); }
  }, 'ghost'));
  const meter = el('div', 'vault-meter');
  const byCol = {}; CARDS.forEach(c => byCol[c.color] = (byCol[c.color] || 0) + (P().vault[c.id] > 0 ? 1 : 0));
  meter.innerHTML = `<span><b>${owned}</b>/${CARDS.length} ${T('ใบที่มี', 'cards owned')}</span>
    <span>${T('ความครบ', 'completion')} <b>${Math.round(owned / CARDS.length * 100)}%</b></span>
    ${ZF.factions.slice(0, 5).map(f => `<span><b style="color:${ZF.tone(f.id)}">${byCol[f.id] || 0}</b>/${CARDS.filter(c => c.color === f.id).length} ${f.id}</span>`).join('')}
    <span>[Trigger] <b>${CARDS.filter(c => hasTrigger(c) && P().vault[c.id]).length}/${CARDS.filter(hasTrigger).length}</b></span>
    <span>[Protection] <b>${CARDS.filter(c => c.protection && P().vault[c.id]).length}/${CARDS.filter(c => c.protection).length}</b></span>`;
  r.appendChild(meter);
  const chip = (grp, val, label, color) => { const neutral = val === 'all' || grp === 'owned' || grp === 'list';
    const b = el('button', 'chip' + (neutral ? ' neutral' : '') + (String(vaultFilter[grp]) === String(val) ? ' on' : ''));
    if (color) b.innerHTML = `<i class="dot" style="background:${color}"></i>`; b.append(label);
    b.addEventListener('click', () => { vaultFilter[grp] = grp === 'owned' ? !vaultFilter.owned : val; render(); }); return b; };
  const fgroup = (lab, cls) => { const g = el('div', 'fgroup' + (cls ? ' ' + (Array.isArray(cls) ? cls.join(' ') : cls) : ''));
    g.innerHTML = `<label>${lab}</label><div class="set"></div>`; r.appendChild(g); return g; };
  const col = fgroup(T('สี', 'colour')), setg = fgroup(T('ชุด', 'set')), tpg = fgroup(T('ชนิด · เกรด · แสดงผล', 'type · grade · view')),
    kwg = fgroup(T('keyword', 'keyword'), 'kw');
  const chipInto = (host, grp, val, label, color) => host.appendChild(chip(grp, val, label, color));
  chipInto(col.querySelector('.set'), 'color', 'all', T('ทุกสี', 'all colours'));
  ZF.factions.forEach(f => chipInto(col.querySelector('.set'), 'color', f.id, f.id, ZF.tone(f.id)));
  chipInto(setg.querySelector('.set'), 'owned', !vaultFilter.owned, T('เฉพาะที่มี', 'owned only'));
  ['all', ...SETS].forEach(x => chipInto(setg.querySelector('.set'), 'set', x, x === 'all' ? T('ทุกชุด', 'all sets') : x));
  ['all', 'unit', 'command', 'terrain'].forEach(x => chipInto(tpg.querySelector('.set'), 'type', x, x === 'all' ? T('ทุกชนิด', 'all types') : typeLabel(x)));
  ['all', 'G1', 'G2', 'G3', 'G4'].forEach(x => chipInto(tpg.querySelector('.set'), 'grade', x, x === 'all' ? T('ทุกเกรด', 'grade') : ZF.gradeLabel[x]));
  const lb = el('button', 'chip' + (vaultFilter.list ? ' on' : ''), vaultFilter.list ? T('▦ บัตรการ์ด', '▦ cards') : T('☰ รายการย่อย', '☰ list'));
  lb.addEventListener('click', () => { vaultFilter.list = !vaultFilter.list; render(); });
  tpg.querySelector('.set').appendChild(lb);
  [...new Set(CARDS.flatMap(kws))].forEach(k => chipInto(kwg.querySelector('.set'), 'kw', k, '[' + k + ']'));
  const kwMore = btnX(T('ขยาย ▾', 'expand ▾'), () => kwg.classList.toggle('open'), 'chip more'); kwg.querySelector('.set').appendChild(kwMore);
  const bar = el('div', 'sortbar'); bar.style.marginTop = '4px';
  const inp = el('input', 'searchbar'); inp.placeholder = T('ค้นหาชื่อ / โค้ด SD01-007 / tribe / keyword / text', 'search name, code, tribe, keyword or rules text');
  inp.value = vaultFilter.q; inp.addEventListener('input', () => { vaultFilter.q = inp.value; paint(vaultList()); }); bar.appendChild(inp);
  const sel = el('select'); sel.style.width = 'auto';
  const sortLab = { cost: T('เรียง: Cost', 'sort: cost'), cp: T('เรียง: Power', 'sort: power'), grade: T('เรียง: Grade', 'sort: grade'),
    type: T('เรียง: ชนิด', 'sort: type'), color: T('เรียง: สี', 'sort: colour'), name: T('เรียง: ชื่อ', 'sort: name'), file: T('เรียง: โค้ด', 'sort: code') };
  sel.innerHTML = Object.keys(sortLab).map(k => `<option value="${k}">${sortLab[k]}</option>`).join('');
  sel.value = vaultFilter.sort; sel.addEventListener('change', () => { vaultFilter.sort = sel.value; render(); }); bar.appendChild(sel);
  const cnt = el('span', 'tag', vaultList().length + ' ' + T('ใบ', 'cards')); bar.appendChild(cnt);
  r.appendChild(bar);
  const gWrap = el('div', vaultFilter.list ? 'list-view' : 'grid g-cards');
  const paint = list => {
    gWrap.className = vaultFilter.list ? 'list-view' : 'grid g-cards';
    gWrap.innerHTML = '';
    if (!list.length) { gWrap.classList.remove('grid'); gWrap.appendChild(el('div', 'empty', T('ไม่มีการ์ดตรงเงื่อนไข', 'nothing matches this filter'))); return; }
    list.forEach(c => {
      if (vaultFilter.list) {
        const row = el('div', 'list-row'); row.style.setProperty('--tone', ZF.tone(c.color));
        row.innerHTML = `<img src="${artOf(c)}" alt="" loading="lazy"><div class="lr-main"><b>${esc(c.file)} · ${esc(c.name)}</b>
          <span class="lr-sub" style="color:${ZF.tone(c.color)}">${esc(c.color)} · ${esc(c.tribe)} · ${typeLabel(c.type)}</span>
          <span class="lr-txt">${(c.abilities || []).map(a => `<i>[${esc(a.kw)}]</i> ${esc(a.text.slice(0, 160))}${a.text.length > 160 ? '…' : ''}`).join(' ')}</span></div>
          <div class="lr-num"><span>Cost <b>${c.cost}</b></span>${c.cp ? `<span>CP <b>${fmtCP(c.cp)}</b></span>` : ''}<span>${gradeOf(c)}</span>
          <button>${T('ดู', 'open')}</button></div>`;
        row.querySelector('button').addEventListener('click', () => openDetail(c));
        row.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') openDetail(c); });
        gWrap.appendChild(row);
      } else gWrap.appendChild(cardEl(c, { own: P().vault[c.id] }));
    });
    cnt.textContent = list.length + ' ' + T('ใบ', 'cards');
  };
  paint(vaultList()); r.appendChild(gWrap); m.appendChild(r);
}

/* ── VIEW · DECKS ───────────────────────────────────────────── */
let poolFilter = 'all';
function activeDeck() { const p = P(); return p.decks.find(d => d.id === (editingDeck || p.activeDeck)) || p.decks[0]; }
let editingDeck = null;
function vDecks(m) {
  const p = P();
  const r = rail(T('แผงเด็ค · deckcheck V.24', 'Deck board · deckcheck V.24'), `${R.deckMin}–${R.deckMax} ใบ · ≤${R.maxCopy} ซ้ำ · สีหลัก ≥50% · [Protection] ≤${R.protectionLimit}`);
  const tl = tools(r);
  tl.appendChild(btnX(T('นำเข้าจากรหัส/รายชื่อ', 'import code / list'), () => { $('#deck-import-form').reset(); $('#import-error').style.display = 'none'; $('#deck-import-dialog').showModal(); }, 'ghost'));
  tl.appendChild(btnX(T('+ เด็คใหม่', '+ new deck'), () => {
    const name = prompt(T('ชื่อเด็ค', 'deck name'), T('เด็คของฉัน ', 'My deck ') + (p.decks.length + 1)); if (!name) return;
    const d = { id: 'D' + Date.now().toString(36), name: name.slice(0, 42), color: 'Green', main: [], extra: [] };
    p.decks.push(d); p.activeDeck = d.id; editingDeck = d.id; save(); render();
  }, 'primary'));
  m.appendChild(r);

  if (!p.decks.length) {
    const box = el('div', 'panel hi');
    box.innerHTML = `<h3>${T('เลือกเด็คทางการเป็นจุดเริ่ม', 'start from an official list')}<small>${officialKeys().map(k => DECKS[k].name).join(' · ')}</small></h3>
      <p class="muted">${T('ปุ่มด้านล่างคัดลอกเด็คที่ผ่าน deckcheck มาแล้ว 100% เข้าบัญชีคุณ แล้วค่อย tweaks ต่อ — หรือสร้างเด็คเปล่าจากศูนย์', 'these copy a deckcheck-clean list into your account so you can tweak it — or build from zero')}</p>
      <div class="official-decks"></div>`;
    const w = box.querySelector('.official-decks');
    officialKeys().forEach(k => {
      const D = DECKS[k], ck = deckCheck(officialDeck(k));
      const t = el('div', 'tier'); t.style.maxWidth = '320px';
      const cnt = {}; D.main.forEach(id => cnt[CARD(id).color] = (cnt[CARD(id).color] || 0) + 1);
      t.innerHTML = `<b style="color:${ZF.tone(D.color)}">${esc(D.name)}</b><span>${D.main.length} main · ${(D.extra || []).length} extra · ${T('สีหลัก', 'primary')} ${esc(D.color)} ${Math.round(100 * (cnt[D.color] || 0) / D.main.length)}%</span>
        <span class="muted">${ck.ok ? T('ผ่าน deckcheck', 'deckcheck OK') : ck.errs.join(' · ')}</span>`;
      const b = btnX(T('คัดลอกเข้าบัญชี', 'copy to account'), () => { const d = officialDeck(k); d.id = 'D' + Date.now().toString(36); d.official = false;
        p.decks.push(d); p.activeDeck = d.id; editingDeck = d.id; save(); toast(T('เพิ่ม ', 'added ') + d.name); render(); }, 'primary');
      b.style.marginTop = '10px'; t.appendChild(b); w.appendChild(t);
    });
    r.appendChild(w); m.appendChild(r); return;
  }

  const sw = el('div', 'deck-switch');
  p.decks.forEach(d => { const ck = deckCheck(d);
    const b = el('button', 'chip' + (d.id === activeDeck().id ? ' on' : ''));
    b.innerHTML = `${esc(d.name)} <span class="num ${ck.ok ? 'good' : 'bad'}">${deckSize(d)} ${T('ใบ', 'cards')}</span>`;
    b.addEventListener('click', () => { p.activeDeck = d.id; editingDeck = d.id; save(); render(); }); sw.appendChild(b); });
  const del = btnX('✕ ' + T('ลบ', 'delete'), () => { if (!confirm(T('ลบเด็คนี้?', 'delete this deck?'))) return;
    p.decks = p.decks.filter(x => x.id !== activeDeck().id); p.activeDeck = p.decks[0]?.id; editingDeck = null; save(); render(); }, 'ghost');
  del.style.borderColor = 'rgba(255,91,74,.4)'; del.style.color = '#ffb9b0'; sw.appendChild(del);
  m.appendChild(sw);

  const d = activeDeck(), ck = deckCheck(d);
  const two = el('div', 'g-side');

  /* left = deck list + stats */
  const left = el('div');
  const stat = el('div', 'panel hi');
  stat.innerHTML = `<h3>${esc(d.name)}<small>${T('สีหลัก', 'primary')} <b style="color:${ZF.tone(ck.primary || 'Colorless')}">${esc(ck.primary || '—')} ${ck.stat.pct}%</b> · ${T('คู่สี', 'secondary')}: ${ck.stat.secondaries.join(', ') || '—'} · [Protection] ${ck.prot}/${R.protectionLimit}</small></h3>
    <div class="deckstat-grid">${statTile(ck.size, T('เด็คหลัก', 'main deck'))}${statTile(ck.units, T('ชนิดยูนิต', 'unit kinds'))}
      ${statTile(ck.terr, T('terrain', 'terrain kinds'))}${statTile(nf(avgCost(d)), T('Cost เฉลี่ย', 'avg cost'), 'cy')}</div>
    <div class="curve2"><div class="head">${T('กระจาย Cost · ใบต่อ Cost', 'cost spread · cards per cost')}</div>${curve(d).slice(1).map((n, i) => `<div class="row${n ? '' : ' zero'}"><span>${i + 1}</span><i><em style="width:${clamp(n / 16 * 100, n ? 8 : 0, 100)}%"></em></i><b>${n}</b></div>`).join('')}</div>
    <div class="colorbar">${Object.entries(ck.stat.c).map(([k, v]) => `<i style="flex:${v};background:${ZF.tone(k)}" title="${k} ${v}"></i>`).join('')}</div>
    ${ck.errs.map(e => `<p class="room-error">✕ ${esc(e)}</p>`).join('') || `<p class="ok">✓ ${T('ผ่าน deckcheck ครบทุกข้อ', 'passes every deckcheck rule')}</p>`}
    ${ck.warn.map(w => `<p class="warn">⚠ ${esc(w)}</p>`).join('')}`;
  const lists = el('div', 'panel hi'); 
  const mkList = (title, arr, key) => {
    const box = el('div'); box.innerHTML = `<h3>${title}<small>${T('คลิกการ์ดในคลังเพื่อเพิ่ม', 'click a vault card to add')}</small></h3>`;
    const w = el('div', 'deckline-lists');
    const sorted = arr.slice().sort((a, b) => (CARD(b.id)?.cost || 0) - (CARD(a.id)?.cost || 0));
    const byColor = {}; sorted.forEach(x => { const c = CARD(x.id); (byColor[c.color] ||= []).push(x); });
    Object.keys(byColor).sort().forEach(col => {
      const hd = el('div', 'tag'); hd.style.cssText = 'color:' + ZF.tone(col) + ';margin:12px 0 6px'; hd.textContent = col;
      w.appendChild(hd);
      byColor[col].forEach(x => {
        const c = CARD(x.id);
        const row = el('div', 'deck-row'); row.style.setProperty('--tone', ZF.tone(c.color));
        row.innerHTML = `<img src="${artOf(c)}" alt="" loading="lazy"><div class="dr-main"><b>${esc(c.name)}</b><span>${esc(c.file)} · ${typeLabel(c.type)} · Cost ${c.cost}${c.cp ? ' · ' + fmtCP(c.cp) + ' CP' : ''} · ${kws(c).map(k => `<i class="chip-kw">${esc(k)}</i>`).join(' ')}</span></div>
          <span class="qty"><button>−</button><b>×${x.n}</b><button>+</button><button class="max">MAX</button></span>`;
        const [mn, pl, mx] = row.querySelectorAll('.qty button');
        mn.addEventListener('click', () => { x.n--; const target = key === 'main' ? d.main : d.extra;
          if (x.n <= 0) { const i = target.findIndex(y => y.id === x.id); if (i >= 0) target.splice(i, 1); } save(); render(); });
        pl.addEventListener('click', () => { if (x.n >= R.maxCopy) return toast(T('ซ้ำได้ 3 ใบ', 'max 3 copies'), true);
          if (key === 'main' && deckSize(d) >= R.deckMax) return toast(T('เด็คหลักเต็ม ' + R.deckMax, 'main deck full'), true);
          x.n++; save(); render(); });
        mx.addEventListener('click', () => { x.n = R.maxCopy; const tot = deckSize(d); if (tot > R.deckMax) x.n -= tot - R.deckMax; save(); render(); });
        row.addEventListener('click', e => { if (!e.target.closest('.qty')) openDetail(c); });
        w.appendChild(row);
      });
    });
    if (!arr.length) w.appendChild(el('div', 'empty', T('ยังว่าง · แตะการ์ดทางซ้ายเพื่อเพิ่ม', 'empty · tap a card on the right')));
    box.appendChild(w); return box;
  };
  lists.appendChild(mkList(T('เด็คหลัก (Main)', 'Main deck'), d.main, 'main'));
  left.appendChild(lists);
  left.appendChild(stat);
  const acts = el('div', 'panel'); acts.style.marginTop = '16px';
  const ni = el('input'); ni.value = d.name; ni.addEventListener('change', () => { d.name = ni.value.slice(0, 42) || 'untitled'; save(); render(); });
  acts.innerHTML = `<h3>${T('การกระทำ', 'actions')}</h3>`;
  const wrapName = el('label', 'named'); wrapName.innerHTML = `<span>${T('ชื่อเด็ค', 'deck name')}</span>`; wrapName.appendChild(ni); acts.appendChild(wrapName);
  const row = el('div', 'actions'); row.style.marginTop = '12px';
  row.appendChild(btnX(T('⚔ ส่งเข้าสนามจริง', '⚔ send to engine'), () => { if (!ck.ok) return toast(T('เด็คยังผิดกติกา', 'deck fails deckcheck'), true);
    launchMatch({ own: d.id, foe: pick(officialKeys()), first: 'p0' }); }, 'primary'));
  row.appendChild(btnX(T('แชร์รหัส', 'share'), () => shareDeck(d), 'ghost'));
  row.appendChild(btnX(T('คัดลอกdejcllist', 'copy list'), async () => { try { await navigator.clipboard.writeText(deckToText(d)); toast(T('คัดลอกแล้ว', 'copied')); } catch (e) { toast('clipboard blocked', true); } }, 'ghost'));
  row.appendChild(btnX(T('ล้าง', 'clear'), () => { if (confirm('clear?')) { d.main = []; d.extra = []; save(); render(); } }, 'danger'));
  acts.appendChild(row); left.appendChild(acts);
  two.appendChild(left);

  /* right = pool picker */
  const right = el('div', 'panel hi');
  right.innerHTML = `<h3>${T('คลังที่เลือกได้', 'pick from vault')}<small>${T('แสดงเฉพาะใบที่มีในคลัง · เฉพาะสีที่เด็คใช้ + Colorless', 'owned cards · your colours + Colorless')}</small></h3>`;
  const pbar = el('div', 'filters'); poolFilter === 'all';
  ['all', ...ZF.factions.map(f => f.id)].forEach(k => { const b = el('button', 'chip' + (poolFilter === k ? ' on' : ''), k === 'all' ? T('ทั้งหมด', 'all') : k);
    b.addEventListener('click', () => { poolFilter = k; render(); }); pbar.appendChild(b); });
  right.appendChild(pbar);
  const pg = el('div', 'pool-grid');
  CARDS.filter(c => (P().vault[c.id] || 0) > 0).filter(c => poolFilter === 'all' || c.color === poolFilter || c.color === 'Colorless')
    .sort((a, b) => a.cost - b.cost || b.cp - a.cp).forEach(c => {
      const inDeck = nOf(d, c.id) > 0;
      const n = cardEl(c, { own: P().vault[c.id], cls: inDeck ? 'in-deck' : '' });
      n.addEventListener('click', () => {
        if (c.color !== (ck.primary || c.color) && c.color !== 'Colorless') {
          const st2 = colorStat(d); if (st2.secondaries.length >= 1 && !st2.secondaries.includes(c.color) && deckSize(d)) return toast(T('คู่สีรองได้ 1 สี · ลองเปลี่ยนสีหลักหรือลบใบสีอื่น', 'only one secondary colour allowed'), true);
        }
        if (c.protection && d.main.filter(x => CARD(x.id).protection).length >= R.protectionLimit && !nOf(d, c.id)) return toast(T('โควตา [Protection] เต็ม ' + R.protectionLimit, '[Protection] quota full'), true);
        if (deckSize(d) >= R.deckMax && !nOf(d, c.id)) return toast(T('เด็คหลักเต็ม ' + R.deckMax, 'main deck full'), true);
        const x = d.main.find(y => y.id === c.id);
        if (x) { if (x.n >= R.maxCopy) return toast(T('ซ้ำครบ 3 ใบ', 'max 3 copies'), true); x.n++; } else d.main.push({ id: c.id, n: 1 });
        d.color = d.color || colorStat(d).primary; save(); render();
      });
      pg.appendChild(n);
    });
  const addToExtra = el('div'); addToExtra.className = 'muted'; addToExtra.style.marginTop = '10px';
  const exBtn = el('div', 'actions');
  /* V.25: ไม่มี Extra Zone — ปุ่มนี้เหลือไว้เป็น "เพิ่มใบที่พิมพ์มา" */
  exBtn.appendChild(btnX(T('เติมจากการ์ดที่พิมพ์รหัส', 'add by typed card code'), () => {
    const pick2 = prompt(T('พิมพ์โค้ดการ์ด เช่น SD01-007', 'card code, e.g. SD01-007'), 'SD01-010');
    const hit = cardIdOf((pick2 || '').toUpperCase().trim());
    if (!hit) return toast(T('ไม่พบใบนั้น', 'not found'), true);
    const st = colorStat(d); const c = CARD(hit);
    if (c.color !== st.primary && c.color !== 'Colorless' && st.secondaries.length >= 1 && !st.secondaries.includes(c.color)) return toast(T('คู่สีรองได้ 1 สี', 'one secondary colour max'), true);
    let x = d.main.find(y => y.id === hit); if (x) { if (x.n >= R.maxCopy) return toast(T('ซ้ำครบ 3 ใบ', 'max 3 copies'), true); x.n++; }
    else { if (deckSize(d) >= R.deckMax) return toast(T('เด็คเต็ม ' + R.deckMax, 'deck full'), true); d.main.push({ id: hit, n: 1 }); }
    save(); render();
  }, 'ghost'));
  right.appendChild(pg); right.appendChild(exBtn); right.appendChild(addToExtra);
  two.appendChild(right); m.appendChild(two);
}
function avgCost(d) { const cs = deckMain(d); if (!cs.length) return 0;
  return +(cs.reduce((a, c) => a + c.cost * nOf(d, c.id), 0) / deckSize(d)).toFixed(2); }
function shareDeck(d) {
  const code = shareCode(d), ck = deckCheck(d);
  $('#share-title').textContent = d.name;
  $('#share-deck-meta').innerHTML = `${deckSize(d)} main + ${deckExtraSize(d)} extra · ${esc(ck.primary || '—')} ${ck.stat.pct}% · [Protection] ${ck.prot} · ${ck.ok ? T('ผ่าน deckcheck', 'deckcheck OK') : T('ยังไม่ผ่าน', 'illegal')}`;
  $('#share-code-display').textContent = code;
  const board = $('#share-deck-board'); board.innerHTML = '';
  const bd = el('div', 'board');
  bd.innerHTML = `<div class="board-title">SHARE DECK · <b>${esc(d.name)}</b> · ${code} · ${T('ใช้ได้ 30 วัน', 'valid 30 days')}</div>`;
  const g = el('div', 'board-grid');
  deckMain(d).forEach(c => { const n = cardEl(c, { cls: 'mini', click: false, own: null });
    n.appendChild(Object.assign(el('span', 'rc-own'), { textContent: '×' + nOf(d, c.id) })); g.appendChild(n); });
  bd.appendChild(g); board.appendChild(bd);
  $('#deck-share-dialog').showModal();
}

/* ── VIEW · BATTLE (engine setup) ───────────────────────────── */
function vBattle(m) {
  const p = P();
  const r = rail(T('สนามรบ · เปิด engine จริง', 'Battle · the live engine'),
    T('lobby ไม่จำลองกติกาเอง — ทุกเกมรันบน engine ชุดเดียวกับที่ใช้เล่น Solo vs AI (5 แถว×3 ช่อง, 7 Core Point, Flare 3→8)',
      'the lobby never simulates: every game runs on the shipped Solo-vs-AI engine (5×3 lanes, 7 Core Point, Flare 3→8)'));
  m.appendChild(r);
  const legal = legalDecks();
  const two = el('div', 'g-side');
  const form = el('div', 'panel hi');
  if (!legal.length) {
    const e = el('div', 'empty');
    e.innerHTML = `${T('ยังไม่มีเด็คที่ผ่าน deckcheck', 'no deckcheck-clean deck yet')}<div style="margin-top:12px"></div>`;
    e.lastChild.appendChild(btnX(T('ไปสร้างเด็ค', 'build a deck'), () => go('decks'), 'primary'));
    form.appendChild(e);
  } else {
    const f = el('div', 'engine-form');
    const sel = (id, opts, lab) => `<label>${lab}<select id="${id}">${opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select></label>`;
    const deckOpts = legal.map(d => [d.id, `${d.name} · ${deckSize(d)}+${deckExtraSize(d)} · ${colorStat(d).primary}`]);
    const foeOpts = officialKeys().map(k => [k, DECKS[k].name]).concat(legal.filter(d => d.id !== legal[0].id).map(d => ['LB:' + d.id, d.name + ' (mirror)']));
    const firstOpts = [['p0', T('คุณเริ่มก่อน', 'you start first')], ['p1', 'AI ' + T('เริ่มก่อน', 'starts first')], ['rps', 'o / p / s ' + T('ทายกันหน้างาน', 'rock-paper-scissors')]];
    const fieldOpts = ZF.skins.filter(s => s.type === 'field').map(s => [s.id, L({ th: s.th, en: s.en })]);
    f.innerHTML = sel('selMyDeck', deckOpts, T('เด็คของคุณ', 'your deck')) +
      sel('selFoeDeck', foeOpts, T('เด็คฝั่ง AI', 'AI deck')) +
      sel('selFirst', firstOpts, T('ผู้เริ่มก่อน', 'who starts')) +
      sel('selField', fieldOpts, T('ฉากสนาม', 'field theme')) +
      `<label class="room-watch-toggle"><span>${T('Best of 3', 'Best of 3')}<small>${T('บันทึกผลรายเกมเข้าแรงก์และอีเวนต์', 'each game is banked into rank + events')}</small></span><input id="chkBo3" type="checkbox" role="switch"></label>
       <div class="actions"></div>`;
    const eq = p.equipped || {};
    f.querySelector('#selField').value = eq.field || 'FIELD-BLUE';
    const acts = f.querySelector('.actions');
    acts.appendChild(btnX(T('⚔ เข้าสนาม', '⚔ deploy'), () => {
      const fieldSel = f.querySelector('#selField').value;
      if (fieldSel !== eq.field) { p.equipped ||= {}; p.equipped.field = fieldSel; save(); }
      const foeVal = f.querySelector('#selFoeDeck').value;
      ZFStage.open({ own: f.querySelector('#selMyDeck').value, foe: foeVal.replace(/^LB:/, ''),
        first: f.querySelector('#selFirst').value, bo: f.querySelector('#chkBo3').checked ? 3 : 1 });
    }, 'primary'));
    acts.appendChild(btnX(T('เปิด engine เต็มจอในแท็บใหม่', 'open engine full-screen (new tab)'),
      () => window.open(ZF.game, '_blank', 'noopener'), 'ghost'));
    acts.appendChild(btnX(T('กติกาบนหน้าจอ (rulebook)', 'on-screen rules (rulebook)'),
      () => window.open('game/index.html', '_self'), 'ghost'));
    form.appendChild(f);
  }
  two.appendChild(form);
  const side = el('div');
  const info = el('div', 'panel');
  info.innerHTML = `<h3>${T('ก่อนลงสนาม', 'before you deploy')}<small>Dev V.24</small></h3>
    <ol class="flow">
      <li>${T('ส่งยูนิต/Command ลงแถวหลังของคุณ (แถว 5) · Terrain วางแถวหน้า (แถว 4)', 'drop units/commands on your back row (5) · terrain goes on your front row (4)')}</li>
      <li>${T('Flare เริ่ม 3 เพิ่ม 1 ทุกเทิร์น (เพดาน 8) ไม่สะสมข้ามเทิร์น', 'Flare starts at 3, +1 each turn, ceiling 8, no carry-over')}</li>
      <li>${T('ยูนิต 1 ตัวทำอะไร 1 อย่าง/เทิร์น · เดิน 1 ช่องฟรี · โจมตี 1 Flare · โจมตีได้แค่หน้า/ซ้าย/ขวา', 'one action per unit · free 1-step walk · attack costs 1 Flare and hits front/left/right only')}</li>
      <li>${T('ต่อสู้แบบพลังค้าง: CP เราไปลบ CP เขา เหลือ 0 = Outzone · เราไม่เสียพลัง', 'persistent power: your CP subtracts theirs; at 0 they are Outzoned and you pay nothing')}</li>
      <li>${T('ทุกแอ็คเปิดหน้าต่างให้อีกฝ่ายตอบโต้ 1 ครั้งด้วย [Quick-Cast]/[Counter]', 'every action opens one response window for [Quick-Cast]/[Counter] cards')}</li>
      <li>${T('End Phase: นับคะแนนใน Core Zone (แถว 3) → Trigger Check → Terrain สลาย → เช็ค 7 แต้ม', 'End Phase: count units in the Core Zone → Trigger Check → terrain fades → check 7 points')}</li>
    </ol>`;
  side.appendChild(info);
  const rec = el('div', 'panel'); rec.style.marginTop = '16px';
  const t = tally();
  rec.innerHTML = `<h3>${T('สถิติจาก engine', 'engine record')}<small>localStorage zf_tally</small></h3>
    <div class="stat-grid">${statTile(t.w, T('ชนะ', 'wins'))}${statTile(t.l, T('แพ้', 'losses'), 'ru')}${statTile(p.wins + '-' + p.losses, T('lobby record', 'lobby record'), 'cy')}${statTile(nf(p.rp), 'RP', 'vi')}</div>
    <p class="muted" style="margin-top:10px">${T('lobby อ่านค่า zf_tally ที่ engine เขียนไว้ แล้วแปลงเป็น Coin/RP ให้อัตโนมัติ — ไม่ต้องกรอกผลเอง', 'the lobby reads the zf_tally the engine writes and converts it into Coin/RP automatically')}</p>`;
  side.appendChild(rec);
  two.appendChild(side); m.appendChild(two);
  if (p.matches.length) {
    const rh = rail(T('ประวัติการแข่งขัน', 'match history'));
    const tb = el('div', 'panel');
    tb.innerHTML = `<table class="tbl"><thead><tr><th>${T('ผล', 'result')}</th><th>Deck</th><th>${T('ฝ่ายตรงข้าม', 'opponent')}</th><th>Coin</th><th>RP</th><th>${T('โหมด', 'mode')}</th><th>${T('เวลา', 'time')}</th></tr></thead>
      <tbody>${p.matches.map(x => `<tr><td class="${x.win ? 'pos' : 'neg'}">${x.win ? 'WIN' : 'LOSS'}</td><td>${esc(x.deck)}</td><td>${esc(x.foe)}</td>
        <td class="num">${nf(x.coins)}</td><td class="num">${esc(x.rp)}</td><td>${x.event ? esc(x.event) : 'RIFT'}</td>
        <td class="muted">${new Date(x.at).toLocaleString(LANG === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td></tr>`).join('')}</tbody></table>`;
    rh.appendChild(tb); m.appendChild(rh);
  }
}

/* ── VIEW · WATCH ───────────────────────────────────────────── */
let watchFilter = 'all';
function vWatch(m) {
  const p = P();
  const r = rail(T('รับชม · ห้องที่เปิดอยู่', 'Watch · open rooms'), T('engine ทำงานในเครื่องคุณ · ห้องคือรายนัดที่ lobby ตั้งไว้ให้', 'the engine runs locally · rooms are pre-set matchups'));
  const tl = tools(r);
  ['all', 'live', 'event'].forEach(k => { const b = el('button', 'chip' + (watchFilter === k ? ' on' : ''), k === 'all' ? T('ทั้งหมด', 'all') : k);
    b.addEventListener('click', () => { watchFilter = k; render(); }); tl.appendChild(b); });
  m.appendChild(r);
  const mine = (p.watchRooms || []);
  const rooms = ROOMS.filter(x => watchFilter === 'all' || (watchFilter === 'event' ? x.event : x.live)).concat(mine.map(x => ({ ...x, live: true, mine: true })));
  rooms.forEach(rm => {
    const row = el('div', 'room-row');
    row.innerHTML = `<b style="color:${ZF.tone(rm.clan || 'Blue')}">${esc(rm.a)}</b><span class="tag">VS</span><b>${esc(rm.b)}</b>
      <span class="vs">${rm.mine ? '<span class="badge open">' + T('ห้องของคุณ', 'your room') + '</span> ' : ''}${rm.live ? '<span class="badge live">LIVE</span> ' : ''}${esc(rm.mode)} · ${T('ผู้ชม', 'viewers')} ${nf(rm.viewers || 0)}${rm.event ? ' · ' + rm.event : ''}</span>`;
    row.appendChild(btnX(T('▶ เปิดนัดนี้', '▶ load this'), () => {
      const legal = legalDecks(); if (!legal.length) return toast(T('ต้องมีเด็คถูกกติกา 1 ชุด', 'needs one legal deck'), true);
      const d = legal.find(x => x.id === rm.ownDeck) || legal[0];
      ZFStage.open({ own: d.id, foe: rm.bot && DECKS[rm.bot] ? rm.bot : pick(officialKeys()), first: rm.first || 'p1', event: rm.event });
    }, 'primary'));
    r.appendChild(row);
  });
  const note = el('div', 'panel'); note.style.marginTop = '18px';
  note.innerHTML = `<h3>${T('ห้องที่สร้างจากหน้านี้', 'rooms you create here')}</h3>
    <p class="muted">${T('กด “สร้างห้อง” เพื่อเปิด engine ด้วยเด็คที่เลือก แล้วเอารหัสไปให้เพื่อน · ระบบยังไม่มีเซิร์ฟเวอร์ จึงเป็นการนัดในเครื่องของคุณ (รอตอนต่อ peer/audio room)',
      'hit create-room to launch the engine with your deck and share the code · there is no server yet, so matchmaking is local for now')}</p>`;
  note.appendChild(btnX(T('+ สร้างห้อง & เปิดสนาม', '+ create room & deploy'), () => createRoom(), 'primary'));
  m.appendChild(note);
}
const ROOMS = [
  { a: 'VerdantSylvan', b: 'BlueMachina', clan: 'Green', mode: 'BO1 · Rift Open R3', viewers: 612, live: true, bot: 'machina', first: 'p1', event: 'EV-01' },
  { a: 'Machina_OP', b: 'NyxVoid', clan: 'Purple', mode: 'Gauntlet W4', viewers: 188, live: true, bot: 'sylvan', first: 'p0' },
  { a: 'AshenHellfire', b: 'ThronisAscend', clan: 'Red', mode: 'Cross-set mirror', viewers: 96, live: true, bot: 'machina', first: 'rps' },
  { a: 'OutlandGear', b: 'SylvanSprint', clan: 'Colorless', mode: 'Casual', viewers: 41, live: false, bot: 'sylvan', first: 'p1' }
];

/* ── VIEW · RANKED ──────────────────────────────────────────── */
function ladderRows() {
  const rnd = seeded('lb' + Math.floor(Date.now() / 36e5));
  const names = ['VerdantSylvan', 'Machina_OP', 'NyxVoid', 'ThronisAsc', 'AshenRush', 'OutlandGear', 'SylvanSprint', 'DeepwoodNest',
    'HallSilence', 'OskopusFan', 'DiomediumMain', 'EsperNo71', 'RinBlades', 'DrainBreaker', 'AhenlaHunt', 'CholeMedium',
    'AngelicaX', 'PowreLink', 'CereWild', 'EmmaHiker', 'WofarShow', 'PhllitSurf', 'AndruaTrip', 'TargetSearch'];
  const cols = ZF.factions.slice(0, 5).map(f => f.id);
  return names.map((n, i) => ({ name: n, rp: 4200 - i * 96 - Math.floor(rnd() * 70) + (n === S.name ? P().rp : 0),
    color: cols[Math.floor(rnd() * cols.length)], arch: pick(['Sylvan tempo', 'Machina value', 'Void control', 'Hellfire aggro', 'Celestial ascend', 'Outland protect']) }))
    .sort((a, b) => b.rp - a.rp).map((x, i) => ({ ...x, rank: i + 1 }));
}
function vRanked(m) {
  const p = P(), rows = ladderRows(), mine = rows.findIndex(r => r.name === S.name) + 1;
  const tier = tierOf(p.rp), next = ZF.tiers[ZF.tiers.indexOf(tier) + 1], t = tally();
  const r = rail(T('แรงก์ · Zone Ladder', 'Ranked · Zone ladder'), T('คะแนนมาจากผลที่ engine รายงานจริง', 'points come from real engine results'));
  m.appendChild(r);
  const sg = el('div', 'stat-grid'); sg.style.marginBottom = '20px';
  sg.innerHTML = statTile(nf(p.rp), 'RP') + statTile(mine || '—', T('อันดับลัดดา', 'LADDER'), 'cy') + statTile(tier.id, T('โซนปัจจุบัน', 'ZONE'), 'vi') +
    statTile(p.wins + '-' + p.losses, 'W-L', 'go') + statTile(p.winStreak || 0, T('ชนะรวด', 'STREAK'), 'ru') + statTile(`${t.w}-${t.l}`, T('engine record', 'engine record'));
  r.appendChild(sg);
  const tl = el('div', 'ladder-tiers');
  ZF.tiers.forEach(x => { const b = el('div', 'tier' + (x.id === tier.id ? ' cur' : ''));
    b.innerHTML = `<b>${x.id}</b><span>${esc(x.en.replace(/^ZONE \d+ · /, ''))}</span><span>${esc(x.th.replace(/^โซน \d+ · /, ''))} · ${nf(x.pts)} RP</span>`; tl.appendChild(b); });
  r.appendChild(tl);
  if (next) { const bar = el('div', 'bar'); bar.style.marginTop = '14px';
    bar.innerHTML = `<i style="width:${clamp(Math.round((p.rp - tier.pts) / (next.pts - tier.pts) * 100), 0, 100)}%"></i>`; r.appendChild(bar);
    r.appendChild(el('p', 'muted', `${T('อีก', 'need')} ${nf(next.pts - p.rp)} RP → ${next.id}`)); }
  const two = el('div', 'g-side'); two.style.marginTop = '18px';
  const tb = el('div', 'panel');
  tb.innerHTML = `<h3>Top ${rows.length}</h3><div style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>${T('สี/แนวทาง', 'colour / plan')}</th><th>RP</th></tr></thead><tbody>${
    rows.map(x => `<tr${x.name === S.name ? ' class="me"' : ''}><td class="num">${x.rank}</td><td>${x.name === S.name ? '<b style="color:var(--lime)">' + esc(x.name) + ' ★</b>' : esc(x.name)}</td>
      <td><span style="color:${ZF.tone(x.color)}">${esc(x.color)}</span> ${esc(x.arch)}</td><td class="num">${nf(x.rp)}</td></tr>`).join('')}</tbody></table></div>`;
  two.appendChild(tb);
  const side = el('div');
  const sc = el('div', 'panel hi');
  sc.innerHTML = `<h3>${T('การคิดคะแนน', 'scoring')}<small>lobby V.24</small></h3>
    <div class="kv"><span>${T('ชนะ 1 เกม', 'game win')}</span><b>+60 RP · +800 Coin</b></div>
    <div class="kv"><span>${T('ชนะในอีเวนต์', 'event win')}</span><b>+120 RP · +1,500 Coin</b></div>
    <div class="kv"><span>${T('แพ้', 'loss')}</span><b class="neg">−20 / −30 RP</b></div>
    <div class="kv"><span>${T('ชนะรวด 3', '3 win streak')}</span><b>+2,000 Coin</b></div>
    <div class="kv"><span>${T('เข้าอีเวนต์', 'event entry')}</span><b>+40 RP ${T('(ครั้งแรก)', '(first time)')}</b></div>
    <p class="muted" style="margin-top:12px">${T('แรงก์/อีเวนต์บังคับใช้ข้อจำกัดการ์ดในแท็บ ต้องห้าม — เด็คที่ผิดเกินโควตาจะถูกปฏิเสธตอนเข้าสนาม',
      'ranked & events enforce the restriction list in the Ban tab — decks past a cap are refused at entry')}</p>
    <div style="margin-top:12px"></div>`;
  side.appendChild(sc);
  const res = el('div', 'panel'); res.style.marginTop = '16px';
  res.innerHTML = `<h3>${T('ข้อจำกัดแรงก์ (affected)', 'ranked restrictions')}<small>deckcheck.js + lobby</small></h3>`;
  ZF.ban.forEach(b => { const c = CARD(b.id); if (!c) return; const row = el('div', 'krow');
    row.innerHTML = `<img src="${artOf(c)}" alt=""><div><b>${esc(c.name)}</b><span>${b.lim === 0 ? T('ห้ามใช้', 'BANNED') : T('ใช้ได้ ' + b.lim + ' ใบ', 'max ' + b.lim)}</span></div>
      <button>${T('ส่งเข้า engine', 'to engine')}</button>`;
    row.querySelector('button').addEventListener('click', () => { const d = legalDecks()[0]; if (!d) return toast(T('ยังไม่มีเด็คถูกกติกา', 'no legal deck'), true); ZFStage.open({ own: d.id, foe: d.id, first: 'rps' }); });
    res.appendChild(row); });
  side.appendChild(res); two.appendChild(side); m.appendChild(two);
}

/* ── VIEW · CUSTOMIZATION ───────────────────────────────────── */
function vCustom(m) {
  const p = P(); p.equipped ||= {};
  const r = rail(T('ปรับแต่ง · ใช้ asset จริงของเกม', 'Customization · shipped assets'), nf(p.coins) + ' Coin');
  m.appendChild(r);
  const groups = { field: T('ฉากสนาม (มีผลตอนเปิด engine)', 'field theme (applies to the engine)'),
    avatar: T('อวตารเคลน', 'colour avatar'), sleeve: T('ปลอกการ์ด', 'card sleeve'), frame: T('วง Cost / CP', 'cost ring') };
  Object.entries(groups).forEach(([type, label]) => {
    const rr = rail(label); const g = el('div', 'grid g-3');
    ZF.skins.filter(s => s.type === type).forEach(s => {
      const owned = p.unlocked.includes(s.id) || s.price === 0;
      const on = p.equipped[type] === s.id;
      const card = el('div', 'panel hi'); card.dataset.on = on ? '1' : '0'; card.style.borderColor = on ? 'var(--lime)' : 'var(--hair)';
      const prev = el('div', 'skin-prev' + (s.img && s.type === 'avatar' ? ' ico' : ''));
      prev.style.cssText = s.img ? `background-image:url('${s.img}')` : `background:repeating-linear-gradient(45deg,${s.c1}33 0 12px,${(s.c2 || s.c1)}22 12px 24px)`;
      card.innerHTML = `<h3 style="font-size:14px">${esc(L({ en: s.en, th: s.th }))}<small>${s.id} · ${nf(s.price)} Coin</small></h3>`;
      card.appendChild(prev);
      const row = el('div', 'actions'); row.style.marginTop = '10px';
      if (owned) row.appendChild(btnX(on ? T('✓ ใส่อยู่', '✓ equipped') : T('ใส่', 'equip'), () => { p.equipped[type] = s.id; save();
        toast(T('ติดตั้ง ', 'equipped ') + s.en); render(); }, on ? '' : 'primary'));
      else row.appendChild(btnX(T('ซื้อ · ', 'Buy · ') + nf(s.price) + ' Coin', () => { if (p.coins < s.price) return toast(T('Coin ไม่พอ', 'not enough Coin'), true);
        p.coins -= s.price; p.unlocked.push(s.id); p.equipped[type] = s.id; save(); toast(T('ซื้อและติดตั้งแล้ว', 'purchased & equipped')); render(); }, 'primary'));
      card.appendChild(row); g.appendChild(card);
    });
    rr.appendChild(g); m.appendChild(rr);
  });
  const pv = el('div', 'panel');
  pv.innerHTML = `<h3>${T('ตัวอย่างการ์ดพร้อมธีม', 'preview with your theme')}<small>game/img/*.jpg · cropped art ใน game/assets/art</small></h3>`;
  const w = el('div'); w.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;align-items:flex-end';
  ['sb01001', 'sd04009', 'sd01007'].forEach(id => w.appendChild(cardEl(CARD(id), { click: false, own: null })));
  pv.appendChild(w); m.appendChild(pv);
}

/* ── VIEW · PROFILE ─────────────────────────────────────────── */
function vProfile(m) {
  const p = P(), tier = tierOf(p.rp), t = tally();
  const owned = CARDS.filter(c => (p.vault[c.id] || 0) > 0);
  const r = rail((T('โปรไฟล์ · ', 'Profile · ')) + p.name, ZF.series);
  m.appendChild(r);
  const av = ZF.skins.find(s => s.id === p.equipped.avatar) || ZF.skins[4];
  const head = el('div', 'panel hi');
  head.innerHTML = `<div class="prof-head"><img class="prof-av" src="${av.img}" alt="">
      <div><h2>${esc(p.name)}</h2>
        <span class="tag">${T('สมัครเมื่อ', 'joined')} ${new Date(p.created || Date.now()).toLocaleDateString(LANG === 'th' ? 'th-TH' : 'en-GB')}</span>
        <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap"><span class="badge open">${tier.id}</span>
          <span class="badge soon" style="color:var(--cyan)">${p.decks.length} ${T('เด็ค', 'decks')}</span>
          ${Object.entries(p.equipped || {}).map(([k, v]) => `<span class="badge done">${k}·${v}</span>`).join('')}</div>
        <p class="muted">${esc(p.bio || T('ยังไม่ใส่ข้อความแนะนำตัว', 'no bio yet'))}</p></div>
      <div class="stat-grid" style="flex:1;min-width:270px">${statTile(nf(p.coins), 'COIN')}${statTile(nf(p.rp), 'RP', 'cy')}
        ${statTile(`${t.w}-${t.l}`, T('engine', 'engine'), 'vi')}${statTile(`${p.wins}-${p.losses}`, T('lobby record', 'lobby record'), 'go')}
        ${statTile(owned.length + '/' + CARDS.length, T('สะสม', 'vault'), 'ru')}${statTile(nf(p.packs), T('ซองที่เปิด', 'packs'))}</div></div>`;
  const acts = el('div', 'actions'); acts.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px';
  acts.appendChild(btnX(T('แก้ bio'), () => { const v = prompt(T('ข้อความแนะนำตัว', 'bio'), p.bio || ''); if (v !== null) { p.bio = v.slice(0, 140); save(); render(); } }, 'ghost'));
  acts.appendChild(btnX(T('เปิดหน้าแรงก์', 'go to ladder'), () => go('ranked'), 'ghost'));
  acts.appendChild(btnX(T('ออกจากระบบ', 'sign out'), () => { logout(); render(); toast(T('ออกแล้ว', 'signed out')); }, 'danger'));
  head.appendChild(acts); r.appendChild(head);

  const comp = el('div', 'panel'); comp.style.marginTop = '16px';
  comp.innerHTML = `<h3>${T('ความครบตามสีและตามชุด', 'completion by colour & set')}</h3>`;
  const g = el('div', 'stat-grid');
  ZF.factions.slice(0, 6).forEach(f => {
    const all = CARDS.filter(c => c.color === f.id), have = all.filter(c => (p.vault[c.id] || 0) > 0);
    g.innerHTML += `<div class="stat"><b style="color:${ZF.tone(f.id)}">${have.length}/${all.length}</b><span>${f.id}</span>
      <div class="bar" style="margin-top:8px"><i style="width:${all.length ? have.length / all.length * 100 : 0}%"></i></div></div>`;
  });
  comp.appendChild(g);
  const g2 = el('div', 'stat-grid'); g2.style.marginTop = '12px';
  SETS.forEach(s => { const all = CARDS.filter(c => c.file.startsWith(s)), have = all.filter(c => (p.vault[c.id] || 0) > 0);
    g2.innerHTML += `<div class="stat cy"><b>${have.length}/${all.length}</b><span>${ZF.sets[s]}</span><div class="bar cy" style="margin-top:8px"><i style="width:${have.length / all.length * 100}%"></i></div></div>`; });
  comp.appendChild(g2); m.appendChild(comp);

  const ex = rail(T('บัญชี & สำรองข้อมูล', 'account & backup'), T('ทุกอย่างอยู่ใน localStorage เครื่องคุณ', 'everything lives in this browser'));
  const ep = el('div', 'panel');
  const ta = el('textarea'); ta.rows = 8; ta.readOnly = true;
  ta.value = JSON.stringify({ name: p.name, coins: p.coins, rp: p.rp, decks: p.decks.map(d => ({ name: d.name, color: d.color, main: d.main })) }, null, 1);
  ta.style.cssText = 'font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0;text-align:left;white-space:pre';
  ep.appendChild(ta);
  const row = el('div', 'actions'); row.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap';
  row.appendChild(btnX(T('คัดลอก json', 'copy json'), async () => { try { await navigator.clipboard.writeText(ta.value); toast('copied'); } catch (e) { toast('clipboard blocked', true); } }));
  row.appendChild(btnX(T('นำเข้า json', 'import json'), () => { const v = prompt(T('วางสำรอง json', 'paste backup json')); if (!v) return;
    try { const o = JSON.parse(v); if (Array.isArray(o.decks)) p.decks = o.decks.map(d => ({ ...d, id: 'D' + Math.random().toString(36).slice(2, 7), official: false }));
      if (typeof o.coins === 'number') p.coins = o.coins; if (typeof o.rp === 'number') p.rp = o.rp;
      p.activeDeck = p.decks[0]?.id; save(); render(); toast(T('นำเข้าแล้ว', 'imported')); } catch (e) { toast('bad json', true); } }, 'ghost'));
  row.appendChild(btnX(T('รีเซ็ตบัญชี', 'reset account'), () => { if (!confirm(T('ล้างคลัง/เด็ค/แรงก์ของบัญชีนี้ในเครื่อง?', 'wipe this account locally?'))) return;
    const np = newProf(p.name); np.pw = p.pw; np.bio = p.bio; DB.users[p.name.toLowerCase()] = np; save(); render(); toast('reset'); }, 'danger'));
  ep.appendChild(row); ex.appendChild(ep); m.appendChild(ex);
}

/* ── VIEW · BAN LIST ────────────────────────────────────────── */
function vBanlist(m) {
  const r = rail(T('ต้องห้าม / จำกัด · แรงก์และอีเวนต์', 'Ban & restriction list · ranked/events'), 'deckcheck + event rules');
  m.appendChild(r);
  const g = el('div', 'grid g-cards');
  ZF.ban.forEach(b => { const c = CARD(b.id); if (c) { const n = cardEl(c, { own: P().vault[b.id] });
    const t = el('div', 'tag'); t.style.cssText = 'text-align:center;color:' + (b.lim === 0 ? 'var(--rust)' : 'var(--gold)');
    t.textContent = b.lim === 0 ? T('ห้ามใช้', 'BANNED') : T('สูงสุด ' + b.lim + ' ใบ', 'max ' + b.lim);
    const w = el('div'); w.appendChild(n); w.appendChild(t); g.appendChild(w); } });
  r.appendChild(g);
  const tb = el('div', 'panel'); tb.style.marginTop = '16px';
  tb.innerHTML = `<table class="tbl"><thead><tr><th>Card</th><th>${T('สถานะ', 'status')}</th><th>${T('เหตุผล', 'reason')}</th></tr></thead><tbody>${
    ZF.ban.map(b => { const c = CARD(b.id); return `<tr><td><b>${esc(c.file)}</b> ${esc(c.name)}</td>
      <td class="num" style="color:${b.lim === 0 ? 'var(--rust)' : 'var(--gold)'}">${b.lim === 0 ? 'BANNED' : 'LIMIT ' + b.lim}</td>
      <td class="muted">${L(b.note)}</td></tr>`; }).join('')}</tbody></table>
    <p class="muted" style="margin-top:14px">${T('โควตาที่บังคับตลอด: เด็ค 40–60 · ซ้ำ≤3 · สีหลัก≥50% · คู่สี 1 สี · [Protection]≤6 · ไม่มี Extra Zone / Arcanum แล้ว',
      'always enforced: 40–60 cards, ≤3 copies, ≥50% primary colour, one secondary, [Protection] ≤6 · Extra Zone and Arcanum are gone')}</p>`;
  r.appendChild(tb);
}

/* ── VIEW · ABOUT ───────────────────────────────────────────── */
function vAbout(m) {
  const r = rail(T('เกี่ยวกับโปรเจกต์', 'About this build'), esc(ZF.series));
  m.appendChild(r);
  const p = el('div', 'panel hi');
  p.innerHTML = `<h2>${T('ZONEFALL · RIFT LOBBY', 'ZONEFALL · RIFT LOBBY')}</h2>
    <p class="muted">${T('ห้องโถงเว็บสำหรับเกมการ์ด Zonefall (rulebook Dev V.24 · build v${}) — คลังการ์ดจริง 52 ใบตามสแกน SB01/SD01/SD04, ระบบซอง, แผงเด็คพร้อม deckcheck, อีเวนต์และแรงก์ — และทุกเกมที่เล่นจริงรันบน engine เดิมของโปรเจกต์ในโฟลเดอร์ game/',
      'A lobby for the Zonefall card game (rulebook Dev V.24) — real 52-card vault from the SB01/SD01/SD04 scans, pack opening, a deck board with the project deckcheck, events and ladder — and every live match runs on the shipped engine under game/').replace('${}', 'v1.4')}</p>
    <div class="kv"><span>${T('การ์ดในฐานข้อมูล', 'cards in the db')}</span><b>${CARDS.length} · ${SETS.join(' / ')}</b></div>
    <div class="kv"><span>${T('ชนิด', 'types')}</span><b>unit ${CARDS.filter(c => c.type === 'unit').length} · command ${CARDS.filter(c => c.type === 'command').length} · terrain ${CARDS.filter(c => c.type === 'terrain').length}</b></div>
    <div class="kv"><span>${T('สี', 'colours')}</span><b>${ZF.factions.slice(0, 6).map(f => `${f.id} ${CARDS.filter(c => c.color === f.id).length}`).join(' · ')}</b></div>
    <div class="kv"><span>${T('กติกาหลัก', 'core rules')}</span><b>${R.corePointsToWin} Core Point · Flare ${R.flareStart}→${R.flareMax} · ${R.rows}×${R.cols}</b></div>
    <div class="kv"><span>${T('Arcanum', 'Arcanum')}</span><b>${R.arcanum ? 'ON' : 'OFF (ตามคำสั่ง)'}</b></div>
    <div class="kv"><span>${T('Backend', 'backend')}</span><b>${T('ไม่มี · localStorage ทั้งหมด (เดโม)', 'none · all localStorage (demo)')}</b></div>`;
  r.appendChild(p);
  const ru = rail(T('กติกาฉบับย่อ', 'rules primer'), T('คัดลอกจาก rulebook V.24 ใน README ของโปรเจกต์', 'mirrored from the project README'));
  const g = el('div', 'g-2');
  ZF.rules.forEach(x => { const c = el('div', 'panel');
    c.innerHTML = `<h3 style="color:var(--lime)">${L(x.h)}</h3><p class="muted" style="margin-top:8px">${L(x.b)}</p>`; g.appendChild(c); });
  ru.appendChild(g); m.appendChild(ru);
  const kw = rail(T('keyword ใน engine', 'keywords the engine resolves'));
  const kt = el('div', 'kwgrid');
  Object.entries(ZF.keywords).forEach(([k, v]) => { const b = el('div', 'chip big'); b.innerHTML = `<b>[${esc(k)}]</b><span>${esc(v)}</span>`; kt.appendChild(b); });
  kw.appendChild(kt); m.appendChild(kw);
  const arch = el('div', 'panel');
  arch.innerHTML = `<h3>${T(' lobby ต่อกับ engine ยังไง', ' how the lobby hooks into the engine')}<small>${T('ไม่ได้ fork กติกา — ทุกเกมรันบน engine ที่ปล่อยจริง', 'no rules fork — every match runs on the shipped engine')}</small></h3>
    <ol class="flow">
      <li>${T('lobby โหลด game/js/data.js เป็นแหล่งข้อมูลเดียวของกติกา + การ์ด (RULES · COLORS · CARDS · DECKS)', 'the lobby loads game/js/data.js as the single source of truth (RULES · COLORS · CARDS · DECKS)')}</li>
      <li>${T('เด็คที่สร้าง/นำเข้าใน lobby ถูกเขียนลง localStorage key zonefall.lobbydecks.v1 ในรูปแบบเดียวกับ DECKS ของ engine', 'decks built or imported here are written to the localStorage key zonefall.lobbydecks.v1 in the engine’s own DECKS shape')}</li>
      <li>${T('game/js/lobby-bridge.js รันก่อน ui.js เพื่อ inject เด็คเข้า dropdown แล้วอ่าน URL param (own / foe / first / field / auto) เพื่อเริ่มเกมแทนเรา', 'game/js/lobby-bridge.js runs before ui.js, injects those decks into the picker and reads the URL params (own / foe / first / field / auto) to start the match')}</li>
      <li>${T('lobby โพลล์ frame (same-origin) เพื่อดึง log + Core Point/Flare จริง และเฝ้า key zf_tally ที่ engine เขียน แล้วแปลงเป็น Coin · RP · ประวัติการแข่งขัน', 'the lobby polls the same-origin frame for the live log and real Core Point/Flare, watches the zf_tally key the engine writes, and turns it into Coin · RP · match history')}</li>
    </ol>
    <p class="muted">${T('ไฟล์: index.html · css/lobby.css · data.js (metadata ฝั่ง lobby) · app.js (views) · battle.js (stage host) · sw.js · game/ (engine + สแกน + asset จริง — ไม่ได้แก้กติกา)', 'files: index.html · css/lobby.css · data.js (lobby-side metadata) · app.js (views) · battle.js (stage host) · sw.js · game/ (the real engine, scans and assets — rules untouched)')}</p>`;
  m.appendChild(arch);
  const cr = el('div', 'panel');
  cr.innerHTML = `<h3>${T('ที่มา asset & หมายเหตุด้านสิทธิ์', 'asset provenance & licensing notes')}</h3>
    <p class="muted">${T('สแกนการ์ด 52 ใบ, art ที่ crop, sprite UI, ฉากสนาม field_map01-03, ไอคอน PWA และฟอนต์ subset มาจากโฟลเดอร์งานของเจ้าของเกม Zonefall (rulebook Dev V.24 + InGame Font & Icon) ตามที่ระบุใน README — ฐานข้อมูลการ์ดใน js/data.js OCR มาคำต่อคำจากสแกน',
      'the 52 card scans, cropped art, UI sprites, field_map01-03 backdrops, PWA icons and subset fonts come from the Zonefall owner’s project folder (Dev V.24 rulebook + InGame Font & Icon) as documented in the README; js/data.js is a word-for-word OCR of the scans')}</p>
    <div class="kv"><span>FC Twist Bold</span><b>${T('ไฟล์ระบุ Non-commercial → ต้องซื้อสิทธิ์ก่อนขายจริง', 'file is marked Non-commercial → license before any commercial release')}</b></div>
    <div class="kv"><span>Zonefall IP</span><b>${T('เป็นของผู้พัฒนาเกม Zonefall (ไม่ใช่ Cardfight!! Vanguard)', 'belongs to the Zonefall developers (not Cardfight!! Vanguard)')}</b></div>`;
  m.appendChild(cr);
  const gi = rail(T('สิ่งที่ยังต้องตัดสินใจ', 'decisions still open'));
  const gg = el('div', 'g-2');
  ZF.openIssues.forEach(x => { const c = el('div', 'panel'); c.innerHTML = `<h3 style="color:var(--gold)">${L(x.t)}</h3><p class="muted" style="margin-top:8px">${L(x.d)}</p>`; gg.appendChild(c); });
  gi.appendChild(gg); m.appendChild(gi);
}

/* ── chrome / dialogs / boot ─────────────────────────────────── */
const TAB_LABEL = { lobby: 'Lobby', events: 'Events', shop: 'Shop', collection: 'Vault', decks: 'Decks',
  battle: 'Match', watch: 'Watch', ranked: 'Ladder', customization: 'Style', profile: 'Profile', banlist: 'Restrictions', about: 'About' };
function syncAuth() {
  $('#coin-purse').hidden = !S.prof; if (S.prof) $('#coin-value').textContent = nf(S.prof.coins);
  $('#account-button').textContent = S.prof ? S.prof.name : T('เข้าสู่ระบบ', 'sign in');
  $('#signed-in-name').textContent = S.prof ? S.prof.name + ' · PLAYER' : 'PLAYER';
  if (S.prof) $('#profile-mini').innerHTML = statTile(nf(S.prof.coins), 'COIN') + statTile(nf(S.prof.rp), 'RP') +
    statTile(S.prof.wins + '-' + S.prof.losses, 'W-L') + statTile(tierOf(S.prof.rp).id, 'ZONE');
}
function wireChrome() {
  $$('.tabs button').forEach(b => { b.dataset.label = TAB_LABEL[b.dataset.tab] || b.dataset.tab;
    b.addEventListener('click', () => go(b.dataset.tab)); });
  $$('.header-shortcuts button[data-tab]').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  document.addEventListener('click', e => { const n = e.target.closest('[data-nav]'); if (n) go(n.dataset.nav); });
  $('#account-button').addEventListener('click', () => S.prof ? $('#profile-dialog').showModal() : $('#account-dialog').showModal());
  $('#logout-account').addEventListener('click', () => { logout(); $('#profile-dialog').close(); render(); toast(T('ออกจากระบบแล้ว', 'signed out')); });
  $$('#th').forEach(b => b.addEventListener('click', () => setLang('th')));
  $('#en').addEventListener('click', () => setLang('en'));
  $('#redeem-open')?.addEventListener('click', () => $('#redeem-dialog').showModal());
  $('#catalog-open')?.addEventListener('click', () => {
    $('#pack-catalog-title').textContent = T('คาตาล็อกการ์ดจริงทั้ง 52 ใบ', 'full card catalogue — 52 real cards');
    $('#pack-catalog-note').textContent = T('ภาพสแกนจาก game/img · ข้อความความสามารถคำต่อคำจากสแกน · ลากดูตามสี/ชนิด',
      'scans live in game/img · ability text is word-for-word from the OCR · filter by colour and type');
    const tb = $('#pack-catalog .pack-catalog-toolbar'), ls = $('#pack-catalog .pack-catalog-list');
    tb.innerHTML = ''; ls.innerHTML = '';
    const paint = f => { ls.innerHTML = ''; CARDS.filter(c => f === 'all' || c.color === f || c.type === f).forEach(c => ls.appendChild(cardEl(c, { own: S.prof ? P().vault[c.id] : null }))); };
    ['all', ...ZF.factions.map(f => f.id), 'unit', 'command', 'terrain'].forEach(k => {
      const b = el('button', 'chip' + (k === 'all' ? ' on' : ''), k === 'all' ? T('ทั้งหมด', 'all') : k);
      b.addEventListener('click', () => { $$('.chip', tb).forEach(x => x.classList.remove('on')); b.classList.add('on'); paint(k); }); tb.appendChild(b); });
    paint('all'); $('#pack-catalog').showModal();
  });
  $('#install-app').addEventListener('click', () => {
    const d = $('#install-help');
    d.querySelector('h2').textContent = T('ติดตั้ง Zonefall เป็นแอป', 'Install Zonefall as an app');
    d.querySelector('p').textContent = T('เว็บนี้เป็น PWA:เปิดใน Chrome/Edge แล้วเลือก “ติดตั้งแอป” · ใช้งานต่อได้แม้ Offline (engine + สแกนการ์ดถูก cache ไว้)',
      'this is a PWA: open in Chrome/Edge and choose “Install app” · it keeps working offline (engine + scans are cached)');
    const li = LANG === 'th'
      ? ['เปิดห้องโถงนี้ใน Chrome หรือ Edge (มือถือ/เดสก์ท็อป)', 'เมนู ⋮ → Install app / Add to Home screen', 'แอปเปิดเข้า Lobby ตรง พร้อมคลังและบัญชีเดิม (ข้อมูลอยู่ในเครื่อง)']
      : ['Open this lobby in Chrome or Edge', 'Menu ⋮ → Install app / Add to Home screen', 'It launches into the Lobby with the same vault and account (local data only)'];
    d.querySelector('ol').innerHTML = li.map(x => `<li>${x}</li>`).join('');
    d.showModal();
  });
  $('#about-open')?.addEventListener('click', () => go('about'));
  document.addEventListener('click', e => { const c = e.target.closest('[data-close-dialog],#close-detail,#install-help button,.dialog-head .close');
    c && c.closest('dialog')?.close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ZFStage.has()) ZFStage.close(); });
}
function setLang(l) {
  LANG = l; localStorage.setItem('zf.lang', l); document.documentElement.lang = l;
  $$('#th,#en').forEach(b => b.classList.toggle('on', b.id === l));
  $$('#card-detail .language button').forEach(b => b.classList.toggle('on', b.dataset.language === l));
  document.title = l === 'th' ? 'Zonefall · Rift Lobby' : 'Zonefall · Rift Lobby';
  render();
}
function redeemCode(raw) {
  const st = $('#redeem-status'); if (!S.prof) { st.textContent = T('เข้าสู่ระบบก่อนใช้โค้ด', 'sign in first'); return false; }
  const code = (raw || '').trim().toUpperCase(), r = ZF.codes[code], used = (DB.used || {})[S.name.toLowerCase()] || {};
  if (!r) { st.className = 'room-error'; st.textContent = T('โค้ดไม่ถูกต้อง · ตรวจสอบรหัสอีกครั้ง', 'unknown code'); return false; }
  if ((P().redeemed || []).includes(code) || used[code]) { st.className = 'room-error'; st.textContent = T('โค้ดนี้ถูกใช้ในบัญชีนี้แล้ว', 'already redeemed on this account'); return false; }
  grant(r); (P().redeemed ||= []).push(code); (DB.used[S.name.toLowerCase()] ||= {})[code] = Date.now(); dbSave(); save();
  st.className = ''; st.textContent = T('รับรางวัลแล้ว · ', 'rewarded · ') +
    [r.coins ? nf(r.coins) + ' Coin' : '', r.packs ? Object.values(r.packs).reduce((a, b) => a + b, 0) + ' ' + T('ซอง', 'packs') : '',
      r.cards ? r.cards.length + ' ' + T('การ์ด', 'cards') : ''].filter(Boolean).join(' + ');
  toast(T('โค้ดสำเร็จ', 'code accepted')); render(); return true;
}
function wireDialogs() {
  $('#account-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = e.target.username.value.trim(), pw = e.target.password.value, err = $('#account-error'); err.textContent = '';
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(name)) { err.textContent = T('ชื่อบัญชี 3–24 ตัว · A–Z 0–9 . _ -', 'username 3–24 chars · A–Z 0–9 . _ -'); return; }
    if (pw.length < 8) { err.textContent = T('รหัสผ่านอย่างน้อย 8 ตัว', 'password needs 8+ characters'); return; }
    const want = e.submitter?.value || 'login';
    const msg = want === 'register' ? register(name, pw) : login(name, pw);
    err.textContent = msg || '';
    if (!msg) { $('#account-dialog').close();
      if (want === 'register') { toast(T('สร้างบัญชีแล้ว · เลือกเด็คเริ่มต้น', 'account created · pick a starting deck')); go('decks'); }
      else { toast(T('ยินดีต้อนรับกลับ ', 'welcome back ') + name); render(); } }
  });
  $('#redeem-form').addEventListener('submit', e => { e.preventDefault(); redeemCode($('#redeem-code').value); $('#redeem-code').value = ''; });
  $('#room-form').addEventListener('submit', e => { e.preventDefault(); createRoom(); });
  $('#create-room').addEventListener('click', e => { e.preventDefault(); createRoom(); });
  $('#join-room').addEventListener('click', () => {
    const code = ($('#room-code').value || '').trim().toUpperCase();
    const err = $('#room-error'); err.textContent = '';
    if (!code) return err.textContent = T('กรอกรหัสห้อง 6 ตัว', 'enter the 6-char room code');
    const d = legalDecks()[0];
    if (!d) return err.textContent = T('ต้องมีเด็คที่ผ่าน deckcheck ก่อนเข้าห้อง', 'you need a deckcheck-clean deck');
    const rm = (DB.rooms || []).find(x => x.code === code);
    if (!rm) return err.textContent = T('ไม่พบห้องนี้ในเครื่อง (เดโมยังไม่มีเซิร์ฟเวอร์ห้องนั่ง realtime)', 'room not found on this device (no realtime server in this demo yet)');
    $('#friend-room').close();
    ZFStage.open({ own: rm.ownDeck || d.id, foe: rm.foe || pick(officialKeys()), first: rm.first || 'p0', event: rm.event });
  });
  $('#deck-import-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#import-code-input').value, err = $('#import-error');
    const d = importCode(v);
    if (d.err) { err.style.display = ''; err.textContent = d.err; return; }
    err.style.display = 'none';
    d.id = 'D' + Date.now().toString(36); P().decks.push(d); P().activeDeck = d.id; editingDeck = d.id; save();
    $('#deck-import-dialog').close(); toast(T('นำเข้าแล้ว · ตรวจ deckcheck ให้ดูที่แผงเด็ค', 'imported · see deckcheck in the board')); go('decks');
  });
  $('#copy-share-code').addEventListener('click', async () => {
    const t = $('#share-code-display').textContent;
    try { await navigator.clipboard.writeText(t); toast(T('คัดลอกรหัสแล้ว', 'code copied')); }
    catch (e) { const x = el('textarea'); x.value = t; document.body.appendChild(x); x.select(); document.execCommand('copy'); x.remove(); toast('copied'); }
  });
}
function createRoom() {
  if (!S.prof) return ($('#room-error').textContent = T('เข้าสู่ระบบก่อน', 'sign in first'));
  const d = legalDecks()[0];
  if (!d) return ($('#room-error').textContent = T('ต้องมีเด็คที่ผ่าน deckcheck', 'needs a deckcheck-clean deck'));
  const code = randCode(6), foe = pick(officialKeys());
  (DB.rooms ||= []).push({ code, host: $('#player-name').value || S.name, ownDeck: d.id, foe, first: 'p1', at: Date.now(), event: null });
  DB.rooms = DB.rooms.slice(-24); dbSave();
  (P().watchRooms ||= []).unshift({ a: ($('#player-name').value || S.name), b: 'AI · ' + DECKS[foe].name, clan: colorStat(d).primary,
    mode: 'Room ' + code, viewers: 0, live: true, bot: foe, ownDeck: d.id, first: 'p1' });
  P().watchRooms = P().watchRooms.slice(0, 8);
  $('#room-error').textContent = ''; save();
  toast(T('สร้างห้อง ', 'room created ') + code + T(' · เดโมยังรับเพื่อนเฉพาะบนเครื่องนี้', ' · demo matchmaking is local-only for now'));
  $('#friend-room').close();
  ZFStage.open({ own: d.id, foe, first: 'p1' });
}
async function boot() {
  const bar = $('#boot-bar-fill'), log = $('#boot-log');
  const steps = T(['เชื่อมรอยแยก · อ่าน rulebook V.24…', 'โหลดการ์ดจริง 52 ใบ + สแกน…', 'ตรวจบัญชีในเครื่อง…', 'พร้อม · Zonefall Rift Lobby'],
    ['linking rift · loading rulebook V.24…', 'loading 52 real cards + scans…', 'checking local account…', 'ready · Zonefall Rift Lobby']);
  for (let i = 0; i < steps.length; i++) { log.textContent = steps[i]; bar.style.width = ((i + 1) / steps.length * 100) + '%'; await wait(170); }
  dbLoad();
  if (!restore()) { /* first visit: keep the DB warm */ dbSave(); }
  syncLobbyDecks();
  wireChrome(); wireDialogs(); setLang(LANG);
  $('#boot').classList.add('done');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const menu = new URLSearchParams(location.search).get('menu') || 'lobby';
  go(menu, false);
  window.addEventListener('popstate', () => go(new URLSearchParams(location.search).get('menu') || 'lobby', false));
  setInterval(() => { if (S.prof) $('#coin-value').textContent = nf(P().coins); }, 4000);
}
document.addEventListener('DOMContentLoaded', boot);
