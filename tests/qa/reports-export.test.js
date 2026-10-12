// QA หมวด 6 รายงาน (R01–R09) + 7 ส่งออก (E02–E05) + U02 พนักงานดูยอดวันอื่น · jsdom เปิด prototype/pos.html
const {eq, done, open, wait, rng, T} = require('./qa-helper');

/* แยก CSV ตาม RFC 4180 (รองรับ "" และขึ้นบรรทัดใหม่ในช่อง) */
function parseCsv(t){
  const rows = []; let row = [], cell = '', q = false;
  for(let i = 0; i < t.length; i++){
    const c = t[i];
    if(q){ if(c === '"' && t[i + 1] === '"'){ cell += '"'; i++; } else if(c === '"') q = false; else cell += c; }
    else if(c === '"') q = true;
    else if(c === ','){ row.push(cell); cell = ''; }
    else if(c === '\r' && t[i + 1] === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  row.push(cell); rows.push(row); return rows;
}

const SALE_FN = `window.mkSale = o => {
  const items = o.items.map(c => { const m = MENU[c.menu];
    const st = {size:c.size || null, picks:c.picks || [], comps: m.defaults ? m.defaults.map((d, i) => c.ch && i in c.ch ? c.ch[i] : d) : [], adds:c.adds || [], sep:!!c.sep};
    const P = priceItem(m, st);
    return {menu:m.id, name:m.name, sizeName:P.sizeName, tops:P.tops, ...(!m.noHoney && {honey:c.honey || 'normal'}), note:c.note || '', unit:P.unit, qty:c.qty || 1, ...(P.sep && {sep:P.sep}), key:Math.random()}; });
  const gross = items.reduce((a, i) => a + i.unit * i.qty, 0);
  const pr = o.promo ? promoEval(PROMO[o.promo], items, null) : null;
  const total = gross - (pr && pr.ok ? pr.discount : 0);
  const s = {id:o.id, no:o.no || 1, date:o.date, ts:new Date(o.id).toISOString(), dining:o.dining || 'dinein', items:items.map(({key, ...i}) => i), total, method:o.method || 'cash',
    received: o.method === 'cash' || !o.method ? total : total, change:0, void:!!o.void, staff:o.staff || 'แพร', staffId:'u2', ...(o.void && {log:[{act:'void', at:new Date(o.id + 1000).toISOString(), by:'เจ้าของ'}]}),
    ...(pr && pr.ok && {promo:{id:o.promo, name:PROMO[o.promo].name, discount:pr.discount, detail:pr.detail}})};
  return s;
};`;

(async () => {
  const NOW = T(2026, 10, 12, 14, 0);
  let p = open({now: NOW}); await wait(30); p.signIn();
  let {$, $$, click, ev} = p;
  ev(SALE_FN);

  // ---------- R03 ไม่มีบิล ----------
  click('#btnSummary');
  eq('R03 ไม่มีบิล: KPI ไม่มี NaN / Infinity / undefined', $$('.stat b').map(b => b.textContent), ['฿0', '0', '0', '–']);
  for(const t of ['pay', 'opts', 'ingr', 'bills', 'staff']) click(`[data-tab="${t}"]`);
  eq('R03 ทุกแท็บเปิดได้ตอนไม่มีบิล ไม่มีคำว่า NaN', [/NaN|undefined|Infinity/.test($('#modal').textContent), p.errors], [false, []]);
  click('#closeX');

  // ---------- ข้อมูลสุ่ม 10 วัน (seed 202) ----------
  const r = rng(202), ACAI = ['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds'];
  const tops = ev('CONFIG.items.map(i => i.name)'), cat = ev('Object.fromEntries(CONFIG.items.map(i => [i.name, i.cat]))');
  const specs = [];
  for(let day = 3; day <= 12; day++){
    const n = 3 + r.int(6);
    for(let k = 0; k < n; k++){
      const id = T(2026, 10, day, 9 + k), items = [];
      for(let j = 0, m = 1 + r.int(3); j < m; j++){
        const menu = r.pick(['greek', 'greek', 'acai', 'banana']), c = {menu, qty:1 + (r() < 0.25 ? 1 : 0), sep:r() < 0.25, honey:r.pick(['none', 'little', 'normal', 'lots', 'side'])};
        if(menu === 'greek'){ c.size = r.pick(['g1n', 'g1', 'g2']); c.picks = Array.from({length:r.int(7)}, () => r.pick(tops)); }
        else { c.ch = {}; (menu === 'acai' ? ACAI : ['Banana', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips']).forEach((d, i) => { const x = r(); if(x < 0.15) c.ch[i] = null; else if(x < 0.35) c.ch[i] = r.pick(tops.filter(t => cat[t] === cat[d])); });
          c.adds = r() < 0.3 ? Array.from({length:1 + r.int(2)}, () => r.pick(tops)) : []; }
        items.push(c);
      }
      specs.push({id, no:k + 1, date:`2026-10-${String(day).padStart(2, '0')}`, items, method:r.pick(['cash', 'cash', 'promptpay', 'tcp']), dining:r.pick(['dinein', 'takeaway']),
        void:r() < 0.12, staff:r.pick(['แพร', 'เจ้าของ']), promo:r() < 0.3 ? r.pick(['b1g1', 'off30', 'freetop']) : null});
    }
  }
  const sales = ev(`(${JSON.stringify(specs)}).map(mkSale)`);
  ev(`saveSales(${JSON.stringify(sales)})`);

  /* ค่าอ้างอิงคำนวณจากบิลตรงๆ (ไม่ใช้ buildReport) */
  const EXTRA = {Granola:10, Blueberries:15, Strawberries:15};
  function ref(from, to){
    const ok = sales.filter(s => s.date >= from && s.date <= to && !s.void);
    const o = {total:0, bills:ok.length, cups:0, methods:{cash:0, promptpay:0, tcp:0}, extraRev:0, extraPcs:0};
    ok.forEach(s => {
      o.total += s.total; o.methods[s.method] += s.total;
      s.items.forEach(i => { o.cups += i.qty;
        i.tops.forEach(t => { o.extraRev += (t.extra || 0) * i.qty; });
        /* ชิ้นที่คิดเงินตามกติกา §3–4 */
        let pcs = 0;
        if(i.menu === 'greek'){ const all = i.tops.reduce((a, t) => a + t.n, 0), ex = i.tops.filter(t => t.name in EXTRA).reduce((a, t) => a + t.n, 0);
          pcs = /ชิ้นละ/.test(i.sizeName) ? all : ex + Math.max(0, all - ex - 3); }
        else pcs = i.tops.filter(t => t.add).reduce((a, t) => a + t.n, 0) + i.tops.filter(t => t.from && !t.removed && t.name in EXTRA && !(t.from in EXTRA)).length;
        o.extraPcs += pcs * i.qty; });
    });
    return o;
  }
  let bad = null;
  const ranges = [['2026-10-12', '2026-10-12'], ['2026-10-03', '2026-10-12'], ['2026-10-05', '2026-10-07'], ['2026-10-01', '2026-10-31']];
  for(let k = 0; k < 30; k++){ const a = `2026-10-${String(3 + r.int(10)).padStart(2, '0')}`, b = `2026-10-${String(3 + r.int(10)).padStart(2, '0')}`; ranges.push(a < b ? [a, b] : [b, a]); }
  for(const [from, to] of ranges){
    const R = ev(`(() => { const R = buildReport('${from}', '${to}'); const G = R.groups['ท็อปปิ้งที่คิดเงินเพิ่ม'] || {rows:{}};
      return {total:R.total, bills:R.bills, cups:R.cups, discount:R.discount, items:Object.values(R.items).reduce((a, x) => a + x.rev, 0),
        methods:Object.fromEntries(Object.entries(R.methods).map(([k, v]) => [k, v.rev])), extraRev:Object.values(G.rows).reduce((a, x) => a + x.rev, 0), extraPcs:Object.values(G.rows).reduce((a, x) => a + x.qty, 0)}; })()`);
    const e = ref(from, to);
    const checks = {R01:[R.total, R.bills, R.cups], R02items:R.items - R.discount, R02pay:Object.values(R.methods).reduce((a, x) => a + x, 0), R02methods:R.methods, R05:[R.extraRev, R.extraPcs]};
    const exp = {R01:[e.total, e.bills, e.cups], R02items:e.total, R02pay:e.total, R02methods:e.methods, R05:[e.extraRev, e.extraPcs]};
    if(JSON.stringify(checks) !== JSON.stringify(exp)){ bad = {seed:202, from, to, got:checks, exp}; break; }
  }
  eq(`R01/R02/R05 property ${ranges.length} ช่วงวันที่ บน ${sales.length} บิลสุ่ม (seed 202): ยอดรวม · สินค้า − ส่วนลด · ช่องทางชำระ · ท็อปปิ้งที่คิดเพิ่ม (ชิ้น + เงิน)`, bad, null);

  // ---------- R06 ช่วงวันที่ ----------
  const range = k => ev(`(setRange('${k}'), [REP.from, REP.to])`);
  eq('R06 วันนี้ / เมื่อวาน / 7 วัน / ทั้งหมด (นับตามรอบ)', [range('today'), range('yday'), range('7d'), range('all')],
    [['2026-10-12', '2026-10-12'], ['2026-10-11', '2026-10-11'], ['2026-10-06', '2026-10-12'], ['2026-10-03', '2026-10-12']]);
  click('#btnSummary'); click('[data-range="7d"]');
  const setDate = (id, v) => { const i = $('#' + id); i.value = v; i.dispatchEvent(new p.w.Event('change')); };
  setDate('repFrom', '2026-10-10'); setDate('repTo', '2026-10-05');
  eq('R06 กำหนดเอง from > to: ช่วงไม่กลับด้าน', ev('REP.from <= REP.to'), true);
  const rv = ev('[REP.from, REP.to]');
  click('#closeX');
  p.w.__now = T(2026, 10, 12, 23, 30);
  eq('R06 หลัง 23:00 "วันนี้" = รอบ 13 ต.ค.', range('today'), [['2026-10-13', '2026-10-13']][0]);

  // ---------- R07 เปิดสรุปหลัง 23:00 ยังไม่มีบิลรอบใหม่ ----------
  p.signIn('1234'); click('#btnSummary');
  eq('R07 เจ้าของ: เห็นรอบล่าสุดที่มีการขาย + ป้ายแจ้ง', [ev('REP.from'), $('#modal').textContent.includes('รอบปัจจุบันยังไม่มีบิล')], ['2026-10-12', true]);
  click('#closeX'); p.signIn('1111'); click('#btnSummary');
  eq('R07 พนักงาน: เห็นรอบวันนี้ (ว่าง)', [ev('REP.from'), $$('.stat b')[0].textContent], ['2026-10-13', '฿0']);
  click('#closeX'); p.w.__now = NOW + 60000; p.signIn('1234');

  // ---------- R04 วัตถุดิบ ----------
  const ing = specsList => ev(`(() => { const all = loadSales(); const add = (${JSON.stringify(specsList)}).map(mkSale); saveSales(add);
    const R = buildReport('2026-10-20', '2026-10-20'); return Object.fromEntries(Object.values(R.ingr).map(x => [x.sec + ':' + x.name, x.qty])); })()`);
  const I = ing([{id:T(2026, 10, 20, 10), date:'2026-10-20', items:[
    {menu:'greek', size:'g2', picks:['Banana', 'Banana', 'Granola'], honey:'none', qty:2},
    {menu:'acai', ch:{0:null, 1:'Mango'}, adds:['Kiwi'], honey:'lots'},
    {menu:'banana'}]}]);
  eq('R04 Greek 129 ×2 = 4 สกู๊ป · base Acai 1 ถ้วย · Banana 1 ถ้วย', [I['base:Greek Yogurt (สกู๊ป)'], I['base:Acai base (ถ้วย)'], I['base:Banana Choco base (ถ้วย)']], [4, 1, 1]);
  eq('R04 ท็อปปิ้งนับชิ้น ×qty: กล้วย 2×2 + 1 (Banana Choco) = 5 · กราโนล่า 2 + 1 = 3', [I['fruit:กล้วย'], I['dried:กราโนล่า']], [5, 3]);
  eq('R04 ไม่รับไม่นับ · เปลี่ยนนับตัวใหม่ · เพิ่มนับด้วย: สตรอว์ฯ 0 · มะม่วง 1 · กีวี 1', [I['fruit:สตรอว์เบอร์รี่'] || 0, I['fruit:มะม่วง'], I['fruit:กีวี']], [0, 1, 1]);
  eq('R04 น้ำผึ้ง "ไม่รับ" ไม่นับ · ราดเยอะ 1', [I['honey:น้ำผึ้ง · ไม่รับ'] || 0, I['honey:น้ำผึ้ง · ราดเยอะ']], [0, 1]);

  // ---------- R08 บิลเก่า ----------
  const old = [
    {id:T(2026, 10, 21, 10), no:1, date:'2026-10-21', ts:new Date(T(2026, 10, 21, 10)).toISOString(), dining:'dinein', items:[{menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป · ไม่มีท็อปปิ้ง', tops:[], honey:'normal', note:'', unit:69, qty:1}], total:69, method:'cash', received:100, change:31, void:false},
    {id:T(2026, 10, 21, 11), no:2, date:'2026-10-21', ts:new Date(T(2026, 10, 21, 11)).toISOString(), dining:'takeaway', items:[{menu:'banana', name:'Banana Choco', sizeName:'', tops:[{name:'Banana', n:1, extra:0, from:null}], honey:'normal', note:'', unit:149, qty:1}], total:149, method:'tcp', received:149, change:0, void:false}];
  ev(`saveSales(loadSales().concat(${JSON.stringify(old)}))`);
  const r8 = ev(`(() => { const R = buildReport('2026-10-21', '2026-10-21'); const d = document.createElement('div'); d.innerHTML = loadSales().filter(s => s.date === '2026-10-21').map(s => receiptHtml(s) + kitchenHtml(s)).join('');
    receiptBlocks(loadSales().find(s => s.no === 2 && s.date === '2026-10-21')); return [R.total, R.topCups, d.textContent.includes('น้ำผึ้ง: ราดปกติ')]; })()`);
  REPset = (f, t) => ev(`REP.from = '${f}'; REP.to = '${t}'; REP.range = null`);
  click('#btnSummary'); REPset('2026-10-21', '2026-10-21'); for(const t of ['items', 'pay', 'opts', 'ingr', 'bills', 'staff']){ ev(`REP.tab = '${t}'; renderSummary()`); }
  eq('R08 บิลเก่า (ขนาด "ไม่มีท็อปปิ้ง" + Banana มีน้ำผึ้ง): รายงาน พิมพ์ซ้ำ ไม่พัง', [r8, p.errors], [[218, 0, true], []]);
  click('#closeX');

  // ---------- R09 แท็บพนักงาน ----------
  click('#btnSummary'); REPset('2026-10-12', '2026-10-12'); ev("REP.tab = 'staff'; renderSummary()");
  const st = Object.fromEntries($$('#modal table')[0].querySelectorAll('tr').length ? [...$$('#modal table')[0].querySelectorAll('tr')].slice(1).map(tr => [tr.cells[0].textContent, [tr.cells[1].textContent, tr.cells[2].textContent]]) : []);
  const e12 = n => { const ok = sales.filter(s => s.date === '2026-10-12' && !s.void && s.staff === n); return [String(ok.length), '฿' + ok.reduce((a, s) => a + s.total, 0).toLocaleString('en-US')]; };
  eq('R09 ยอดตามคนกดออเดอร์ตรงกับบิล', [st['แพร'], st['เจ้าของ']], [e12('แพร'), e12('เจ้าของ')]);
  eq('R09 log เข้า/ออกระบบแสดง', $$('#modal table')[1].textContent.includes('เข้า'), true);
  click('#closeX');

  // ---------- E02 / E05 CSV ----------
  ev("window.__blobs = []; const __B = Blob; window.Blob = class extends __B { constructor(parts, o){ super(parts, o); window.__blobs.push(parts.join('')); } }");
  click('#btnSummary'); REPset('2026-10-03', '2026-10-12'); ev("REP.tab = 'bills'; renderSummary()");
  click('#csvTab'); click('#csvDl');
  const billsCsv = ev('window.__blobs.pop()');
  eq('E02 CSV มี BOM (U+FEFF) ขึ้นต้นไฟล์ ภาษาไทยอยู่ใน UTF-8', [billsCsv.charCodeAt(0), billsCsv.includes('วันที่รอบขาย')], [0xFEFF, true]);
  const rows = parseCsv(billsCsv.slice(1)), H = rows[0];
  const totIdx = H.indexOf('ยอดรวม'), stIdx = H.indexOf('สถานะ');
  const eRange = ref('2026-10-03', '2026-10-12');
  eq('E05 CSV บิล: ผลรวมบิลปกติ = ยอดขายรวมหน้าสรุป', rows.slice(1).filter(x => x[stIdx] === 'ปกติ').reduce((a, x) => a + Number(x[totIdx]), 0), eRange.total);
  click('#csvBack'); ev("REP.tab = 'pay'; renderSummary()"); click('#csvTab');
  const payRows = parseCsv(ev('csvPending.text')); click('#csvBack');
  eq('E05 CSV ช่องทางชำระ: ผลรวม = ยอดขายรวม', payRows.slice(1).reduce((a, x) => a + Number(x[2]), 0), eRange.total);
  ev("REP.tab = 'items'; renderSummary()"); click('#csvTab');
  const itemRows = parseCsv(ev('csvPending.text')); click('#csvBack');
  eq('E05 CSV สินค้า: ผลรวม (รวมแถวส่วนลด) = ยอดขายรวม', itemRows.slice(1).reduce((a, x) => a + Number(x[2]), 0), eRange.total);
  eq('E05 CSV สินค้า: มีแถว "ส่วนลดโปรโมชัน" ติดลบ', itemRows.some(x => x[0] === 'ส่วนลดโปรโมชัน' && Number(x[2]) < 0), true);
  click('#closeX');

  // ---------- E03 / E04 ข้อความพิเศษใน CSV ----------
  ev(`saveSettings({...SETTINGS, users: SETTINGS.users.concat([{id:'u9', name:'=HYPERLINK("http://x.example","y")', role:'staff', salt:'s', hash:'h'}, {id:'u8', name:'ก้อย, "จุ๊บ"', role:'staff', salt:'s2', hash:'h2'}])})`);
  const tricky = ev(`[mkSale({id:${T(2026, 10, 22, 10)}, date:'2026-10-22', staff:'ก้อย, "จุ๊บ"', items:[{menu:'acai', note:'แยก, ช้อน "2" อัน\\nบรรทัดใหม่'}]}),
    mkSale({id:${T(2026, 10, 22, 11)}, no:2, date:'2026-10-22', staff:'=HYPERLINK("http://x.example","y")', items:[{menu:'banana', note:'=1+1'}]}),
    mkSale({id:${T(2026, 10, 22, 12)}, no:3, date:'2026-10-22', staff:'@SUM(A1)', items:[{menu:'banana', note:'+cmd'}]})]`);
  ev(`saveSales(loadSales().concat(${JSON.stringify(tricky)}))`);
  const csv22 = parseCsv(ev("csvText(billsCsvRows(loadSales().filter(s => s.date === '2026-10-22')))"));
  eq('E03 , " ขึ้นบรรทัดใหม่ ในหมายเหตุ/ชื่อ: ไฟล์ไม่แตก ทุกแถว 12 คอลัมน์ ข้อความครบ', [csv22.length, csv22.map(x => x.length), csv22[1][4].includes('ช้อน "2" อัน\nบรรทัดใหม่'), csv22[1][11]],
    [4, [12, 12, 12, 12], true, 'ก้อย, "จุ๊บ"']);
  const risky = csv22.slice(1).flat().filter(c => /^[=+\-@]/.test(c));
  eq('E04 CSV injection: ไม่มีช่องไหนขึ้นต้นด้วย = + - @', risky, []);
  eq("E04 ข้อความเสี่ยงถูกเติม ' ข้างหน้า ข้อความเดิมยังอยู่ครบ", [csv22[2][11], csv22[3][11]], ['\'=HYPERLINK("http://x.example","y")', "'@SUM(A1)"]);
  eq('E04 ตัวเลขติดลบไม่ถูกเติม (แถวส่วนลด)', ev("csvText([['ส่วนลดโปรโมชัน', '', -149, '']])"), '"ส่วนลดโปรโมชัน","","-149",""');

  // ---------- U02 พนักงานพยายามดูยอดวันอื่น ----------
  p.signIn('1111'); click('#btnSummary');
  eq('U02 พนักงาน: ไม่มีปุ่มเลือกช่วง / ช่องวันที่ / สำรองทั้งหมด', [$$('[data-range]').length, !!$('#repFrom'), !!$('#csvAll')], [0, false, false]);
  ev("REP.from = '2026-10-03'; REP.to = '2026-10-12'; REP.tab = 'bills'; renderSummary()");
  eq('U02 แก้ REP.from แล้ว render: ยังเห็นแค่วันนี้', [ev('REP.from'), ev('REP.to')], ['2026-10-12', '2026-10-12']);
  click('#csvTab'); const sc = parseCsv(ev('csvPending.text'));
  eq('U02 CSV แท็บบิลของพนักงาน มีแค่รอบวันนี้', [...new Set(sc.slice(1).map(x => x[0]))], ['2026-10-12']);
  click('#csvBack'); click('#closeDay'); click('#clBack');
  ev('openBackup(null)'); const bk = JSON.parse(ev('csvPending.text'));
  eq('U02 พนักงานกด "สำรองข้อมูล" (หน้าปิดร้าน/ตั้งค่า) ได้ไฟล์ที่มีบิลทุกวัน', [...new Set(bk.sales.map(s => s.date))].length > 1, true);   // ⚠️ คำถาม: business-rules §6.5 ❌ กับ §6.6 ทุกคนสำรองได้
  click('#csvBack');
  eq('R/E ไม่มี runtime error', p.errors, []);
  p.close();
  console.log('INFO R06 from > to: เลือก from 10 ต.ค. ตอน to 5 ต.ค. →', JSON.stringify(rv));
  done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
let REPset;
