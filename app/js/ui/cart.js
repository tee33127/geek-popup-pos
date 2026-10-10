/* ---------- Cart ---------- */
let cart = [];
const cartTotal = () => cart.reduce((s, i) => s + i.unit * i.qty, 0);

function renderCart(){
  if(!cart.length) $('cart').innerHTML = '<div class="empty">ยังไม่มีรายการ<br>เลือกเมนูได้เลย</div>';
  else $('cart').innerHTML = cart.map((i, idx) => `
    <div class="line">
      <div class="t"><span>${esc(itemTitle(i))}</span><span>${baht(i.unit * i.qty)}</span></div>
      <div class="d">${itemLines(i).map(esc).join('<br>')}</div>
      <div class="qty">
        <button data-m="${idx}">−</button><b>${i.qty}</b><button data-p="${idx}">+</button>
        <button class="rm" data-r="${idx}">ลบ</button>
      </div>
    </div>`).join('');
  const t = cartTotal(), n = cart.reduce((s, i) => s + i.qty, 0);
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
$('btnClear').onclick = () => {
  if(!cart.length) return;
  askConfirm({msg:'ล้างออเดอร์ทั้งหมด?', yes:'ล้างออเดอร์', onYes:() => { cart = []; resetSel(); renderBuilder(); renderCart(); toast('ล้างออเดอร์แล้ว'); }});
};
