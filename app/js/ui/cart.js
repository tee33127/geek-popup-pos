/* ---------- Cart ---------- */
let cart = [];
/* โปรโมชันของบิลนี้ (1 บิล 1 โปร) {id, key, top} · ยอดลดคำนวณใหม่ทุกครั้งจากตะกร้า */
let promo = null;
const cartGross = () => cart.reduce((s, i) => s + i.unit * i.qty, 0);
const promoNow = () => promo && PROMO[promo.id] ? promoEval(PROMO[promo.id], cart, promo) : null;
const cartTotal = () => { const r = promoNow(); return cartGross() - (r && r.ok ? r.discount : 0); };
let cartFlash = null;   // key ของรายการที่เพิ่งเพิ่ม → ไฮไลต์สีอ่อนจางหายใน 1 วินาที (addSel ตั้งค่า)

/* กล่องออเดอร์ยุบ/ขยาย (Tee 2026-10-15 · แนวนอนเท่านั้น คุมด้วย CSS @media แนวตั้งคงแบบเดิม)
   ปกติ (ยังไม่เลือกเมนู) = กล่องเต็ม · เลือกเมนูแล้ว (body.picking) = แถบแคบด้านขวา "จำนวน× ชื่อ ราคา" + ยอดรวม ไม่มีปุ่ม หน้าเลือกเมนูกว้างขึ้น
   แตะแถบ = กล่องเต็มแบบ overlay ทับหน้าเลือกเมนู (body.cartopen) คอลัมน์ไม่เปลี่ยน ตารางท็อปปิ้งจึงไม่จัดแถวใหม่ · "กลับไปเลือกต่อ" = ยุบกลับ
   แก้วที่ทำค้างไม่หาย (sel ไม่ถูกแตะ) · เพิ่มลงออเดอร์ / ชำระเงินเสร็จ / ล้างออเดอร์ = backToMenu() กลับสถานะปกติ */
let cartOpen = false;
function cartMode(){
  const picking = !!(sel && sel.menu); if(!picking) cartOpen = false;
  document.body.classList.toggle('picking', picking);
  document.body.classList.toggle('cartopen', cartOpen);
}
function openCart(){ cartOpen = true; cartMode(); }
function closeCart(){ cartOpen = false; cartMode(); }

function renderCart(){
  if(!cart.length) $('cart').innerHTML = '<div class="empty">ยังไม่มีรายการ<br>เลือกเมนูได้เลย</div>';
  else $('cart').innerHTML = cart.map((i, idx) => `
    <div class="line ${i.key && i.key === cartFlash ? 'justadded' : ''}">
      <div class="t"><span>${esc(itemTitle(i))}</span><span>${baht(i.unit * i.qty)}</span></div>
      <div class="d">${itemLines(i).map(esc).join('<br>')}</div>
      <div class="qty">
        <button data-m="${idx}">−</button><b>${i.qty}</b><button data-p="${idx}">+</button>
        <button class="rm" data-r="${idx}" aria-label="ลบรายการ" title="ลบรายการ">${icon('trash', 22)}</button>
      </div>
    </div>`).join('');
  if(cartFlash) setTimeout(() => document.querySelectorAll('#cart .line.justadded').forEach(l => l.classList.remove('justadded')), 1100);   // เอา class ออก ไม่งั้นไฮไลต์เล่นซ้ำตอนกล่องกลับมาแสดง (ยุบ → overlay)
  cartFlash = null;
  renderPromoBox();
  const t = cartTotal(), n = cart.reduce((s, i) => s + i.qty, 0);
  $('cartMini').innerHTML = `<span class="cm-h">ออเดอร์</span>` + (cart.length
    ? `<span class="cm-list">${cart.map(i => `<span class="cm-ln"><span>${i.qty}× ${esc(itemTitle(i))}</span><b>${baht(i.unit * i.qty)}</b></span>`).join('')}</span>`
    : `<span class="cm-empty">ยังไม่มีรายการ</span>`) + `<span class="cm-tot"><span>รวม</span><b>${baht(t)}</b></span>`;
  $('total').textContent = baht(t); $('barTotal').textContent = baht(t); $('barCount').textContent = n + ' รายการ';
  $('btnPay').disabled = $('btnPay2').disabled = !cart.length;
  $('btnClear').disabled = !cart.length;
}
$('cart').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('p')) cart[el.dataset.p].qty++;
  else if(el = g('m')){ const i = cart[el.dataset.m]; i.qty--; if(i.qty <= 0) cart.splice(el.dataset.m, 1); }
  else if(el = g('r')) cart.splice(el.dataset.r, 1);
  else return;
  renderCart();
};
$('cartMini').onclick = openCart;
$('cartBack').onclick = $('cartShade').onclick = closeCart;
$('btnClear').onclick = () => {
  if(!cart.length) return;
  askConfirm({msg:'ล้างออเดอร์ทั้งหมด?', yes:'ล้างออเดอร์', onYes:() => { cart = []; promo = null; backToMenu(); renderCart(); toast('ล้างออเดอร์แล้ว'); }});
};
