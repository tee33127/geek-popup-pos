/* ตั้งค่าเฉพาะเครื่อง (เช่นเลข PromptPay) เก็บใน localStorage ของแท็บเล็ต ไม่อยู่ในโค้ด เพราะ repo เป็น public
   ตั้งค่าได้ที่ปุ่ม ตั้งค่า บนแถบหัว · โหลดต่อจาก config.js ทันที (ก่อนไฟล์อื่นอ่าน CONFIG) */
const SETTINGS_KEY = 'geek_popup_settings';
let SETTINGS = (() => { try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }catch(e){ return {}; } })();
function saveSettings(next){
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); SETTINGS = next; return true; }
  catch(e){
    console.warn('settings', e);
    /* เบราว์เซอร์บล็อกที่เก็บข้อมูล: ใช้ในหน่วยความจำไปก่อน (มีแถบเตือนอยู่แล้ว) · พื้นที่เต็ม: ถือว่าไม่สำเร็จ */
    try{ localStorage.getItem(SETTINGS_KEY); return false; }catch(_){ SETTINGS = next; return true; }
  }
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
