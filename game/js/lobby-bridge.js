/* ==========================================================================
   lobby-bridge.js — ต่อ "Rift Lobby" (หน้าเว็บด้านนอก) เข้ากับ engine จริง
   โหลดหลัง js/data.js และก่อน js/ui.js
   หน้าที่ 1 · โหลดเด็คที่สร้างใน lobby (localStorage) ใส่วง DECKS ให้ dropdown เห็น
   หน้าที่ 2 · รับ URL param แล้วเลือกเด็ค/สนาม/ผู้เริ่มก่อน แล้วกดเข้าสนามเอง
   ======================================================================== */
(function () {
  const LS = 'zonefall.lobbydecks.v1';
  const params = new URLSearchParams(location.search);

  window.LobbyBridge = {
    readLobbyDecks() {
      try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; }
    },
    register() {
      const decks = this.readLobbyDecks();
      Object.keys(decks).forEach(id => {
        const d = decks[id];
        if (!d || !Array.isArray(d.main)) return;
        const key = 'LB:' + id;
        DECKS[key] = {
          name: '★ ' + (d.name || 'Lobby deck'),
          color: d.color || 'Colorless',
          main: d.main.slice(),
          extra: (d.extra || []).slice(),
          fromLobby: true,
          code: d.code || null,
        };
      });
      return Object.keys(decks).length;
    },
    /** เปิดหน้า lobby ที่ค้างอยู่ ให้ผู้ใช้กด "เข้าสนาม" เอง หรือ auto=1 เพื่อเริ่มทันที */
    apply() {
      const own = params.get('own'), foe = params.get('foe'), first = params.get('first'), field = params.get('field');
      const q = (sel, val) => { const el = document.querySelector(sel); if (el && val) el.value = val; };
      document.addEventListener('DOMContentLoaded', () => {
        q('#selOwnDeck', own); q('#selFoeDeck', foe); q('#selField', field);
        const f = document.querySelector('#selFirst');
        if (f && first) f.value = first;
        if (params.get('auto') === '1') {
          const btn = document.querySelector('#btnStart');
          if (btn) setTimeout(() => btn.click(), 120);
        }
      });
    },
  };

  const n = LobbyBridge.register();
  LobbyBridge.apply();
  if (window.parent !== window) document.documentElement.classList.add('embedded');
  console.info('[lobby-bridge] registered ' + n + ' deck(s) from lobby' + (params.toString() ? ' · params: ' + params.toString() : ''));
})();
