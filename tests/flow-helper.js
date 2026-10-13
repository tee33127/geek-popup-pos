// หน้าเลือกออเดอร์แบบทีละขั้น (Tee 2026-10-13): เมนู → ขนาด → ท็อปปิ้ง → [ถัดไป] → น้ำผึ้ง → [เพิ่มลงออเดอร์]
// ปุ่มของแต่ละขั้นมีเฉพาะตอนขั้นนั้นกางอยู่ ตัวช่วยนี้จึงกางขั้นให้ก่อน (แบบที่พนักงานแตะแถวสรุป "เปลี่ยน")
const q = (w, s) => w.document.querySelector(s);
const tap = (w, s) => { const el = q(w, s); if(!el) throw new Error('missing ' + s); el.click(); };
const modal = w => !!(q(w, '#fewBack') || q(w, '#cheapSwitch'));   // หน้าต่างถามเรื่องท็อปปิ้ง (หน้าต่างอื่น เช่น เงินทอนตั้งต้น ไม่นับ)
/* เลือกเมนู: ขั้นเมนูยุบอยู่ → แตะแถว "เมนู" ก่อน */
function menu(w, id){ if(!q(w, `[data-menu="${id}"]`) && q(w, '[data-open="menu"]')) tap(w, '[data-open="menu"]'); tap(w, `[data-menu="${id}"]`); }
/* เลือกขนาด: ขั้นขนาดยุบอยู่ → แตะแถว "ขนาด" ก่อน */
function size(w, id){ if(!q(w, `[data-size="${id}"]`) && q(w, '[data-open="size"]')) tap(w, '[data-open="size"]'); tap(w, `[data-size="${id}"]`); }
/* ไปขั้นน้ำผึ้ง (กด "ถัดไป" ถ้ายังอยู่ขั้นท็อปปิ้ง · อาจมีหน้าต่างถาม → คืน false) แล้วเลือก */
function honey(w, id = 'normal'){
  if(!q(w, '[data-honey]')){
    if(q(w, '[data-open="honey"]')) tap(w, '[data-open="honey"]');
    else if(q(w, '#btnAdd').dataset.act === 'tops') tap(w, '#btnAdd');
  }
  if(modal(w) || !q(w, `[data-honey="${id}"]`)) return false;
  tap(w, `[data-honey="${id}"]`); return true;
}
/* กลับไปกางขั้นท็อปปิ้ง (เช่น หลังเลือกน้ำผึ้งแล้วจะแก้ท็อปปิ้ง) */
function tops(w){ if(q(w, '[data-open="tops"]')) tap(w, '[data-open="tops"]'); }
/* กดปุ่มหลักจนแก้วลงตะกร้า เลือกน้ำผึ้งให้เมื่อถึงขั้นน้ำผึ้ง
   คืน true = เพิ่มแล้ว · false = มีหน้าต่างถาม (ท็อปปิ้งฟรีไม่ครบ / 69 แพงกว่า) ให้เทสต์ตอบเองแล้วเรียกซ้ำ หรือปุ่มกดไม่ได้ */
function finish(w, hon = 'normal'){
  for(let i = 0; i < 4; i++){
    if(modal(w)) return false;
    if(!w.eval('sel.menu')) return true;
    if(q(w, '[data-honey]') && !q(w, '.hon.on')) tap(w, `[data-honey="${hon}"]`);
    if(q(w, '#btnAdd').disabled) return false;
    tap(w, '#btnAdd');
  }
  return !w.eval('sel.menu');
}
module.exports = {menu, size, honey, tops, finish};
