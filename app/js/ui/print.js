/* ---------- Print: ใบเสร็จลูกค้า + ตั๋วครัว ---------- */
function receiptHtml(s){
  const lines = s.items.map(i =>
    `<div class="r"><span>${esc(itemTitle(i))}${i.qty > 1 ? ' ×' + i.qty : ''}</span><span>${i.unit * i.qty}</span></div>` +
    itemLines(i, true).map(l => `<div class="sm">${esc(l)}</div>`).join('')).join('');
  return `<div class="slip">
    <div class="c b lg">${esc(CONFIG.shopName)}</div><div class="c">${esc(CONFIG.shopSub)}</div><hr>
    <div class="r b"><span>ออเดอร์ #${esc(pad(s.no, 3))}</span><span>${esc(DINE[s.dining].name)}</span></div>
    <div>${fmtDT(s.ts)}</div>${s.staff ? `<div>พนักงาน: ${esc(s.staff)}</div>` : ''}${s.void ? '<div class="c b">*** ยกเลิกบิล ***</div>' : ''}<hr>
    ${lines}<hr>
    ${s.promo ? `<div class="r b"><span>โปร: ${esc(s.promo.name)}</span><span>-${baht(s.promo.discount)}</span></div><div class="sm">${esc(s.promo.detail)}</div>` : ''}
    <div class="r b lg"><span>รวม</span><span>${baht(s.total)}</span></div>
    <div class="r"><span>ชำระด้วย</span><span>${esc(METHOD[s.method].name)}</span></div>
    ${s.method === 'cash' ? `<div class="r"><span>รับเงิน</span><span>${baht(s.received)}</span></div><div class="r"><span>เงินทอน</span><span>${baht(s.change)}</span></div>` : ''}
    <hr><div class="c">ขอบคุณที่อุดหนุนครับ/ค่ะ</div></div>`;
}
function kitchenHtml(s){
  const items = s.items.map(i => {
    let l = i.sep ? '<div class="kl"><b>** แยกท็อปปิ้ง ใส่ถ้วยแยก **</b></div>' : '';
    if(i.tops.length) printTops(i).forEach(t => { l += t.removed ? `<div class="kl"><b>- ไม่รับ ${esc(topName(t.name))}</b></div>` : t.add ? `<div class="kl"><b>+ เพิ่ม ${esc(topName(t.name))}${t.n > 1 ? ` ×${t.n}` : ''}</b></div>` : `<div class="kl">- ${esc(topName(t.name))}${t.n > 1 ? ` <b>×${t.n}</b>` : ''}${t.from ? ` <b>(เปลี่ยนจาก ${esc(topName(t.from))})</b>` : ''}${t.extra ? ` (+${t.extra})` : ''}</div>`; });
    else if(i.menu === 'greek') l += '<div class="kl">- ไม่มีท็อปปิ้ง</div>';
    if(i.fewTops !== undefined) l += `<div class="kl"><b>** ${i.fewTops ? `ลูกค้าเลือก ${i.fewTops} อย่าง` : 'ลูกค้าไม่เอาท็อปปิ้งฟรี'} · ตักปริมาณปกติ **</b></div>`;
    if(i.honey !== undefined) l += `<div class="kl">น้ำผึ้ง: <b>${esc(HONEY[i.honey].name)}</b></div>`;
    if(i.note) l += `<div class="kl"><b>หมายเหตุ: ${esc(i.note)}</b></div>`;
    return `<div class="kt">${i.qty} × ${esc(itemTitle(i))}</div>${l}`;
  }).join('');
  return `<div class="slip">
    <div class="no">#${esc(pad(s.no, 3))}</div>
    <div class="dine">${esc(DINE[s.dining].name)}</div>
    <div class="c">${fmtDT(s.ts)}</div>${s.void ? '<div class="c b">*** ยกเลิกบิล ***</div>' : ''}<hr>${items}</div>`;
}
/* ---------- ตั๋วแบบบล็อก สำหรับ renderSlip (พิมพ์ตรงผ่าน USB) · เนื้อหาเดียวกับ receiptHtml / kitchenHtml ---------- */
function receiptBlocks(s){
  const b = [{text:CONFIG.shopName, size:32, bold:true, align:'center'}, {text:CONFIG.shopSub, align:'center'}, {rule:'dash'},
    {left:`ออเดอร์ #${pad(s.no, 3)}`, right:DINE[s.dining].name, bold:true}, {text:fmtDT(s.ts)}];
  if(s.staff) b.push({text:'พนักงาน: ' + s.staff});
  if(s.void) b.push({text:'*** ยกเลิกบิล ***', bold:true, align:'center'});
  b.push({rule:'dash'});
  s.items.forEach(i => {
    b.push({left:itemTitle(i) + (i.qty > 1 ? ' ×' + i.qty : ''), right:String(i.unit * i.qty)});
    itemLines(i, true).forEach(l => b.push({text:'  ' + l, size:22}));
  });
  b.push({rule:'dash'});
  if(s.promo) b.push({left:'โปร: ' + s.promo.name, right:'-' + baht(s.promo.discount), bold:true}, {text:'  ' + s.promo.detail, size:22});
  b.push({left:'รวม', right:baht(s.total), size:32, bold:true}, {left:'ชำระด้วย', right:METHOD[s.method].name});
  if(s.method === 'cash') b.push({left:'รับเงิน', right:baht(s.received)}, {left:'เงินทอน', right:baht(s.change)});
  b.push({rule:'dash'}, {text:'ขอบคุณที่อุดหนุนครับ/ค่ะ', align:'center'});
  return b;
}
function kitchenBlocks(s){
  const b = [{text:'#' + pad(s.no, 3), size:110, bold:true, align:'center'}, {text:DINE[s.dining].name, size:52, bold:true, align:'center', invert:true},
    {text:fmtDT(s.ts), align:'center'}];
  if(s.void) b.push({text:'*** ยกเลิกบิล ***', bold:true, align:'center'});
  b.push({rule:'dash'});
  s.items.forEach((i, k) => {
    if(k) b.push({gap:8});
    b.push({text:`${i.qty} × ${itemTitle(i)}`, size:34, bold:true});
    if(i.sep) b.push({text:'  ** แยกท็อปปิ้ง ใส่ถ้วยแยก **', bold:true});
    if(i.tops.length) printTops(i).forEach(t => b.push(t.removed ? {text:`  - ไม่รับ ${topName(t.name)}`, bold:true}
      : t.add ? {text:`  + เพิ่ม ${topName(t.name)}${t.n > 1 ? ` ×${t.n}` : ''}`, bold:true}
      : {text:`  - ${topName(t.name)}${t.n > 1 ? ` ×${t.n}` : ''}${t.from ? ` (เปลี่ยนจาก ${topName(t.from)})` : ''}${t.extra ? ` (+${t.extra})` : ''}`, bold:t.n > 1 || !!t.from}));
    else if(i.menu === 'greek') b.push({text:'  - ไม่มีท็อปปิ้ง'});
    if(i.fewTops !== undefined) b.push({text:`  ** ${i.fewTops ? `ลูกค้าเลือก ${i.fewTops} อย่าง` : 'ลูกค้าไม่เอาท็อปปิ้งฟรี'} · ตักปริมาณปกติ **`, bold:true});
    if(i.honey !== undefined) b.push({text:`  น้ำผึ้ง: ${HONEY[i.honey].name}`, bold:true});
    if(i.note) b.push({text:`  หมายเหตุ: ${i.note}`, bold:true});
  });
  return b;
}
/* บิล → byte ESC/POS: แต่ละใบวาดเป็นภาพ (ภาษาไทยไม่พึ่งฟอนต์ปริ้นเตอร์) แล้วตัดกระดาษ */
function slipBytes(blockSets){
  const parts = [ESCPOS.init()];
  blockSets.forEach(bl => parts.push(canvasCmds(renderSlip(bl)), ESCPOS.cut()));
  return bytes(...parts);
}

/* ---------- พิมพ์: ปริ้นเตอร์ USB ถ้าเชื่อมอยู่ ไม่งั้นใช้หน้าพิมพ์ของระบบ (window.print) ---------- */
const usbPrinter = UsbPrinter.supported() ? new UsbPrinter() : null;
let printQueue = Promise.resolve();   // ส่งทีละงาน กันข้อมูลสองบิลปนกันเมื่อกดพิมพ์ซ้ำเร็วๆ
function printSale(s, which){
  const sets = [];
  if(which !== 'kitchen') sets.push(receiptBlocks(s));
  if(which !== 'receipt') sets.push(kitchenBlocks(s));
  return printSlips(sets, () => printHtml(s, which));
}
function printSlips(sets, fallback){
  if(!usbPrinter || !usbPrinter.connected){ if(fallback) fallback(); return Promise.resolve(false); }
  return printQueue = printQueue.then(() => usbPrinter.send(slipBytes(sets))).then(() => true, e => {
    console.warn('usb print', e);
    usbPrinter.forget(); renderPrinterBtn();
    toast('ส่งไปปริ้นเตอร์ไม่ได้ เช็กสายแล้วกดเชื่อมใหม่', 'alert');
    if(fallback) fallback();
    return false;
  });
}
function printHtml(s, which){
  let h = '';
  if(which !== 'kitchen') h += receiptHtml(s);
  if(which !== 'receipt') h += kitchenHtml(s);
  $('printArea').innerHTML = h;
  setTimeout(() => window.print(), 80);
}

/* ---------- ปุ่มปริ้นเตอร์บนแถบหัว (แสดงเฉพาะเบราว์เซอร์ที่มี WebUSB เช่น Chrome บน Android) ---------- */
function renderPrinterBtn(){
  const b = $('btnPrinter'); if(!b) return;
  if(!usbPrinter){ b.style.display = 'none'; return; }
  const ok = usbPrinter.connected;
  b.classList.toggle('off', !ok);
  b.innerHTML = icon('printer', 18) + (ok ? ' ปริ้นเตอร์พร้อม' : ' เชื่อมปริ้นเตอร์');
}
async function connectPrinter(){
  try{ await usbPrinter.request(); renderPrinterBtn(); toast('เชื่อมปริ้นเตอร์แล้ว', 'check'); }
  catch(e){
    renderPrinterBtn();
    if(e && e.name === 'NotFoundError') return;   // กดยกเลิกในหน้าต่างเลือกอุปกรณ์
    console.warn('usb connect', e);
    toast('เชื่อมปริ้นเตอร์ไม่สำเร็จ ลองถอดสายแล้วเสียบใหม่', 'alert');
  }
}
function openPrinterInfo(){
  const d = usbPrinter.dev;
  openModal(`<p style="margin:0 0 6px"><b>เชื่อมอยู่:</b> ${esc((d && d.productName) || 'ปริ้นเตอร์ USB')}</p>
    <p style="color:var(--mute);margin:0 0 6px">ใบเสร็จและตั๋วครัวจะพิมพ์ออกเครื่องนี้ทันทีหลังชำระเงิน</p>
    <div class="row"><button class="ghost" id="prOff">ยกเลิกการเชื่อม</button><button class="pay" id="prTest">พิมพ์ทดสอบ</button></div>`, {title:`${icon('printer', 22)} ปริ้นเตอร์`, key:'printer'});
}
function printTest(){
  closeModal();
  printSlips([[{text:CONFIG.shopName, size:32, bold:true, align:'center'}, {text:'ทดสอบปริ้นเตอร์', size:40, bold:true, align:'center', invert:true},
    {text:fmtDT(new Date().toISOString()), align:'center'}, {rule:'dash'}, {text:'ภาษาไทย: กี่ ปู่ ญี่ปุ่น ปั๊ม น้ำ ๑๒๓', align:'center'}]])
    .then(ok => { if(ok) toast('ส่งงานพิมพ์แล้ว', 'check'); });
}
async function disconnectPrinter(){ closeModal(); try{ await usbPrinter.close(); }catch(e){ usbPrinter.forget(); } renderPrinterBtn(); }

if(usbPrinter){
  $('btnPrinter').onclick = () => usbPrinter.connected ? openPrinterInfo() : connectPrinter();
  /* เครื่องที่เคยอนุญาตแล้ว: เชื่อมเองตอนเปิดแอปและตอนเสียบสายใหม่ พนักงานไม่ต้องกดอะไร */
  const auto = () => { if(!usbPrinter.connected) usbPrinter.reconnect().then(renderPrinterBtn, e => { console.warn('usb reconnect', e); renderPrinterBtn(); }); };
  navigator.usb.addEventListener('connect', auto);
  navigator.usb.addEventListener('disconnect', e => {
    if(e.device !== usbPrinter.dev) return;
    usbPrinter.forget(); renderPrinterBtn(); toast('ปริ้นเตอร์หลุด เสียบสายใหม่แล้วจะเชื่อมเอง', 'alert');
  });
  auto();
}
renderPrinterBtn();
