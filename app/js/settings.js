/* ตั้งค่าเฉพาะเครื่อง (เช่นเลข PromptPay) เก็บใน localStorage ของแท็บเล็ต ไม่อยู่ในโค้ด เพราะ repo เป็น public
   ตั้งค่าได้ที่ สรุปยอด (PIN) → ตั้งค่า */
const SETTINGS_KEY = 'geek_popup_settings';
let SETTINGS = (() => { try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }catch(e){ return {}; } })();
function saveSettings(next){
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); SETTINGS = next; return true; }
  catch(e){ console.warn('settings', e); return false; }
}
