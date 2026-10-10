/* เก็บยอดขาย (ตอนนี้ใช้ localStorage · ขั้นต่อไปย้ายไป IndexedDB พร้อม migration) */
const KEY = 'geek_popup_sales_v2';

let MEM = null;   // ใช้เมื่อเบราว์เซอร์ไม่ให้เก็บข้อมูลถาวร
function memMode(){
  if(MEM) return;
  MEM = [];
  const b = document.createElement('div');
  b.style.cssText = 'background:#c62828;color:#fff;text-align:center;padding:6px 10px;font-size:14px';
  b.textContent = '⚠️ เบราว์เซอร์นี้ไม่ให้บันทึกข้อมูลถาวร ยอดขายจะหายเมื่อปิดหน้า กรุณาส่งออก CSV ก่อนปิด';
  document.body.prepend(b);
}
function loadSales(){
  if(MEM) return JSON.parse(JSON.stringify(MEM));
  try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ memMode(); return []; }
}
function saveSales(list){
  if(!MEM){ try{ localStorage.setItem(KEY, JSON.stringify(list)); return true; }catch(e){ memMode(); } }
  MEM = JSON.parse(JSON.stringify(list)); return true;
}
function nextNo(){ const biz = bizDate(new Date()); return (loadSales().filter(s => s.date === biz).length % 999) + 1; }
