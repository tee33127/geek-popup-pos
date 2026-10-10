/* ---------- Payment ---------- */
let pay = {dining:null, method:'cash', received:0}, lastSale = null;
function openPay(){ if(!cart.length) return; pay = {dining:null, method:'cash', received:0}; renderPay(); }
function renderPay(){
  const total = cartTotal(), change = pay.received - total;
  const cashOk = pay.method !== 'cash' || pay.received >= total;
  const ok = !!pay.dining && cashOk;
  const hadFocus = document.activeElement && document.activeElement.id === 'recv';
  let h = `<h3>ชำระเงิน · ${baht(total)}</h3>
    <div class="q2">รับที่ร้านหรือกลับบ้าน?</div>
    <div class="row">${CONFIG.dining.map(d => `<button class="opt ${pay.dining === d.id ? 'on':''}" data-dine="${d.id}">${d.icon} ${d.name}</button>`).join('')}</div>
    <div class="q2">วิธีชำระเงิน</div>
    <div class="row wrap">${CONFIG.methods.map(x => `<button class="opt ${pay.method === x.id ? 'on':''}" data-method="${x.id}">${x.icon} ${x.name}</button>`).join('')}</div>`;
  if(pay.method === 'cash'){
    h += `<div class="quick"><button data-q="${total}">พอดี</button>${[20,50,100,500,1000].map(v => `<button data-q="${v}">${v}</button>`).join('')}</div>
      <input class="num" id="recv" inputmode="numeric" placeholder="รับเงินมา" value="${pay.received || ''}">
      <div class="change">${pay.received ? (change >= 0 ? 'เงินทอน ' + baht(change) : '<span style="color:var(--bad)">ยังขาด ' + baht(-change) + '</span>') : '&nbsp;'}</div>`;
  } else {
    h += `<p style="color:var(--mute);margin:14px 0">ตรวจสอบว่ายอด <b>${baht(total)}</b> ผ่านเรียบร้อย (${esc(METHOD[pay.method].name)}) แล้วจึงกดยืนยัน</p>`;
  }
  h += `<div class="row"><button class="ghost" id="payCancel">ยกเลิก</button>
    <button class="pay" id="payOk" ${ok ? '' : 'disabled'}>${ok ? 'ยืนยันการชำระเงิน' : (!pay.dining ? 'เลือกกินเลย / กลับบ้านก่อน' : 'รับเงินยังไม่ครบ')}</button></div>`;
  openModal(h);
  const r = $('recv');
  if(r){
    r.oninput = () => { pay.received = Number(r.value.replace(/\D/g, '')) || 0; renderPay(); const n = $('recv'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    if(hadFocus){ r.focus(); r.setSelectionRange(r.value.length, r.value.length); }
  }
}
function confirmPay(){
  if(!pay.dining) return;
  const total = cartTotal(), now = new Date(), sales = loadSales(), biz = bizDate(now);
  const no = (sales.filter(s => s.date === biz).length % 999) + 1;
  const sale = {
    id: now.getTime(), no, date: biz, ts: now.toISOString(), dining: pay.dining,
    items: cart.map(i => ({menu:i.menu, name:i.name, sizeName:i.sizeName, tops:i.tops, honey:i.honey, note:i.note, unit:i.unit, qty:i.qty})),
    total, method: pay.method, received: pay.method === 'cash' ? pay.received : total,
    change: pay.method === 'cash' ? pay.received - total : 0, void:false
  };
  sales.push(sale);
  if(!saveSales(sales)) return;
  lastSale = sale; cart = []; renderCart(); updateNext();
  openModal(`<div class="big">✅</div>
    <h3 style="text-align:center">ออเดอร์ #${pad(no, 3)} · ${DINE[sale.dining].name}</h3>
    ${sale.method === 'cash' ? `<div class="change">เงินทอน ${baht(sale.change)}</div>` : `<div class="change" style="color:var(--blue)">ชำระด้วย ${esc(METHOD[sale.method].name)} แล้ว</div>`}
    <div class="row"><button class="ghost" id="prRec">🧾 ใบเสร็จ</button><button class="ghost" id="prKit">🍳 ตั๋วครัว</button><button class="ghost" id="prBoth">🖨️ พิมพ์ทั้งสอง</button></div>
    <button class="pay" id="nextOrder">ออเดอร์ถัดไป</button>`);
  if(CONFIG.autoPrint) printSale(sale, 'both');
}
$('btnPay').onclick = $('btnPay2').onclick = openPay;
