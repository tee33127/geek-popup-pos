/* ---------- Payment ---------- */
/* ไม่เลือกอะไรไว้ก่อน · ต้องเลือกกินเลย/กลับบ้านก่อน ปุ่มวิธีชำระเงินจึงจะกดได้ */
let pay = {dining:null, method:null, received:0}, lastSale = null;
function openPay(){ if(!cart.length || !needUser()) return; pay = {dining:null, method:null, received:0}; renderPay(); }
function renderPay(){
  const total = cartTotal(), change = pay.received - total;
  const cashOk = pay.method !== 'cash' || pay.received >= total;
  const ok = !!pay.dining && !!pay.method && cashOk;
  const hadFocus = document.activeElement && document.activeElement.id === 'recv';
  const pr = promoNow();
  let h = `<h3>ชำระเงิน · ${baht(total)}</h3>${pr && pr.ok ? `<p class="note2" style="margin:-6px 0 8px">${icon('tag', 16)} หักโปร ${esc(PROMO[promo.id].name)} -${baht(pr.discount)} แล้ว</p>` : ''}
    <div class="q2">รับที่ร้านหรือกลับบ้าน?</div>
    <div class="row">${CONFIG.dining.map(d => `<button class="opt ${pay.dining === d.id ? 'on':''}" data-dine="${d.id}">${esc(d.name)}</button>`).join('')}</div>
    <div class="q2">วิธีชำระเงิน${pay.dining ? '' : ' <small>(เลือกกินเลย / กลับบ้านก่อน)</small>'}</div>
    <div class="row wrap">${CONFIG.methods.map(x => `<button class="opt ${pay.method === x.id ? 'on':''}" data-method="${x.id}" ${pay.dining ? '' : 'disabled'}>${x.logo ? `<img class="mlogo" src="${x.logo}" alt="">` : `<span class="mlogo">${icon(x.icon, 36)}</span>`}<span>${esc(x.name)}</span></button>`).join('')}</div>`;
  if(!pay.method){ /* ยังไม่เลือกวิธีชำระ: ไม่แสดงส่วนรับเงิน */ }
  else if(pay.method === 'cash'){
    h += `<div class="quick"><button data-q="${total}">พอดี</button>${[20,50,100,500,1000].map(v => `<button data-q="${v}">${v}</button>`).join('')}</div>
      <input class="num" id="recv" inputmode="numeric" pattern="[0-9]*" data-digits placeholder="รับเงินมา" value="${pay.received || ''}">
      <div class="change">${pay.received ? (change >= 0 ? 'เงินทอน ' + baht(change) : '<span style="color:var(--bad)">ยังขาด ' + baht(-change) + '</span>') : '&nbsp;'}</div>`;
  } else if(pay.method === 'promptpay' && SETTINGS.promptpay && !PP.problem(SETTINGS.promptpay)){
    h += `<div class="ppqr">${qrSvg(PP.payload(SETTINGS.promptpay, total), 220)}
      <div class="ppamt">${baht(total)}</div>
      <p class="note2">ให้ลูกค้าสแกน แล้ว<b>ดูสลิปว่ายอด ${baht(total)} โอนสำเร็จ</b> จึงกดยืนยัน</p></div>`;
  } else {
    if(pay.method === 'promptpay') h += `<div class="ppwarn">${icon('alert', 18)} ยังไม่ได้ตั้งเลข PromptPay จึงแสดง QR ไม่ได้ · เจ้าของร้านตั้งได้ที่ ตั้งค่า</div>`;
    h += `<p style="color:var(--mute);margin:14px 0">ตรวจสอบว่ายอด <b>${baht(total)}</b> ผ่านเรียบร้อย (${esc(METHOD[pay.method].name)}) แล้วจึงกดยืนยัน</p>`;
  }
  h += `<div class="row payrow"><button class="ghost" id="payCancel">ยกเลิก</button>
    <button class="pay" id="payOk" ${ok ? '' : 'disabled'}>${ok ? 'ยืนยันการชำระเงิน' : !pay.dining ? 'เลือกกินเลย / กลับบ้านก่อน' : !pay.method ? 'เลือกวิธีชำระเงินก่อน' : 'รับเงินยังไม่ครบ'}</button></div>`;
  openModal(h);
  const r = $('recv');
  if(r){
    r.oninput = () => { pay.received = Number(r.value.replace(/\D/g, '')) || 0; renderPay(); const n = $('recv'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    if(hadFocus){ r.focus(); r.setSelectionRange(r.value.length, r.value.length); }
  }
}
function confirmPay(){
  if(!pay.dining || !pay.method || !cart.length) return;
  if(STORE_MODE === 'loading'){ toast('กำลังโหลดข้อมูล รอสักครู่แล้วกดอีกครั้ง'); return; }
  if(pay.method === 'cash' && pay.received < cartTotal()) return;   // ปุ่มกดไม่ได้อยู่แล้ว กันเรียกโค้ดตรง
  if(!needUser()) return;
  const total = cartTotal(), now = new Date(), sales = loadSales(), biz = bizDate(now), pr = promoNow();
  const no = (sales.filter(s => s.date === biz).length % 999) + 1;
  const sale = {
    id: now.getTime(), no, date: biz, ts: now.toISOString(), dining: pay.dining,
    items: cart.map(i => ({menu:i.menu, name:i.name, sizeName:i.sizeName, tops:i.tops, ...(i.honey !== undefined && {honey:i.honey}), note:i.note, unit:i.unit, qty:i.qty, ...(i.sep && {sep:i.sep}), ...(i.fewTops !== undefined && {fewTops:i.fewTops})})),
    total, method: pay.method, received: pay.method === 'cash' ? pay.received : total,
    change: pay.method === 'cash' ? pay.received - total : 0, void:false,
    staff: USER.name, staffId: USER.id,   // คนกดออเดอร์ (พิมพ์ในใบเสร็จ)
    ...(pr && pr.ok && {promo:{id:promo.id, name:PROMO[promo.id].name, discount:pr.discount, detail:pr.detail}})   // บันทึกการใช้โปรทุกครั้ง
  };
  sales.push(sale);
  if(!saveSales(sales)) return;
  lastSale = sale; cart = []; promo = null; pay = {dining:null, method:null, received:0}; renderCart(); updateNext();
  openModal(`<div class="big">${icon('checkCircle', 64)}</div>
    <h3 style="text-align:center">ออเดอร์ #${pad(no, 3)} · ${DINE[sale.dining].name}</h3>
    ${sale.method === 'cash' ? `<div class="change">เงินทอน ${baht(sale.change)}</div>` : `<div class="change" style="color:var(--blue)">ชำระด้วย ${esc(METHOD[sale.method].name)} แล้ว</div>`}
    <button class="pay" id="nextOrder">ออเดอร์ถัดไป</button>
    ${CONFIG.autoPrint ? `<button class="linkbtn" id="prBoth">${icon('printer', 16)} กระดาษไม่ออก? พิมพ์อีกครั้ง</button>` : ''}`);
  if(CONFIG.autoPrint) printSale(sale, 'both');   // ใบเสร็จ + ตั๋วครัวทุกบิล พนักงานไม่ต้องกดอะไร
}
$('btnPay').onclick = $('btnPay2').onclick = openPay;
