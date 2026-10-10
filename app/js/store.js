/* เก็บยอดขาย: IndexedDB เป็นที่เก็บหลัก + สำเนาสำรองใน localStorage
   - ตอนเปิดหน้า (storeReady) อ่านบิลจาก IndexedDB และ localStorage มารวมกัน แล้วถือไว้ในหน่วยความจำ
     ข้อมูลจากต้นแบบเดิม (localStorage key เดียวกัน) จึงถูกย้ายเข้า IndexedDB อัตโนมัติ และไม่ลบของเดิม
   - loadSales() / saveSales() ยังเป็นแบบ sync เหมือนเดิม ส่วนการเขียนลง IndexedDB ทำเบื้องหลังเฉพาะบิลที่เปลี่ยน
   - saveSales เพิ่มหรือแก้บิลได้อย่างเดียว ไม่ลบ (บิลที่ไม่อยู่ใน list ยังอยู่ครบ) ลบทั้งหมดได้ทาง clearSales() ซึ่งใช้เฉพาะ DEMO
   - ถ้าเบราว์เซอร์ไม่มี IndexedDB ใช้ localStorage อย่างเดียว ถ้าไม่มีทั้งคู่ใช้หน่วยความจำ + แถบเตือน */
const KEY = 'geek_popup_sales_v2';
const DB_STORE = 'sales';

let ROWS = [];               // JSON ของแต่ละบิล เรียงตามลำดับที่บันทึก
const ROW_AT = new Map();    // id → ตำแหน่งใน ROWS
let DB = null, STORE_MODE = 'loading', LS_OK = true, DB_FAILS = 0;

function storeBanner(id, text){
  if(document.getElementById(id)) return;
  const b = document.createElement('div'); b.id = id;
  b.style.cssText = 'background:#c62828;color:#fff;text-align:center;padding:6px 10px;font-size:14px';
  b.textContent = text;
  document.body.prepend(b);
}
function memMode(){
  STORE_MODE = 'memory';
  storeBanner('memBanner', '⚠️ เบราว์เซอร์นี้ไม่ให้บันทึกข้อมูลถาวร ยอดขายจะหายเมื่อปิดหน้า กรุณาส่งออก CSV ก่อนปิด');
}

/* บิลที่ log ยาวกว่าคือฉบับใหม่กว่า (log เพิ่มได้อย่างเดียว) เท่ากันใช้ตัวแรก */
const newerSale = (a, b) => ((b.log || []).length > (a.log || []).length ? b : a);
function putRow(s){
  const j = JSON.stringify(s);
  if(ROW_AT.has(s.id)){ const i = ROW_AT.get(s.id); if(ROWS[i] === j) return false; ROWS[i] = j; }
  else { ROW_AT.set(s.id, ROWS.length); ROWS.push(j); }
  return true;
}

const idbReq = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
function openDb(){
  return new Promise((ok, no) => {
    const r = indexedDB.open(KEY, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE, {keyPath: 'id'});
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(new Error('blocked'));
  });
}
function dbWrite(list, clear){
  if(!DB) return;
  try{
    const tx = DB.transaction(DB_STORE, 'readwrite'), st = tx.objectStore(DB_STORE);
    if(clear) st.clear();
    list.forEach(s => st.put(s));
    tx.onabort = dbFailed;     // request ที่ error จะทำให้ทั้ง transaction ถูก abort
  }catch(e){ dbFailed(); }
}
function dbFailed(){
  DB_FAILS++; console.error('IndexedDB write failed');
  if(!LS_OK) storeBanner('dbBanner', '⚠️ บันทึกยอดขายลงเครื่องไม่สำเร็จ กรุณาส่งออก CSV ทันที แล้วแจ้งผู้ดูแล');
}
function lsRead(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ LS_OK = false; return null; }
}
function lsWrite(){
  if(!LS_OK && DB) return;     // พื้นที่ localStorage เต็มแล้ว ใช้ IndexedDB อย่างเดียว
  try{ localStorage.setItem(KEY, '[' + ROWS.join(',') + ']'); LS_OK = true; }
  catch(e){ LS_OK = false; if(!DB) memMode(); }
}

async function openStore(){
  const fromLs = lsRead();
  let fromDb = null;
  if(typeof indexedDB !== 'undefined'){
    try{ DB = await openDb(); fromDb = await idbReq(DB.transaction(DB_STORE).objectStore(DB_STORE).getAll()); }
    catch(e){ DB = null; }
  }
  if(!DB && fromLs === null){ memMode(); return; }
  STORE_MODE = DB ? 'indexeddb' : 'localstorage';
  /* รวมสองแหล่ง: เรียงตาม id (= เวลาที่ขาย) ถ้ามีทั้งคู่ใช้ฉบับที่ log ยาวกว่า */
  const byId = new Map();
  (fromDb || []).forEach(s => byId.set(s.id, s));
  (fromLs || []).forEach(s => byId.set(s.id, byId.has(s.id) ? newerSale(byId.get(s.id), s) : s));
  [...byId.values()].sort((a, b) => a.id - b.id).forEach(putRow);
  const dbIds = new Map((fromDb || []).map(s => [s.id, JSON.stringify(s)]));
  const missing = ROWS.map(j => JSON.parse(j)).filter(s => dbIds.get(s.id) !== JSON.stringify(s));
  if(missing.length) dbWrite(missing);                    // migration จาก localStorage (และบิลที่ IndexedDB ตกหล่น)
  if(ROWS.length) lsWrite();                              // สำเนาสำรองให้ตรงกัน
  if(DB && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});  // ขอไม่ให้เบราว์เซอร์ล้างข้อมูลเอง
}
const storeReady = openStore().catch(e => { console.error(e); memMode(); });

function loadSales(){ return JSON.parse('[' + ROWS.join(',') + ']'); }
function saveSales(list){
  const changed = list.filter(putRow);
  if(changed.length){ dbWrite(changed); lsWrite(); }
  return true;
}
/* ลบบิลทั้งหมด · ใช้เฉพาะปุ่มสร้างข้อมูลตัวอย่างใหม่ใน DEMO ห้ามใช้กับข้อมูลจริง */
function clearSales(){
  ROWS = []; ROW_AT.clear();
  dbWrite([], true); LS_OK = true; lsWrite();
}
function nextNo(){ const biz = bizDate(new Date()); return (loadSales().filter(s => s.date === biz).length % 999) + 1; }
