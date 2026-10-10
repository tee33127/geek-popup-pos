// ที่เก็บยอดขาย (store.js) กับ IndexedDB จำลอง (fake-indexeddb) ใน vm เปล่า
// จำลอง "เปิดหน้าใหม่" ด้วยการสร้าง context ใหม่ที่ใช้ IndexedDB และ localStorage ชุดเดิม
const vm = require('vm'), fs = require('fs'), path = require('path');
const {IDBFactory} = require('fake-indexeddb');
const SRC = ['config.js', 'core.js', 'store.js'].map(f => [f, fs.readFileSync(path.join(__dirname, '../../app/js', f), 'utf8')]);
const KEY = 'geek_popup_sales_v2';

class MemStorage {
  constructor(quota = Infinity){ this.m = new Map(); this.quota = quota; }
  getItem(k){ return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v){ if(String(v).length > this.quota) throw new Error('QuotaExceededError'); this.m.set(k, String(v)); }
  removeItem(k){ this.m.delete(k); }
}
function fakeDocument(){
  const els = [];
  return {els,
    getElementById: id => els.find(e => e.id === id) || null,
    createElement: () => ({style:{}, id:'', textContent:''}),
    body: {prepend: e => els.push(e)}};
}
/* เปิดหน้า: โหลด core + store แล้วรอ storeReady */
async function boot({idb, ls, noIdb, blockLs} = {}){
  const document = fakeDocument();
  const g = {document, console, navigator:{}, setTimeout};
  if(!noIdb) g.indexedDB = idb;
  if(blockLs) Object.defineProperty(g, 'localStorage', {get(){ throw new Error('SecurityError'); }});
  else g.localStorage = ls;
  const ctx = vm.createContext(g);
  SRC.forEach(([f, s]) => vm.runInContext(s, ctx, {filename:f}));
  const ev = c => vm.runInContext(c, ctx);
  await ev('storeReady');
  return {ev, document, mode: ev('STORE_MODE')};
}
const settle = () => new Promise(r => setTimeout(r, 30));   // รอ transaction เขียนเสร็จ
async function dbRows(idb){
  const db = await new Promise((ok, no) => { const r = idb.open(KEY); r.onsuccess = () => ok(r.result); r.onerror = no; });
  const all = await new Promise(ok => { const r = db.transaction('sales').objectStore('sales').getAll(); r.onsuccess = () => ok(r.result); });
  db.close(); return all;
}
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const sale = (id, extra = {}) => ({id, no:id, date:'2026-10-11', ts:'', dining:'dinein', items:[], total:100, method:'cash', received:100, change:0, void:false, ...extra});
const ids = list => list.map(s => s.id);

(async () => {
  /* 1. ย้ายข้อมูลจากต้นแบบเดิม (localStorage) เข้า IndexedDB */
  const idb = new IDBFactory(), ls = new MemStorage();
  ls.setItem(KEY, JSON.stringify([sale(2), sale(1)]));
  let p = await boot({idb, ls});
  eq('mode indexeddb', p.mode, 'indexeddb');
  eq('old localStorage sales loaded (sorted by id)', ids(p.ev('loadSales()')), [1, 2]);
  await settle();
  eq('migrated into IndexedDB', ids(await dbRows(idb)), [1, 2]);

  /* 2. ขายเพิ่ม + แก้บิล → เขียนลง IndexedDB */
  p.ev(`{ const all = loadSales(); all.push(${JSON.stringify(sale(3))}); saveSales(all); }`);
  p.ev(`{ const all = loadSales(); all[0].void = true; all[0].log = [{act:'void', at:'x'}]; saveSales(all); }`);
  await settle();
  const rows = await dbRows(idb);
  eq('new sale + void persisted', [ids(rows), rows[0].void], [[1, 2, 3], true]);
  eq('localStorage backup mirrors too', ids(JSON.parse(ls.getItem(KEY))), [1, 2, 3]);
  eq('loadSales returns copies', p.ev('(() => { loadSales()[0].total = 0; return loadSales()[0].total; })()'), 100);

  /* 3. saveSales ไม่ลบบิลที่ไม่ได้ส่งมา */
  p.ev(`saveSales([${JSON.stringify(sale(4))}])`);
  await settle();
  eq('partial save keeps other bills', [ids(p.ev('loadSales()')), ids(await dbRows(idb))], [[1, 2, 3, 4], [1, 2, 3, 4]]);

  /* 4. เปิดหน้าใหม่: IndexedDB เป็นหลัก แม้ localStorage ถูกล้าง */
  ls.removeItem(KEY);
  p = await boot({idb, ls});
  eq('reload from IndexedDB only', ids(p.ev('loadSales()')), [1, 2, 3, 4]);
  eq('void survives reload', p.ev('loadSales()[0].void'), true);
  eq('backup rewritten on reload', ids(JSON.parse(ls.getItem(KEY))), [1, 2, 3, 4]);

  /* 5. รวมสองแหล่ง: ฉบับที่ log ยาวกว่าชนะ + บิลที่มีแค่ใน localStorage ถูกเติมเข้า IndexedDB */
  const backup = JSON.parse(ls.getItem(KEY));
  backup[1].void = true; backup[1].log = [{act:'void', at:'y'}];      // void ที่ IndexedDB ตกหล่น
  backup[0].void = false; backup[0].log = [];                          // ฉบับเก่ากว่า ต้องไม่ทับ
  backup.push(sale(5));
  ls.setItem(KEY, JSON.stringify(backup));
  p = await boot({idb, ls});
  await settle();
  const merged = await dbRows(idb);
  eq('merge picks newer copy', p.ev('loadSales().map(s => s.void)'), [true, true, false, false, false]);
  eq('merge fills IndexedDB', [ids(merged), merged[1].void], [[1, 2, 3, 4, 5], true]);

  /* 6. localStorage เต็ม → ยังบันทึกใน IndexedDB ได้ ไม่มีแถบเตือน */
  const idb2 = new IDBFactory(), small = new MemStorage(400);
  p = await boot({idb:idb2, ls:small});
  for(let i = 1; i <= 5; i++) p.ev(`{ const a = loadSales(); a.push(${JSON.stringify(sale(i))}); saveSales(a); }`);
  await settle();
  eq('quota full: all in IndexedDB', ids(await dbRows(idb2)), [1, 2, 3, 4, 5]);
  eq('quota full: no warning banner', p.document.els.length, 0);

  /* 7. ไม่มี IndexedDB → ใช้ localStorage แบบเดิม */
  const ls3 = new MemStorage(); ls3.setItem(KEY, JSON.stringify([sale(1)]));
  p = await boot({ls:ls3, noIdb:true});
  p.ev(`{ const a = loadSales(); a.push(${JSON.stringify(sale(2))}); saveSales(a); }`);
  eq('no IndexedDB → localStorage', [p.mode, ids(JSON.parse(ls3.getItem(KEY)))], ['localstorage', [1, 2]]);

  /* 8. ไม่มีทั้งคู่ → หน่วยความจำ + แถบเตือนสีแดง */
  p = await boot({noIdb:true, blockLs:true});
  p.ev(`saveSales([${JSON.stringify(sale(1))}])`);
  eq('memory mode works + banner', [p.mode, ids(p.ev('loadSales()')), p.document.els.map(e => e.id)], ['memory', [1], ['memBanner']]);

  /* 9. clearSales (ปุ่มข้อมูลตัวอย่างใหม่ใน DEMO) */
  p = await boot({idb, ls});
  p.ev('clearSales()');
  await settle();
  eq('clearSales empties both', [p.ev('loadSales().length'), (await dbRows(idb)).length, ls.getItem(KEY)], [0, 0, '[]']);

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
