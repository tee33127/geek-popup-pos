/* ---------- Payment ---------- */
/* ไม่เลือกอะไรไว้ก่อน · ต้องเลือกกินเลย/กลับบ้านก่อน ปุ่มวิธีชำระเงินจึงจะกดได้ */
let pay = {dining:null, method:null, received:0}, lastSale = null;
function openPay(){
  if(!cart.length || !needUser()) return;
  if(sel.menu) return askPendingCup();   // กันแก้วหาย: เลือกเมนูแล้วแต่ยังไม่เพิ่ม
  pay = {dining:null, method:null, received:0}; renderPay();
}
/* กด "ชำระเงิน" ตอนยังมีแก้วเลือกค้าง (Tee 2026-10-15) · ปุ่มหลัก = กลับไปเพิ่มก่อน · ปุ่มรอง = ทิ้งแก้วนี้ แล้วชำระเงิน */
function askPendingCup(){
  const m = curMenu(), P = priceSel(), s = m.sizes && m.sizes.find(x => x.id === sel.size);
  openModal(`<h3 class="warn">${icon('alert', 22)} แก้วที่กำลังเลือกยังไม่ได้เพิ่มลงออเดอร์</h3>
    <p style="color:var(--mute);margin:0 0 10px">${esc(m.name)}${s ? ' ' + esc(s.name) : ''}${m.sizes && !s ? '' : ' · ' + baht(P.unit)} · ถ้าชำระเงินตอนนี้ แก้วนี้จะไม่อยู่ในบิล</p>
    <button class="pay" id="pendBack">กลับไปเพิ่มก่อน</button>
    <button class="ghost wide" id="pendDrop">ทิ้งแก้วนี้ แล้วชำระเงิน</button>`, {key:'pending'});
}
/* หน้าต่างชำระเงิน (Tee 2026-10-18 เครื่องจริง): 2 คอลัมน์ ไม่ต้องเลื่อนทุกจอ · แนวตั้งเรียงซ้อน (ซ้ายบน ขวาล่าง)
   ซ้าย = กินเลย/กลับบ้าน → วิธีชำระ → (เงินสด) ช่องรับเงินมา + × ล้างในช่อง → ปุ่มเงินด่วน → เงินทอนตัวใหญ่
   ขวา = ยอดตัวใหญ่ (จุดเดียวในหน้าต่าง · ทุกวิธีที่เดียวกัน ไม่ขยับตอนสลับ · Tee 2026-10-18) แล้วตามด้วย
         เงินสด: แป้น 4×3 · PromptPay: QR (ขนาดตามที่เหลือ ≥ 200px) → ข้อความสั้น · อื่นๆ: ข้อความ
   หัวหน้าต่าง "ชำระเงิน" ไม่มียอด
   ล่างติดหน้าต่าง: [ยกเลิก] [ยืนยันรับเงิน ฿x / สิ่งที่ยังขาด] · แสดงผลอย่างเดียว การคิดเงินเหมือนเดิม */
function renderPay(){
  const total = cartTotal(), change = pay.received - total;
  const cashOk = pay.method !== 'cash' || pay.received >= total;
  const ok = !!pay.dining && !!pay.method && cashOk;
  const hadFocus = document.activeElement && document.activeElement.id === 'recv';
  const pr = promoNow();
  let L = `${pr && pr.ok ? `<p class="note2" style="margin:0 0 var(--s2)">${icon('tag', 16)} หักโปร ${esc(PROMO[promo.id].name)} -${baht(pr.discount)} แล้ว</p>` : ''}
    <div class="q2" style="margin-top:0">รับที่ร้านหรือกลับบ้าน?</div>
    <div class="row">${CONFIG.dining.map(d => `<button class="opt ${pay.dining === d.id ? 'on':''}" data-dine="${d.id}">${esc(d.name)}</button>`).join('')}</div>
    <div class="q2">วิธีชำระเงิน${pay.dining ? '' : ' <small>(เลือกกินเลย / กลับบ้านก่อน)</small>'}</div>
    <div class="row">${CONFIG.methods.map(x => `<button class="opt ${pay.method === x.id ? 'on':''}" data-method="${x.id}" ${pay.dining ? '' : 'disabled'}>${x.logo ? `<img class="mlogo" src="${x.logo}" alt="">` : `<span class="mlogo">${icon(x.icon, 36)}</span>`}<span>${esc(x.name)}</span></button>`).join('')}</div>`;
  let R = '', cls = '';
  const hint = sub => `<p class="note2 payhint">${sub}</p>`;
  if(!pay.method) R = hint(pay.dining ? 'เลือกวิธีชำระเงินทางซ้าย' : 'เลือกกินเลย / กลับบ้าน แล้วเลือกวิธีชำระเงิน');
  else if(pay.method === 'cash'){
    cls = 'cash';
    L += `<label class="recvrow"><span>รับเงินมา</span><span class="mfield">${moneyField('recv', pay.received || '', true)}${pay.received ? `<button type="button" class="mx mfx" data-mk="clear" aria-label="ล้างช่องรับเงิน">${icon('x', 22)}</button>` : ''}</span></label>
      <div class="quick"><button data-q="${total}">พอดี</button>${[20,50,100,500,1000].map(v => `<button data-q="${v}">${v}</button>`).join('')}</div>
      <div class="change">${pay.received ? (change >= 0 ? 'เงินทอน ' + baht(change) : '<span style="color:var(--bad)">ยังขาด ' + baht(-change) + '</span>') : '&nbsp;'}</div>`;
    R = moneyPadHtml(false);
  } else if(pay.method === 'promptpay' && SETTINGS.promptpay && !PP.problem(SETTINGS.promptpay)){
    cls = 'qr';
    R = `<div class="ppqr">${qrSvg(PP.payload(SETTINGS.promptpay, total), 200)}
      <p class="note2 payhint">ให้ลูกค้าสแกน แล้ว<b>ดูสลิปว่ายอดนี้โอนสำเร็จ</b> จึงกดยืนยัน</p></div>`;
  } else {
    R = (pay.method === 'promptpay' ? `<div class="ppwarn">${icon('alert', 18)} ยังไม่ได้ตั้งเลข PromptPay จึงแสดง QR ไม่ได้ · เจ้าของร้านตั้งได้ที่ ตั้งค่า</div>` : '') +
      hint(`ตรวจสอบว่ายอดนี้ผ่านเรียบร้อย (${esc(METHOD[pay.method].name)}) แล้วจึงกดยืนยัน`);
  }
  const h = `<div class="paygrid ${cls}"><div class="payamt"><small>ยอดที่ต้องรับ</small><b class="ppamt">${baht(total)}</b></div><div class="payl">${L}</div><div class="payr">${R}</div></div>`;
  const foot = `<div class="row payrow"><button class="ghost" id="payCancel">ยกเลิก</button>
    <button class="pay" id="payOk" ${ok ? '' : 'disabled'}>${ok ? `ยืนยันรับเงิน ${baht(total)}` : !pay.dining ? 'เลือกกินเลย / กลับบ้านก่อน' : !pay.method ? 'เลือกวิธีชำระเงินก่อน' : 'รับเงินยังไม่ครบ'}</button></div>`;
  openModal(h, {title:'ชำระเงิน', key:'pay', foot, cls:'paybox'});   // X = ยกเลิก
  fitPayQr();
  const r = $('recv');
  if(r){
    r.oninput = () => { pay.received = Number(r.value.replace(/\D/g, '')) || 0; renderPay(); const n = $('recv'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    if(hadFocus){ r.focus(); r.setSelectionRange(r.value.length, r.value.length); }
  }
}
/* QR โตเท่าที่ที่เหลือในหน้าต่าง (ไม่เกิน 360 · ไม่ต่ำกว่า 200 ให้สแกนได้) ไม่ดันอะไรตกจอ · เริ่มที่ 360 แล้วลดเท่าที่ล้น */
const PAY_QR = {min:200, max:360};
function fitPayQr(){
  const q = document.querySelector('#modal .paybox svg.qr'), mb = document.querySelector('#modal .mbody'); if(!q || !mb) return;
  const set = s => { q.setAttribute('width', s); q.setAttribute('height', s); };
  set(PAY_QR.max);
  const over = mb.scrollHeight - mb.clientHeight;
  if(over > 0) set(Math.max(PAY_QR.min, Math.floor(PAY_QR.max - over)));
}
window.addEventListener('resize', fitPayQr);
function confirmPay(){
  if(!pay.dining || !pay.method || !cart.length) return;
  if(STORE_MODE === 'loading'){ toast('กำลังโหลดข้อมูล รอสักครู่แล้วกดอีกครั้ง'); return; }
  if(pay.method === 'cash' && pay.received < cartTotal()) return;   // ปุ่มกดไม่ได้อยู่แล้ว กันเรียกโค้ดตรง
  if(!tabCanSell()){ if(TAB_STATE === 'wait') toast('กำลังตรวจว่าแอปเปิดซ้อนอีกหน้าไหม รอสักครู่แล้วกดอีกครั้ง'); else showTabLock(); return; }   // ขายได้ทีละหน้า (tablock.js)
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
    ${sale.method === 'cash' && drawerOn() ? drawerLine() : ''}
    ${doneHtml(sale)}`);
  /* บันทึกบิลแล้วจึงพิมพ์ (ไม่รอ UI ไม่ค้าง) · ตั๋วครัวทุกบิล · ใบเสร็จตามตั้งค่า (Tee 2026-10-17)
     เงินสด: เปิดลิ้นชักก่อน (ต่อคิวก่อนตั๋วครัว · Tee 2026-10-23) · ครั้งเดียวต่อบิล พิมพ์ซ้ำ/ใบแทนไม่เปิดอีก */
  saleDrawer(sale);
  printSale(sale, receiptMode() === 'all' ? 'both' : 'kitchen');
}
$('btnPay').onclick = $('btnPay2').onclick = openPay;
