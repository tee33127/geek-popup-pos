/* ตั้งค่าเฉพาะเครื่อง (เช่นเลข PromptPay) เก็บใน localStorage ของแท็บเล็ต ไม่อยู่ในโค้ด เพราะ repo เป็น public
   ตั้งค่าได้ที่ปุ่ม ตั้งค่า บนแถบหัว · โหลดต่อจาก config.js ทันที (ก่อนไฟล์อื่นอ่าน CONFIG) */
const SETTINGS_KEY = 'geek_popup_settings';
const RECOVERY_KEY = SETTINGS_KEY + '_recovery';   // hash รหัสกู้คืน แยกจาก settings เพื่อให้ยังใช้ได้ตอน settings เสีย

/* ---------- ข้อมูลเสีย (Tee 2026-10-12) ----------
   อ่าน JSON ไม่ได้ → คัดลอกข้อความเดิมไปเก็บที่ <key>_corrupt_<เวลา> ก่อนมีอะไรเขียนทับ ห้ามลบ
   คัดลอกไม่สำเร็จ (พื้นที่เต็ม) → ล็อก key นั้น ห้ามเขียนทับจนกว่าจะแก้ (CORRUPT_LOCK) · ยอดขายไม่ผ่านที่นี่ */
const CORRUPT_LOCK = new Set();
function keepCorrupt(key, raw){
  try{
    const have = Object.keys(localStorage).some(k => k.startsWith(key + '_corrupt_') && localStorage.getItem(k) === raw);
    if(!have) localStorage.setItem(key + '_corrupt_' + Date.now(), raw);
    CORRUPT_LOCK.delete(key); return true;
  }catch(e){ CORRUPT_LOCK.add(key); return false; }
}
/* อ่าน JSON · ไม่มี = fallback · เสีย = เก็บของเดิมแยกแล้วคืน fallback (corrupt:true) · ชนิดต้องตรงกับ fallback (object / array) */
function readStored(key, fallback){
  let raw; try{ raw = localStorage.getItem(key); }catch(e){ return {value:fallback, blocked:true}; }
  if(raw === null) return {value:fallback};
  try{
    const v = JSON.parse(raw);
    if(v === null || typeof v !== 'object' || Array.isArray(v) !== Array.isArray(fallback)) throw new Error('shape');
    return {value:v};
  }catch(e){ keepCorrupt(key, raw); return {value:fallback, corrupt:true}; }
}
/* แถบแดงเตือน (ข้อความธรรมดา ไม่พึ่ง icon.js ที่โหลดทีหลัง) */
function dataBanner(id, text){
  if(typeof document === 'undefined' || !document.body || document.getElementById(id)) return;
  const b = document.createElement('div'); b.id = id; b.className = 'databanner';
  b.style.cssText = 'background:#c62828;color:#fff;text-align:center;padding:8px 10px;font-size:15px;font-weight:700';
  b.textContent = text; document.body.prepend(b);
}

let SETTINGS_BROKEN = false;
let SETTINGS = (() => { const r = readStored(SETTINGS_KEY, {}); SETTINGS_BROKEN = !!r.corrupt; return r.value; })();
function saveSettings(next){
  if(CORRUPT_LOCK.has(SETTINGS_KEY) && !keepCorrupt(SETTINGS_KEY, localStorage.getItem(SETTINGS_KEY))) return false;   // ของเสียยังคัดลอกไม่ได้ ห้ามทับ
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); SETTINGS = next; SETTINGS_BROKEN = false; return true; }
  catch(e){
    console.warn('settings', e);
    /* เบราว์เซอร์บล็อกที่เก็บข้อมูล: ใช้ในหน่วยความจำไปก่อน (มีแถบเตือนอยู่แล้ว) · พื้นที่เต็ม: ถือว่าไม่สำเร็จ */
    try{ localStorage.getItem(SETTINGS_KEY); return false; }catch(_){ SETTINGS = next; return true; }
  }
}

/* ---------- รหัสกู้คืน (hash) เก็บแยก key · ย้ายจาก SETTINGS.recovery ของเวอร์ชันเก่า ---------- */
let RECOVERY_MEM = null;   // เบราว์เซอร์บล็อกที่เก็บข้อมูล
function recoveryHash(){ const r = readStored(RECOVERY_KEY, {}); return r.blocked ? RECOVERY_MEM : (r.value.hash && r.value.salt ? r.value : null); }
function setRecoveryHash(rec){
  RECOVERY_MEM = rec || null;
  try{ if(rec) localStorage.setItem(RECOVERY_KEY, JSON.stringify(rec)); else localStorage.removeItem(RECOVERY_KEY); return true; }
  catch(e){ try{ localStorage.getItem(RECOVERY_KEY); return false; }catch(_){ return true; } }
}
if(SETTINGS.recovery){
  /* migration: เขียน key ใหม่ให้สำเร็จก่อน แล้วค่อยเอาออกจาก settings (ถ้า key ใหม่มีอยู่แล้ว ใช้ของ key ใหม่) */
  if(recoveryHash() || setRecoveryHash(SETTINGS.recovery)){ const {recovery, ...rest} = SETTINGS; saveSettings(rest); }
}

/* ของหมด: SETTINGS.out = {menus:[id], items:[name]} → ใส่ out:true ใน CONFIG ในที่เดิม (MENU / ITEM เห็นทันที)
   ร้านแก้ได้แค่ มี/หมด ราคาแก้ในแอปไม่ได้ (Tee 2026-10-12 กลัวกดผิด) */
function applyOut(){
  const o = SETTINGS.out || {};
  CONFIG.menus.forEach(m => { m.out = (o.menus || []).includes(m.id); });
  CONFIG.items.forEach(it => { it.out = (o.items || []).includes(it.name); });
}
function setOut(kind, key, out){
  const o = SETTINGS.out || {}, list = (o[kind] || []).filter(k => k !== key);
  if(out) list.push(key);
  const next = {...SETTINGS, out:{...o, [kind]:list}};
  if(!saveSettings(next)) return false;
  applyOut(); return true;
}
applyOut();
