/* test/unknown-ops.js —ทุกใบต้อง “มีกลไกจริง” ในเครื่อง
   วิธีคิด: สร้างเด็คทดลองต่อชุดการ์ด (SB01 / SD01 / SD04) บังคับ AI ลงครบทุกใบ
   แล้วไล่ log หาบรรทัด "! op ไม่รู้จัก" (engine log เมื่อเจอ op ที่ไม่มี handler)
   usage: node test/unknown-ops.js [games=8]                                  */
const run = require('./harness');

const games = +(process.argv[2] || 8);
const report = run(`
  var groups = {};
  CARDS.forEach(function (c) {
    var set = c.file.split('-')[0];
    (groups[set] = groups[set] || []).push(c.id);
  });
  Object.keys(groups).forEach(function (set) {
    var pool = groups[set], main = [];
    for (var i = 0; main.length < 44; i++) {
      var id = pool[i % pool.length];
      var n = main.filter(function (x) { return x === id; }).length;
      if (n >= 3) continue;
      main.push(id);
    }
    DECKS['tmp_' + set] = { name: 'tmp ' + set, main: main, color: CARD_INDEX[pool[0]].color };
  });

  var sets = Object.keys(groups);
  var hits = {}, cards = {}, turns = 0, games = 0, errors = [];
  sets.forEach(function (set) {
    ['p0', 'p1'].forEach(function (pos) {
      for (var s = 1; s <= ${games}; s++) {
        var d0 = pos === 'p0' ? 'tmp_' + set : 'machina';
        var d1 = pos === 'p0' ? 'sylvan' : 'tmp_' + set;
        var S;
        try { S = Z.init({ seed: s * 977 + set.charCodeAt(4), humanSide: 'p9', p0deck: d0, p1deck: d1 }); }
        catch (e) { errors.push('init ' + set + ' ' + e.message); continue; }
        games++;
        try {
          var g = 0;
          while (!S.winner && g++ < 400) { ZAI.takeTurn(S, S.active); var k = 0; while (S.pending && k++ < 10) Z.respond(S, null); }
        } catch (e) { errors.push(set + ' game: ' + (e.message || e).slice(0, 90)); }
        turns += S.turnNo;
        /* op ที่ยังไม่มี handler จะ log "! op ไม่รู้จัก: name" */
        S.log.forEach(function (L, i) {
          /* engine: "! op ไม่รู้จัก: name" · Zfx-Proxy: '⚠ op "name" ยังไม่ implement บน [...]' */
          var nameOf = null;
          if (L.msg.indexOf('ไม่รู้จัก') > -1) { var parts = L.msg.split(':'); nameOf = (parts[parts.length - 1] || '').trim(); }
          else if (L.msg.indexOf('implement') > -1) { var q = L.msg.split('"'); nameOf = q[1] || null; }
          if (!nameOf) return;
          hits[nameOf] = (hits[nameOf] || 0) + 1;
          var back = '';
          for (var j = i; j > Math.max(0, i - 14); j--) {
            var nm = /[\\[]([^\\]]{4,60})[\\]]/.exec(S.log[j].msg);
            if (nm) { back = nm[1]; break; }
          }
          (cards[back] = cards[back] || {})[nameOf] = 1;
        });
      }
    });
  });
  return { sets: sets, games: games, turns: turns, hits: hits, cards: cards, errors: errors };
`);

const names = Object.keys(report.hits).sort((a, b) => report.hits[b] - report.hits[a]);
console.log(`ชุดการ์ด: ${report.sets.join(', ')} · เกมที่รัน ${report.games} · เทิร์นรวม ${report.turns}`);
if (report.errors.length) { console.log('error ระหว่างรัน:'); report.errors.slice(0, 6).forEach(e => console.log('  · ' + e)); }
if (!names.length) {
  console.log('✅ ไม่พบ op ที่เครื่องไม่รู้จัด — ทุกเอฟเฟกต์ที่ AI เจอมีกลไกทำงานจริง');
  process.exit(0);
}
console.log(`❌ พบ op ที่ยังไม่มี handler ${names.length} แบบ / ${Object.values(report.hits).reduce((a, b) => a + b, 0)} ครั้ง`);
names.forEach(n => console.log(`   ${String(report.hits[n]).padStart(4)}x  ${n}`));
const who = Object.keys(report.cards).slice(0, 24);
who.forEach(c => console.log(`   [${c}] → ${Object.keys(report.cards[c]).join(', ')}`));
process.exit(1);
