/* ---------- Print: ใบเสร็จลูกค้า + ตั๋วครัว ----------
   เนื้อหาอยู่ที่ js/slips.js ชุดเดียว (receiptBlocks / kitchenBlocks) · HTML สำหรับ window.print สร้างจากบล็อกเดียวกัน */
const receiptHtml = s => slipHtml(receiptBlocks(s));
const kitchenHtml = s => slipHtml(kitchenBlocks(s));
/* บิล → byte ESC/POS: แต่ละใบวาดเป็นภาพ (ภาษาไทยไม่พึ่งฟอนต์ปริ้นเตอร์) แล้วตัดกระดาษ */
function slipBytes(blockSets){
  const parts = [ESCPOS.init()];
  blockSets.forEach(bl => parts.push(canvasCmds(renderSlip(bl)), ESCPOS.cut()));
  return bytes(...parts);
}

/* ---------- พิมพ์: ปริ้นเตอร์ USB ถ้าเชื่อมอยู่ ไม่งั้นใช้หน้าพิมพ์ของระบบ (window.print) ----------
   ส่งทีละงาน (ใบเสร็จ 1 งาน · ตั๋วครัว 1 งาน) ผ่านคิวเดียว กันข้อมูลสองบิลปนกัน
   ปริ้นเตอร์ไม่ตอบ (Tee 2026-10-16): งานละไม่เกิน jobTimeout() → ล้างคิว (งานที่รอทั้งหมดไม่ถูกส่ง) ปิดการเชื่อมเพื่อยกเลิกข้อมูลที่ค้างส่ง
   แล้วเชื่อมใหม่เอง · แถบแจ้งพร้อมปุ่มพิมพ์ซ้ำเฉพาะใบที่ยังไม่ออก · ข้อมูลที่ปริ้นเตอร์รับไปแล้วบางส่วนแอปล้างไม่ได้ (อาจออกมาตอนเติมกระดาษ) */
const usbPrinter = UsbPrinter.supported() ? new UsbPrinter() : null;
let printQueue = Promise.resolve();
/* เวลาหมดต่องาน: ไม่ต่ำกว่า 15 วิ · งานใหญ่คิดตามขนาด (อัตราที่วัดจริง 109,434 byte ≈ 2.1 วิ → ~52 KB/วิ) เผื่อ 3 เท่า
   ตั๋วครัวบิลยาว 5 แก้ว ≈ 141 KB ≈ 2.7 วิ จึงได้ 15 วิ ไม่โดนตัดผิด */
const PRINT_TIMEOUT = {min:15000, rate:52000, factor:3, close:3000};   // close = รอปิด/เชื่อมใหม่หลังหมดเวลา
const jobTimeout = n => Math.max(PRINT_TIMEOUT.min, Math.ceil(n / PRINT_TIMEOUT.rate * 1000 * PRINT_TIMEOUT.factor));
const STUCK_MSG = 'ปริ้นเตอร์ไม่ตอบ — เช็กกระดาษและฝาปิด แล้วกดพิมพ์ซ้ำ';
let printGen = 0;            // เพิ่มเมื่อล้างคิว · งานที่เข้าคิวก่อนหน้านั้นจะไม่ถูกส่ง
const PRINTED = new Map();   // sale.id → {receipt, kitchen}: wait = รอ/กำลังส่ง · ok = ส่งครบ · fail = ไม่ได้ส่งหรือส่งไม่ครบ · unknown = ใช้หน้าพิมพ์ของระบบ (แอปไม่รู้ผล)
const SLIP_NAME = {receipt:'ใบเสร็จ', kitchen:'ตั๋วครัว', both:'ใบเสร็จ + ตั๋วครัว'};
const missingOf = st => st.receipt === 'fail' && st.kitchen === 'fail' ? 'both' : st.receipt === 'fail' ? 'receipt' : st.kitchen === 'fail' ? 'kitchen' : null;

/* ส่ง 1 งาน · คืน true / 'timeout' / error */
function sendJob(data){
  return new Promise(done => {
    let over = false;
    const t = setTimeout(() => { if(!over){ over = true; done('timeout'); } }, jobTimeout(data.length));
    usbPrinter.send(data).then(() => { if(!over){ over = true; clearTimeout(t); done(true); } }, e => { if(!over){ over = true; clearTimeout(t); done(e || new Error('send')); } });
  });
}
const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
/* หมดเวลา: ล้างคิว → ปิดการเชื่อม (ยกเลิก transferOut ที่ค้าง ข้อมูลที่เหลือของงานนั้นไม่ถูกส่งอีก) → เชื่อมใหม่เอง
   คืน false ถ้าปิดการเชื่อมไม่สำเร็จ (ล้างไม่ได้ ต้องถอดสาย) */
async function printerStuck(){
  printGen++;
  let cleared = true;
  try{ await within(usbPrinter.close(), PRINT_TIMEOUT.close); }catch(e){ console.warn('usb close', e); cleared = false; usbPrinter.forget(); }
  if(cleared) try{ await within(usbPrinter.reconnect(), PRINT_TIMEOUT.close); }catch(e){ console.warn('usb reconnect', e); usbPrinter.forget(); }
  renderPrinterBtn();
  return cleared;
}
/* jobs = [[ชื่อใบ, บล็อก]] · st = สถานะของบิล (PRINTED) · คืน ok / timeout / error / dropped */
function printJobs(jobs, st){
  const gen = printGen;
  jobs.forEach(([k]) => { st[k] = 'wait'; });
  return printQueue = printQueue.then(async () => {
    await slipFontsReady();
    let res = 'ok';
    for(const [k, bl] of jobs){
      if(res !== 'ok' || gen !== printGen || !usbPrinter.connected){ st[k] = 'fail'; if(res === 'ok') res = 'dropped'; continue; }
      const r = await sendJob(slipBytes([bl]));
      if(r === true){ st[k] = 'ok'; continue; }
      st[k] = 'fail'; res = r === 'timeout' ? 'timeout' : 'error';
      if(res === 'error') console.warn('usb print', r);
    }
    if(res === 'timeout'){ const cleared = await printerStuck(); printFailBar(cleared); }
    else if(res === 'error'){ usbPrinter.forget(); renderPrinterBtn(); toast('ส่งไปปริ้นเตอร์ไม่ได้ เช็กสายแล้วกดเชื่อมใหม่', 'alert'); }
    return res;
  }).catch(e => { console.warn('print', e); jobs.forEach(([k]) => { if(st[k] === 'wait') st[k] = 'fail'; }); return 'error'; });
}
function printSale(s, which = 'both'){
  const st = PRINTED.get(s.id) || {}; PRINTED.set(s.id, st);
  const jobs = [];
  if(which !== 'kitchen') jobs.push(['receipt', receiptBlocks(s)]);
  if(which !== 'receipt') jobs.push(['kitchen', kitchenBlocks(s)]);
  if(!usbPrinter || !usbPrinter.connected){ jobs.forEach(([k]) => { st[k] = 'unknown'; }); printHtml(s, which); return Promise.resolve(false); }
  dropFail(s.id);
  return printJobs(jobs, st).then(res => {
    const miss = missingOf(st);
    if(res === 'error' && miss) printHtml(s, miss);   // USB ล้ม (สายหลุด) → หน้าพิมพ์ของระบบ เฉพาะใบที่ยังไม่ออก
    else if(miss) addFail(s);                          // หมดเวลา / ถูกล้างคิว → รอพนักงานกดพิมพ์ซ้ำ
    reprintLabel(s);
    return res === 'ok';
  });
}

/* ---------- พิมพ์ซ้ำ ----------
   รู้แน่ว่าใบไหนไม่ออก (ส่งครบ/ไม่ครบ ทั้งสองใบ) → พิมพ์เฉพาะใบนั้น · ไม่แน่ใจ (หน้าพิมพ์ของระบบ, ส่งครบแล้วแต่กระดาษไม่ออก, ยังส่งอยู่) → ให้เลือก */
const known = v => v === 'ok' || v === 'fail';
function reprint(s, fromDone){   // fromDone = กดจากหน้าสำเร็จหลังชำระเงิน · เลือกแล้วกลับหน้าเลือกเมนูเหมือน "ออเดอร์ถัดไป"
  const st = PRINTED.get(s.id) || {}, miss = missingOf(st);
  if(miss && known(st.receipt) && known(st.kitchen)) return printSale(s, miss);
  openModal(`<p style="color:var(--mute);margin:0 0 10px">ออเดอร์ #${esc(pad(s.no, 3))} · เลือกใบที่ยังไม่ออก</p>
    <div class="row wrap">${['receipt', 'kitchen', 'both'].map(k => `<button class="opt" data-rp="${k}" data-rpid="${s.id}"${fromDone ? ' data-rpdone="1"' : ''}>${SLIP_NAME[k]}</button>`).join('')}</div>`,
    {title:`${icon('printer', 22)} พิมพ์ซ้ำ`, key:'reprint'});
}
function reprintLabel(s){
  const b = $('prBoth'); if(!b || !lastSale || lastSale.id !== s.id) return;
  const st = PRINTED.get(s.id) || {}, miss = missingOf(st);
  b.innerHTML = icon('printer', 16) + (miss && known(st.receipt) && known(st.kitchen) ? ` ${STUCK_MSG.split(' — ')[0]} · พิมพ์ซ้ำ${SLIP_NAME[miss]}` : ' กระดาษไม่ออก? พิมพ์อีกครั้ง');
}
/* แถบแจ้งพิมพ์ไม่สำเร็จ: ค้างจนกดพิมพ์ซ้ำ (หมดเวลา 15 วิ พนักงานมักไปออเดอร์ถัดไปแล้ว ข้อความลอย 1.4 วิ ไม่พอ) */
let PRINT_FAILS = [];   // [{id, no}] บิลที่ยังมีใบไม่ออก
let printCleared = true;
function addFail(s){ if(!PRINT_FAILS.some(f => f.id === s.id)) PRINT_FAILS.push({id:s.id, no:s.no}); renderFailBar(); }
function dropFail(id){ PRINT_FAILS = PRINT_FAILS.filter(f => f.id !== id); renderFailBar(); }
function printFailBar(cleared){ printCleared = cleared; toast(STUCK_MSG, 'alert', 6000); renderFailBar(); }   // แถบอยู่บนสุดของหน้า ตอนเลื่อนลงเลือกเมนูอาจไม่เห็น ข้อความลอยจึงค้าง 6 วิ
function renderFailBar(){
  let bar = $('printFail');
  if(!PRINT_FAILS.length){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement('div'); bar.id = 'printFail'; bar.setAttribute('role', 'alert'); document.body.prepend(bar); }
  bar.innerHTML = `<span>${icon('alert', 18)} ${esc(STUCK_MSG)}${printCleared ? '' : ' · ล้างงานค้างไม่ได้ ถอดสายปริ้นเตอร์แล้วเสียบใหม่ก่อนพิมพ์ซ้ำ'}<small>ถ้ามีกระดาษครึ่งใบออกมาตอนเติมกระดาษ ทิ้งได้</small></span>` +
    PRINT_FAILS.map(f => { const st = PRINTED.get(f.id) || {}, m = missingOf(st); return `<button class="pfbtn" data-pfid="${f.id}">พิมพ์ซ้ำ #${esc(pad(f.no, 3))}${m ? ' ' + SLIP_NAME[m] : ''}</button>`; }).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pfid], [data-rp]'); if(!b) return;
  if(b.dataset.pfid){ const s = loadSales().find(x => String(x.id) === b.dataset.pfid); if(s) reprint(s); else dropFail(Number(b.dataset.pfid)); return; }
  const s = loadSales().find(x => String(x.id) === b.dataset.rpid); closeModal(); if(b.dataset.rpdone) backToMenu(); if(s) printSale(s, b.dataset.rp);
});
function printHtml(s, which){
  let h = '';
  if(which !== 'kitchen') h += receiptHtml(s);
  if(which !== 'receipt') h += kitchenHtml(s);
  $('printArea').innerHTML = h;
  slipFontsReady().then(() => setTimeout(() => window.print(), 80));
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
slipFontsReady();   // โหลดฟอนต์ตั๋วไว้ตั้งแต่เปิดแอป บิลแรกไม่ช้า
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
  if(!usbPrinter.connected) return;
  printJobs([['test', [{text:CONFIG.shopName, size:32, bold:true, align:'center'}, {box:'single', text:'ทดสอบปริ้นเตอร์', size:40, bold:true},
    {text:fmtDT(new Date().toISOString()), align:'center'}, {rule:'dash'}, {text:'ภาษาไทย: กี่ ปู่ ญี่ปุ่น ปั๊ม น้ำ ๑๒๓', align:'center'}]]], {})
    .then(res => { if(res === 'ok') toast('ส่งงานพิมพ์แล้ว', 'check'); });
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
slipFontsReady();   // โหลดฟอนต์ตั๋วไว้ตั้งแต่เปิดแอป บิลแรกไม่ช้า
