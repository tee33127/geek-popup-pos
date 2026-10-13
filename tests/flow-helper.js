// หน้าเลือกออเดอร์ (Tee 2026-10-13 v3): ขั้นที่เปิดแล้วเปิดค้าง ไม่ยุบ
// Greek เมนู → ขนาด → (ท็อปปิ้ง + น้ำผึ้ง) · Acai เมนู → (ท็อปปิ้งตามสูตร + น้ำผึ้ง) · Banana Choco เมนู → ท็อปปิ้งตามสูตร
// ปุ่มหลักหน้าที่เดียว "เพิ่มลงออเดอร์" · ยังไม่ครบ = สีเทา class "off" (ยังกดได้ เพื่อพาไปขั้นที่ขาด ไม่เพิ่มลงออเดอร์)
const q = (w, s) => w.document.querySelector(s);
const tap = (w, s) => { const el = q(w, s); if(!el) throw new Error('missing ' + s); el.click(); };
const modal = w => !!(q(w, '#fewBack') || q(w, '#cheapSwitch'));   // หน้าต่างถามเรื่องท็อปปิ้ง (หน้าต่างอื่น เช่น เงินทอนตั้งต้น ไม่นับ)
const off = w => q(w, '#btnAdd').classList.contains('off');
function menu(w, id){ tap(w, `[data-menu="${id}"]`); }
function size(w, id){ tap(w, `[data-size="${id}"]`); }
/* เลือกน้ำผึ้ง (ขั้นน้ำผึ้งต้องแสดงอยู่แล้ว) · คืน false ถ้ายังไม่มีขั้นน้ำผึ้ง */
function honey(w, id = 'normal'){ if(!q(w, `[data-honey="${id}"]`)) return false; tap(w, `[data-honey="${id}"]`); return true; }
/* เพิ่มลงออเดอร์: เลือกน้ำผึ้งให้ถ้ายังไม่เลือก แล้วกดปุ่มหลัก
   คืน true = เพิ่มแล้ว · false = มีหน้าต่างถาม (ท็อปปิ้งฟรีไม่ครบ / 69 แพงกว่า) ให้เทสต์ตอบเอง หรือยังขาดขั้นอื่น */
function finish(w, hon = 'normal'){
  if(modal(w)) return false;
  if(!w.eval('sel.menu')) return true;
  if(q(w, '[data-honey]') && !q(w, '.hon.on')) tap(w, `[data-honey="${hon}"]`);
  if(off(w)) return false;
  tap(w, '#btnAdd');
  return !w.eval('sel.menu');
}
module.exports = {menu, size, honey, finish, off};
