/* test/text-vs-ops.js — lint “ข้อความที่พิมพ์บนการ์ด” เทียบกับ ops + กลไกในเครื่อง
   แบ่งระดับ:
     ERROR = ใบที่ข้อความสั่งให้ทำ แต่ ops ว่าง / op ไม่มี handler จริง  → ทำให้ lint fail
     WARN  = เข้าข่ายว่าเงื่อนไขที่พิมพ์ (Cost/สี/เผ่า/วางนอน) อาจยังไม่ได้กรองใน ops → ให้ review
   วิธีรัน: node test/text-vs-ops.js            (exit 1 เมื่อมี ERROR)            */
const fs = require('fs');
const path = require('path');
const run = require('./harness');

/* ---------- 1) ดึงข้อมูลการ์ดออกมาเป็น plain object ---------- */
const cards = run(`
  return CARDS.map(function (c) {
    return {
      file: c.file, id: c.id, name: c.name, type: c.type, color: c.color, tribe: c.tribe || '', cost: c.cost,
      abilities: (c.abilities || []).map(function (a) {
        return { kw: String(a.kw || ''), text: String(a.text || ''), once: a.once === true, req: a.req || null, ops: a.ops || [] };
      }),
    };
  });
`);

/* ---------- 2) op names ที่เครื่อง dispatch ได้จริง ---------- */
const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
const effectsSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'effects.js'), 'utf8');
const inApplyOp = (() => {
  const i = engineSrc.indexOf('switch (op.op)');
  const k = engineSrc.indexOf('{', i);
  let d = 0;
  for (let p = k; p < engineSrc.length; p++) {
    if (engineSrc[p] === '{') d++;
    else if (engineSrc[p] === '}') { d--; if (!d) return engineSrc.slice(k, p + 1); }
  }
  return '';
})();
const implemented = new Set();
[...inApplyOp.matchAll(/case\s+['"]([A-Za-z_][\w]*)['"]/g)].forEach(m => implemented.add(m[1]));
[...effectsSrc.matchAll(/^\s{2,6}([A-Za-z_][\w]*)\s*[(:]/gm)].forEach(m => implemented.add(m[1]));
[...effectsSrc.matchAll(/Zfx\.([A-Za-z_][\w]*)\s*=/g)].forEach(m => implemented.add(m[1]));
const zfxRuntime = run('return Object.keys(window.Zfx || {});');
zfxRuntime.forEach(k => implemented.add(k));

/* ---------- 3) ตรวจ ---------- */
const errors = [];
const warns = [];
const usedOps = new Set();

const ACTIONABLE = /\b(draw|gain|target|rest|refresh|discard|mill|destroy|move|attack|return|search|reveal|add|play|put|buff|reduce|choose|select|swap|banish|lock|unlock|ready)\b/i;
const COST_PARAM_HINT = /(minCost|maxCost|costIs|costEq|Cost6|Cost5|Cost10|HighCost|costShift|shiftCost|handCostReduce|costLock|costOfTarget|by:'?cost|perCost)/;
const COLOR_WORDS = /(yellow|blue|green|red|purple|colorless)/i;

cards.forEach(c => {
  c.abilities.forEach(a => {
    const jos = JSON.stringify(a.ops);
    const low = a.text.toLowerCase();
    a.ops.forEach(o => { if (o && o.op) usedOps.add(o.op); });

    /* ERROR: ข้อความสั่งให้ทำ แต่ไม่มี ops เลย */
    if (!a.ops.length && ACTIONABLE.test(a.text) && !/\bstatic\b|reduces this|this card's base cost/i.test(a.text)) {
      errors.push([c.file, a.kw, 'NO-OPS', a.text.slice(0, 120)]);
    }
    /* ERROR: op name ที่ engine/effects ไม่รู้จัก */
    a.ops.forEach(o => {
      if (o && o.op && !implemented.has(o.op)) errors.push([c.file, a.kw, 'DEAD-OP:' + o.op, a.text.slice(0, 90)]);
    });

    /* WARN: เงื่อนไข Cost ที่พิมพ์ แต่ ops ไม่เห็นตัวกรอง Cost */
    const costTarget = /(target|choose|select|return|put|move|ready|destroy|play|discard|add|buff|mill)[^.]{0,48}(cost (of )?\d+|cost \d+ or (lower|higher|less|more)|with (a |the )?cost|highest cost|lowest cost|least cost|equal cost)/i.test(a.text);
    if (costTarget && !COST_PARAM_HINT.test(jos) && !/(reduce|discount)/i.test(a.text)) {
      warns.push([c.file, a.kw, 'COST-FILTER?', a.text.slice(0, 120)]);
    }
    /* WARN: สี/เผ่าของเป้าหมาย */
    const colT = (a.text.match(/(target|choose|select|put|add|ready|destroy|move|play|another|1|any)\s+(a\s+|an\s+|your\s+|any\s+)?(yellow|blue|green|red|purple|colorless)\s+(unit|card)/i) || []);
    if (colT.length && !(jos.match(COLOR_WORDS))) warns.push([c.file, a.kw, 'COLOR-FILTER?:' + colT[3], a.text.slice(0, 110)]);
    const trbT = (a.text.match(/(target|choose|select|put|add|ready|destroy|move|play|another)\s+[^.]{0,24}(Witch|Deity|Machine|Plant|Dragon|Demon|Angel|Adventurer|Insect|_construct)/i) || []);
    if (trbT.length && !/tribe|Tribe|Witch|Machine|Plant|Insect|Deity|Adventurer/i.test(jos)) warns.push([c.file, a.kw, 'TRIBE-FILTER?:' + trbT[2], a.text.slice(0, 110)]);
    /* WARN: เป้าหมายต้อง “วางนอนอยู่” / “ตั้งอยู่” */
    const restCond = /(target|choose|select|put|move|ready|destroy|return|add)[^.]{0,40}\b(rested|unreadied)\b/i.test(a.text)
      || /\b(rested|unreadied) (units|cards)[^.]{0,24}(you control|among)[^.]{0,16}(target|choose|one|1)\b/i.test(a.text);
    if (restCond && !/restedOnly|readyOnly|"rest"|:rest|Rest/i.test(jos)) warns.push([c.file, a.kw, 'REST-FILTER?', a.text.slice(0, 120)]);

    /* WARN: ตัวเลขที่พิมพ์ไม่มีใน ops */
    const wantNum = (a.text.match(/\+\s?(\d{3,4})\s?\d{0,3}\s?Power/i) || [])[1];
    if (wantNum) {
      const cps = a.ops.filter(o => o.op === 'cp').map(o => Number(o.n));
      if (cps.length && !cps.includes(Number(wantNum)) && !/each|per|for every|merged/i.test(a.text)) {
        warns.push([c.file, a.kw, `CP-NUM? text+${wantNum} vs ops ${cps.join('/')}`, a.text.slice(0, 100)]);
      }
    }
    /* WARN: [Trigger]/Interrupt แต่ไม่มี req และไม่มี op require */
    if (/^(trigger|interrupt)/i.test(a.kw) && !a.req && !/require|passReq|cond/i.test(jos)) {
      warns.push([c.file, a.kw, 'TRIGGER-NO-REQ?', a.text.slice(0, 120)]);
    }
  });
});

/* ---------- 4) รายงาน ---------- */
console.log(`การ์ด ${cards.length} ใบ · ability ${cards.reduce((s, c) => s + c.abilities.length, 0)} ช่อง · op names ที่ใช้ ${usedOps.size} แบบ · dispatch รองรับ ${implemented.size} ชื่อ`);
const missAll = [...usedOps].filter(n => !implemented.has(n));
if (missAll.length) missAll.forEach(n => console.log('  DEAD-OP(global): ' + n));

if (errors.length) {
  console.log(`\n❌ ERROR ${errors.length} รายการ`);
  errors.forEach(e => console.log(`  ${e[0]} [${e[1]}] ${e[2]}\n      ${e[3]}`));
} else console.log('\n✅ ERROR: ไม่มี — ทุก ability มี ops และทุก op มีกลไกจริงในเครื่อง');

if (warns.length) {
  console.log(`\n⚠  WARN ${warns.length} รายการ (ให้เปิดการ์ดเทียบข้อความทีละใบ):`);
  warns.forEach(w => console.log(`  ${w[0]} [${w[1]}] ${w[2]}\n      ${w[3]}`));
} else console.log('✅ WARN: ไม่มี');

process.exit(errors.length ? 1 : 0);
