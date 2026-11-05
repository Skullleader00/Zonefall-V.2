/* ═══════════════════════════════════════════════════════════════
   ZONEFALL · RIFT LOBBY — stage host
   ไม่ reimplement กติกา: เปิด engine จริง (game/) ในกรอบ แล้ว sync ผล/log
   กลับเข้ามาที่ระบบ Coin · RP · สถิติของ lobby
   ═══════════════════════════════════════════════════════════════ */
const ZFStage = (() => {
  let cur = null, timer = null, snap = null, games = 0, wins = 0, losses = 0, lastLog = '';

  const deckKey = id => { const d = (P()?.decks || []).find(x => x.id === id);
    return d && !d.official ? 'LB:' + d.id : (d && d.key) || id; };

  function urlFor(o) {
    const q = new URLSearchParams();
    q.set('own', deckKey(o.own)); q.set('foe', deckKey(o.foe)); q.set('first', o.first || 'p0');
    const eq = (P() && P().equipped) || {};
    q.set('field', eq.field === 'FIELD-GREEN' ? 'green' : eq.field === 'FIELD-RED' ? 'red' : 'blue');
    if (o.auto !== false) q.set('auto', '1');
    return ZF.game + '?' + q.toString();
  }

  function open(o = {}) {
    if (!S.prof) return $('#account-dialog').showModal();
    const legal = legalDecks();
    if (!legal.length) { toast(T('เข้าสนามไม่ได้ · ยังไม่มีเด็คที่ผ่าน deckcheck อย่างน้อย 1 เด็ค → เปิดแผงเด็คให้', 'cannot enter match · need at least one deckcheck-clean deck → opening the deck board'), true); return go('decks'); }
    const own = legal.find(d => d.id === o.own) || legal[0];
    let foe = o.foe;
    if (!foe || (foe !== own.id && !officialKeys().includes(foe) && !legal.some(d => d.id === foe))) foe = pick(officialKeys());
    cur = { own: own.id, foe, first: o.first || 'p0', event: o.event || null, bo: o.bo || 1 };
    games = wins = losses = 0; lastLog = '';
    syncLobbyDecks();
    const m = $('#content'); m.innerHTML = '';
    const s = el('section', 'stage-wrap');
    s.innerHTML = `<div class="stage-hd">
        <button id="stage-out">◀ ${T('ออกจากสนาม', 'LEAVE MATCH')}</button>
        <div class="stage-hd-mid"><b id="stageMode"></b><i id="stageRound"></i></div>
        <span class="frame-hint">${T('engine จริง · 5 แถว×3 ช่อง · 7 Core Point · ลาก-วางหรือแตะ-แล้ว-แตะ', 'the shipped engine · 5×3 board · 7 Core Point · drag-drop or tap-tap')}</span>
        <div class="stage-hd-rt" id="stageScore">0 — 0</div>
        <button id="stage-rail-toggle">LIVE ▴</button>
      </div>
      <div class="stage-main">
        <div class="frame-box"><iframe id="frame" title="Zonefall engine" src="${urlFor(cur)}"></iframe></div>
        <aside class="stage-rail">
          <div class="rail-card"><h6>${T('คู่ต่อสู้ · เด็ค', 'matchup · decks')}</h6><div id="railMatch"></div><div id="railDeck" class="rail-deck"></div></div>
          <div class="rail-card av-card"><img id="railAv" alt="" src="game/assets/faction/verdant.png"><div><h6>${T('อวตารที่ใส่อยู่', 'equipped avatar')}</h6><span id="railAvName">—</span></div></div>
          <div class="rail-card"><h6>${T('สกอร์สดจาก engine', 'live from the engine')}</h6><div id="railLive"></div></div>
          <div class="rail-card grow"><h6>${T('log จาก engine', 'live engine log')}</h6><ol id="railLog" class="rail-log"></ol></div>
          <div class="rail-card rail-actions">
            <button id="btnRe" class="primary">${T('↻ เริ่มเกมใหม่', '↻ restart game')}</button>
            <button id="btnFlip" class="ghost">${T('สลับฝั่งเริ่มก่อน', 'flip who starts first')}</button>
            <button id="btnBack" class="ghost">${T('กลับ lobby', 'back to lobby')}</button>
          </div>
          <div class="rail-card pay">
            <div class="kv"><span>${T('ชนะ / แพ้', 'win · loss')}</span><b>${cur.event ? T('ตามตารางอีเวนต์', 'event table') : '800 · 200'}</b></div>
            <div class="kv"><span>${T('สถิติ engine', 'engine tally')}</span><b id="railTally">—</b></div>
          </div>
        </aside>
      </div>`;
    m.appendChild(s);
    $('#stageMode').textContent = cur.event ? T('อีเวนต์ · ', 'EVENT · ') + cur.event : T('TRAINING RIFT · ENGINE จริง', 'TRAINING RIFT · LIVE ENGINE');
    $('#stageRound').textContent = T('เกม ', 'GAME ') + 1 + (cur.bo === 3 ? ' /Bo3' : '');
    $('#stage-out').addEventListener('click', close);
    const autoCollapse = () => { if (innerWidth <= 820) { document.body.classList.add('rail-hidden'); tg0(); } };
    const tg0 = () => { const t = $('#stage-rail-toggle'); if (t) t.textContent = document.body.classList.contains('rail-hidden') ? 'LIVE ▴' : 'LIVE ▾'; };
    autoCollapse();
    window.removeEventListener('resize', autoCollapse); window.addEventListener('resize', autoCollapse);
    const tg = $('#stage-rail-toggle');
    tg.addEventListener('click', () => { const h = document.body.classList.toggle('rail-hidden');
      tg.textContent = h ? 'LIVE ▴' : 'LIVE ▾'; if (!h) setTimeout(pump, 80); });
    $('#btnBack').addEventListener('click', close);
    $('#btnRe').addEventListener('click', restart);
    $('#btnFlip').addEventListener('click', () => { cur.first = cur.first === 'p0' ? 'p1' : 'p0';
      toast(T('ฝั่งเริ่มก่อน: ', 'first: ') + (cur.first === 'p0' ? T('คุณ', 'you') : 'AI')); restart(); });
    railInfo();
    const eq = (P() && P().equipped) || {}, av = ZF.skins.find(s => s.id === eq.avatar);
    if (av) { const im = $('#railAv'); if (im) im.src = av.img; const nm = $('#railAvName'); if (nm) nm.textContent = L({ en: av.en, th: av.th }); }
    syncAuth();
    snap = tally();
    clearInterval(timer); timer = setInterval(pump, 600);
    document.body.classList.add('in-stage');
  }
  function restart() { games++; $('#frame').src = urlFor(cur); $('#stageRound').textContent = T('เกม ', 'GAME ') + (games + 1) + (cur.bo === 3 ? ' /Bo3' : ''); }

  function railInfo() {
    const p = P(); const mine = p.decks.find(d => d.id === cur.own) || p.decks[0];
    const fk = deckKey(cur.foe), D = DECKS[fk];
    const foeOwn = p.decks.find(x => x.id === cur.foe);
    $('#railMatch').innerHTML = '';
    const row = el('div', 'vsrow');
    row.innerHTML = `<div><b>${esc(mine.name)}</b><span>${T('คุณควบคุม', 'you drive')}</span></div><span class="vsx">VS</span>` +
      `<div><b>${esc((foeOwn && foeOwn.name) || (D && D.name) || cur.foe)}</b><span>${T('ฝั่ง AI', 'AI side')}${D ? ' · ' + esc(D.color) : ''}</span></div>`;
    $('#railMatch').appendChild(row);
    if (D) { const cnt = {}; D.main.forEach(id => { const c = CARD(id); cnt[c.color] = (cnt[c.color] || 0) + 1; });
      const bar = el('div', 'mini-colors'); bar.title = JSON.stringify(cnt);
      bar.innerHTML = Object.entries(cnt).map(([k, v]) => `<i style="flex:${v};background:${ZF.tone(k)}"></i>`).join('');
      $('#railMatch').appendChild(bar); }
    const ck = deckCheck(mine);
    $('#railDeck').innerHTML = `<b>${esc(mine.name)}</b><span>${deckSize(mine)} ${T('ใบในเด็ค', 'cards')} · <i style="color:${ZF.tone(ck.primary)}">${esc(ck.primary)} ${ck.stat.pct}%</i> · [P] ${ck.prot}</span>` +
      `<div class="mini-colors">${Object.entries(ck.stat.c).map(([k, v]) => `<i style="flex:${v};background:${ZF.tone(k)}"></i>`).join('')}</div>` +
      `<span class="muted">${T('เด็คนี้ถูก inject เข้า DECKS ของ engine แล้ว (คีย์ LB:' + mine.id + ')', 'this deck is injected into the engine DECKS map as LB:' + mine.id)}</span>`;
  }

  /* ── poll the shipped engine (same-origin) and mirror it into the lobby ── */
  const read = (doc, id) => { const n = doc && doc.querySelector('#' + id); return n ? (n.textContent || '').trim() : null; };
  function pump() {
    if (!cur) return;
    const f = $('#frame'); if (!f) return;
    const t = tally();
    const rt = $('#railTally'); if (rt) rt.textContent = `${t.w}W · ${t.l}L`;
    let doc = null; try { doc = f.contentDocument; } catch (e) { return; }
    if (!doc) return;
    /* live scoreboard from the engine’s own plate ids */
    const cnt = sel => doc.querySelectorAll(sel).length;
    const sc = { own: read(doc, 'ownPts'), foe: read(doc, 'foePts'), ownF: read(doc, 'ownFlareN'), foeF: read(doc, 'foeFlareN'),
      ownH: read(doc, 'ownHand'), foeH: read(doc, 'foeHand'), ownD: read(doc, 'ownDeckN'), foeD: read(doc, 'foeDeck'),
      ownName: read(doc, 'ownName'), foeName: read(doc, 'foeName'),
      ownU: cnt('.cell.own .tkslot:not(:empty)') + '/' + R.unitLimit, foeU: cnt('.cell.foe .tkslot:not(:empty)') + '/' + R.unitLimit,
      ownT: cnt('.cell.own .terr:not(:empty)') + '/' + R.terrainLimitBase, foeT: cnt('.cell.foe .terr:not(:empty)') + '/' + R.terrainLimitBase,
      ownCore: cnt('.cell.core .tk:not(.foe)'), foeCore: cnt('.cell.core .tk.foe') };

    const hn = doc.querySelector('#hand'); sc.ownH = sc.ownH || (hn ? String(hn.querySelectorAll('.hcard,.cardback,.handcard>*,.hc,img').length || hn.children.length) : null);
    const hd = $('#stageScore'); if (hd) hd.textContent = `${sc.own || 0} — ${sc.foe || 0} CP`;
    const board = $('#railLive');
    if (board) board.innerHTML = `<div class="live-grid">
        <span class="lg-h"></span><b class="lg-h you">${T('คุณ', 'you')}</b><b class="lg-h ai">AI</b>
        <span class="lg-lab">${T('Core Point', 'Core Point')} <i>/${R.corePointsToWin}</i></span><b class="lg-own">${sc.own || 0}</b><b class="lg-foe">${sc.foe || 0}</b>
        <span class="lg-lab">Flare</span><b class="lg-own">${sc.ownF || 0}</b><b class="lg-foe">${sc.foeF || 0}</b>
        <span class="lg-lab">${T('มือ', 'hand')}</span><b class="lg-own">${sc.ownH || 0}</b><b class="lg-foe">${sc.foeH || 0}</b>
        <span class="lg-lab">${T('เด็คเหลือ', 'deck left')}</span><b class="lg-own">${sc.ownD || 0}</b><b class="lg-foe">${sc.foeD || 0}</b>
        <span class="lg-lab">${T('unit บนสนาม', 'units on field')}</span><b class="lg-own">${sc.ownU}</b><b class="lg-foe">${sc.foeU}</b>
        <span class="lg-lab">${T('terrain', 'terrain')}</span><b class="lg-own">${sc.ownT}</b><b class="lg-foe">${sc.foeT}</b>
        <span class="lg-lab">${T('ครอง Core Zone', 'holding Core Zone')}</span><b class="lg-own">${sc.ownCore}</b><b class="lg-foe">${sc.foeCore}</b>
      </div><p class="muted vs-names">${esc(sc.ownName || '—')} <i>vs</i> ${esc(sc.foeName || '—')}</p>`;

    /* engine log mirror */
    const lb = doc.querySelector('#logBody');
    if (lb && lb.innerText) { const txt = lb.innerText.trim();
      if (txt !== lastLog) { lastLog = txt; const out = $('#railLog');
        const lines = txt.split('\n').map(x => x.trim()).filter(Boolean).slice(-40);
        if (out) { out.innerHTML = lines.map(l => `<li>${esc(l)}</li>`).join(''); out.scrollTop = out.scrollHeight; } } }
    /* result detection via the engine’s own tally key */
    const dw = t.w - snap.w, dl = t.l - snap.l;
    if (dw > 0 || dl > 0) { for (let i = 0; i < dw; i++) settle(true); for (let i = 0; i < dl; i++) settle(false); snap = t; }
  }

  function settle(win) {
    const p = P(); games++;
    if (win) { wins++; p.wins++; } else { losses++; p.losses++; }
    const ev = cur.event ? ZF.events.find(e => e.id === cur.event) : null;
    let coins = win ? 800 : 200, rp = win ? 60 : -20;
    if (ev) { coins = win ? 1500 : 200; rp = win ? 120 : -30;
      const st = (p.events[ev.id] ||= { entered: Date.now() });
      (st.results ||= []).push({ win, at: Date.now() });
      if (win && wins >= 2 && ev.prizes) coins += ev.prizes[0].coins / (ev.format.startsWith('BO3') ? 1 : 3);
    }
    const before = tierOf(p.rp).id;
    p.coins += Math.round(coins); p.rp = Math.max(0, p.rp + rp);
    p.winStreak = win ? (p.winStreak || 0) + 1 : 0;
    if (p.winStreak === 3) { p.coins += 2000; flash(T('WIN STREAK ×3 · +2,000 COIN', 'WIN STREAK ×3 · +2,000 COIN')); }
    p.matches.unshift({ at: Date.now(), win, deck: p.decks.find(d => d.id === cur.own)?.name || '—',
      foe: DECKS[deckKey(cur.foe)]?.name || cur.foe, coins: Math.round(coins), rp: (win ? '+' : '−') + Math.abs(rp),
      event: cur.event, turns: null });
    p.matches = p.matches.slice(0, 50);
    save();
    flash((win ? T('ชนะ · ', 'WIN · ') : T('แพ้ · ', 'LOSS · ')) + `+${nf(Math.round(coins))} COIN · ${win ? '+' : '−'}${Math.abs(rp)} RP`);
    const after = tierOf(p.rp).id;
    if (after !== before) setTimeout(() => flash(T('เลื่อนเป็น ' + after, 'reached rank ' + after)), 950);
    const sc = $('#stageScore'); if (sc) sc.textContent = `${wins} — ${losses}`;
    railInfo();
    if (cur.bo === 3) { $('#stageRound').textContent = T('เกม ', 'GAME ') + (wins + losses + 1) + ' /Bo3';
      if (wins === 2 || losses === 2) setTimeout(() => { flash(wins === 2 ? T('ชนะซีรีส์ 2–0/2–1', 'took the series') : T('แพ้ซีรีส์', 'lost the series')); }, 1400); }
  }
  function flash(txt) {
    const f = $('#levelup-fx'); if (!f) return;
    f.hidden = false; f.querySelector('span').textContent = txt;
    clearTimeout(flash._t); flash._t = setTimeout(() => { f.hidden = true; }, 1500);
  }
  function close(skipRender) { clearInterval(timer); timer = null; cur = null;
    document.body.classList.remove('in-stage'); $('#content').innerHTML = ''; if (!skipRender) render(); }
  const leave = () => { if (cur) close(true); };
  return { open, close, leave, has: () => !!cur, urlFor, stats: () => ({ games, wins, losses }) };
})();
const launchMatch = o => ZFStage.open(o);
