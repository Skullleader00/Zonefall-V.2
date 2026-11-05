#!/usr/bin/env python3
"""Zonefall · stamp build token — รันหนึ่งคำสั่งทุกครั้งที่แก้โค้ดก่อน commit/push

จุดที่ token ต้องตรงกัน (ฟังก์นี้จะจัดให้หมด):
  1) index.html     — ?v= บน css/lobby.css, data.js, battle.js, app.js, game/js/data.js
  2) game/index.html — ?v= บน css/game.css, js/*.js, manifest.webmanifest
  3) game/sw.js      — ชื่อ CACHE (ของเดิมถูกล้างตอน activate)

    python3 tools/stamp.py          # สุม token ใหม่
    python3 tools/stamp.py 1793abc  # กำหนด token เอง
"""
import io
import os
import re
import secrets
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# asset ที่ต้องถูก stamp (path according to each html file)
TARGETS = {
    'index.html': ['css/lobby.css', 'data.js', 'battle.js', 'app.js', 'game/js/data.js'],
    'game/index.html': ['css/game.css', 'js/data.js', 'js/ability-ops.js', 'js/engine.js',
                        'js/effects.js', 'js/ai.js', 'js/lobby-bridge.js', 'js/ui.js',
                        'manifest.webmanifest'],
}


def stamp(rel, assets, tok):
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        return (rel, 0, 'no file')
    s = io.open(p, encoding='utf-8').read()
    n = 0
    for a in assets:
        # src="x.js" หรือ src="x.js?v=เก่า" → src="x.js?v=TOK"
        s2, k = re.subn(r'((?:src|href)=")' + re.escape(a) + r'(?:\?[^"]*)?"',
                        lambda m: m.group(1) + a + '?v=' + tok + '"', s)
        s = s2
        n += k
    io.open(p, 'w', encoding='utf-8').write(s)
    return (rel, n, 'ok')


def main():
    tok = sys.argv[1] if len(sys.argv) > 1 else str(int(time.time())) + '-' + secrets.token_hex(3)
    if not re.fullmatch(r'[0-9a-z][0-9a-z\-]{3,}', tok):
        print('token ต้องเป็น lowercase alnum/dash ยาวอย่างน้อย 4'); return 2
    print('build token =', tok)

    for rel, assets in TARGETS.items():
        f, n, note = stamp(rel, assets, tok)
        print('  %-22s stamp %d จุด (%s)' % (f, n, note))

    p = os.path.join(ROOT, 'game', 'sw.js')
    if os.path.exists(p):
        s = io.open(p, encoding='utf-8').read()
        s2, k = re.subn(r"(const CACHE = ')[^']*'", r'\g<1>zonefall-v12-' + tok + "'", s)
        io.open(p, 'w', encoding='utf-8').write(s2)
        print('  game/sw.js             CACHE name อัปเดต %d จุด' % k)

    # ตรวจความสอดคล้อง: ไม่มี token อื่นตกค้างในไฟล์ที่ stamp แล้ว
    bad = []
    for rel in list(TARGETS) + ['game/sw.js']:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        for m in re.finditer(r'v=([0-9a-zA-Z\-]{8,})|zonefall-v12-([0-9a-zA-Z\-]+)',
                             io.open(p, encoding='utf-8').read()):
            got = m.group(1) or m.group(2)
            if got != tok:
                bad.append((rel, got))
    if bad:
        print('  ⚠ token ไม่ตรงกัน:', bad)
        return 1
    print('  ✅ ทุกไฟล์ใช้ token เดียวกัน:', tok)
    return 0


if __name__ == '__main__':
    sys.exit(main())
