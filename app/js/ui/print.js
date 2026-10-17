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
/* เหตุที่พิมพ์ไม่ออกล่าสุด (แถบส้ม + หน้าสำเร็จ) · cover/paper = อ่านสถานะได้ก่อนส่ง (เฉพาะเครื่องที่มี bulk IN) จึงไม่ส่งงาน (Tee 2026-10-17) */
const FAIL_MSG = {stuck:STUCK_MSG, cover:'ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วกดพิมพ์ซ้ำ', paper:'กระดาษหมด — ใส่กระดาษแล้วกดพิมพ์ซ้ำ'};
const FAIL_HINT = {stuck:'เช็กกระดาษและฝาปิด แล้วกดพิมพ์ซ้ำ', cover:'ฝาปริ้นเตอร์เปิดอยู่ ปิดฝาแล้วกดพิมพ์ซ้ำ', paper:'กระดาษหมด ใส่กระดาษแล้วกดพิมพ์ซ้ำ'};
let printWhy = 'stuck', nearWarned = false;   // nearWarned = เตือนกระดาษใกล้หมดแล้ว (ครั้งเดียวต่อการเปิดแอป)
let printGen = 0;            // เพิ่มเมื่อล้างคิว · งานที่เข้าคิวก่อนหน้านั้นจะไม่ถูกส่ง
const PRINTED = new Map();   // sale.id → {receipt, kitchen}: wait = รอ/กำลังส่ง · ok = ส่งครบ · fail = ไม่ได้ส่งหรือส่งไม่ครบ · nocon = ยังไม่ได้เชื่อมปริ้นเตอร์ ไม่ได้ส่ง · unknown = ใช้หน้าพิมพ์ของระบบ (แอปไม่รู้ผล) · ไม่มีค่า = ไม่ได้สั่งพิมพ์ (ใบเสร็จโหมด "เมื่อลูกค้าขอ")
const SLIP_NAME = {receipt:'ใบเสร็จ', kitchen:'ตั๋วครัว', both:'ใบเสร็จ + ตั๋วครัว'};
const NOCON_MSG = 'ยังไม่ได้เชื่อมปริ้นเตอร์ — ตั๋วยังไม่ออก';
const notOut = v => v === 'fail' || v === 'nocon';
const missingOf = st => notOut(st.receipt) && notOut(st.kitchen) ? 'both' : notOut(st.receipt) ? 'receipt' : notOut(st.kitchen) ? 'kitchen' : null;
/* ใบเสร็จหลังชำระเงิน (Tee 2026-10-17): all = ทุกบิล (ค่าเริ่มต้น) · ask = เมื่อลูกค้าขอ (กดปุ่มพิมพ์ใบเสร็จบนหน้าสำเร็จ) · ตั๋วครัวพิมพ์เองทุกบิลเสมอ */
const receiptMode = () => SETTINGS.receiptMode === 'ask' ? 'ask' : 'all';

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
/* jobs = [[ชื่อใบ, บล็อก]] · st = สถานะของบิล (PRINTED) · คืน ok / timeout / error / dropped / cover / paper
   ก่อนงานแรกหลังเชื่อมใหม่หรือล้มกลางงาน (usbPrinter.dirty): ส่ง ESCPOS.recover ปิดคำสั่งภาพที่ค้างในเครื่อง กันตัวมั่ว (บั๊ก H23 2026-10-17)
   แล้วถามสถานะ (ถ้าเครื่องตอบได้) ฝาเปิด / กระดาษหมด = ไม่ส่งงาน บอกตรงๆ */
function printJobs(jobs, st){
  const gen = printGen;
  jobs.forEach(([k]) => { st[k] = 'wait'; });
  return printQueue = printQueue.then(async () => {
    await slipFontsReady();
    let res = 'ok';
    if(usbPrinter.connected && gen === printGen){
      if(usbPrinter.dirty){ const r = await sendJob(ESCPOS.recover(usbPrinter.dirty === 'fail')); if(r === true) usbPrinter.dirty = null; else res = r === 'timeout' ? 'timeout' : 'error'; }
      if(res === 'ok'){
        const ps = await usbPrinter.status();
        if(ps && (ps.cover || ps.paper)){
          if(st.blocked) console.warn('printer status still says', ps.cover ? 'cover open' : 'paper out', '· staff pressed reprint, sending anyway');   // บอกปัญหาไปแล้วครั้งหนึ่ง พนักงานกดซ้ำ = ส่งเลย (อ่านค่าผิดต้องไม่ทำให้พิมพ์ไม่ได้)
          else res = ps.cover ? 'cover' : 'paper';
        }
        if(ps && ps.near && !nearWarned){ nearWarned = true; toast('กระดาษใกล้หมด เตรียมม้วนใหม่ไว้', 'alert', 4000); }
      }
    }
    for(const [k, bl] of jobs){
      if(res !== 'ok' || gen !== printGen || !usbPrinter.connected){ st[k] = 'fail'; if(res === 'ok') res = 'dropped'; continue; }
      const r = await sendJob(slipBytes([bl]));
      if(r === true){ st[k] = 'ok'; continue; }
      st[k] = 'fail'; res = r === 'timeout' ? 'timeout' : 'error';
      if(res === 'error') console.warn('usb print', r);
    }
    if(res === 'timeout' || res === 'error') usbPrinter.dirty = 'fail';   // ค้าง/ขาดกลางงาน → งานถัดไปล้างก่อน + ตัดเศษใบเก่า (เชื่อมใหม่ก็ยังจำไว้)
    if(res === 'cover' || res === 'paper'){ printWhy = res; st.blocked = true; toast(FAIL_MSG[res], 'alert', 6000); }
    else if(res === 'ok') delete st.blocked;
    if(res === 'timeout'){ printWhy = 'stuck'; const cleared = await printerStuck(); printFailBar(cleared); }
    else if(res === 'error'){ usbPrinter.forget(); renderPrinterBtn(); toast('ส่งไปปริ้นเตอร์ไม่ได้ เช็กสายแล้วกดเชื่อมใหม่', 'alert'); }
    return res;
  }).catch(e => { console.warn('print', e); jobs.forEach(([k]) => { if(st[k] === 'wait') st[k] = 'fail'; }); return 'error'; });
}
/* manual = พนักงานกดเอง (ปุ่มพิมพ์) · ไม่ใช่ = พิมพ์เองหลังชำระเงิน
   ยังไม่ได้เชื่อม: พิมพ์เอง → ไม่ส่ง (nocon) บอกบนหน้าสำเร็จ + แถบส้ม ห้ามเด้งหน้าพิมพ์ของระบบ (Tee 2026-10-17)
                    กดเอง → เปิดหน้าต่างเลือกปริ้นเตอร์ แล้วพิมพ์ · เบราว์เซอร์ไม่มี WebUSB → หน้าพิมพ์ของระบบ
   ใบที่กำลังพิมพ์อยู่ (wait) ไม่สั่งซ้ำ กดรัวๆ ไม่พิมพ์ซ้อน */
function printSale(s, which = 'both', manual = false){
  const st = PRINTED.get(s.id) || {}; PRINTED.set(s.id, st);
  const want = ['receipt', 'kitchen'].filter(k => which === 'both' || which === k);
  const ks = want.filter(k => st[k] !== 'wait');
  if(!ks.length){ if(manual) toast('กำลังพิมพ์อยู่'); return Promise.resolve(false); }
  const part = ks.length === 2 ? 'both' : ks[0];
  if(!usbPrinter || !usbPrinter.connected){
    if(manual && usbPrinter) return connectPrinter().then(() => usbPrinter.connected ? printSale(s, part, true) : false);
    if(manual){ ks.forEach(k => { st[k] = 'unknown'; }); dropFail(s.id); printHtml(s, part); renderDone(s); return Promise.resolve(false); }
    ks.forEach(k => { st[k] = 'nocon'; }); if(usbPrinter) addFail(s); renderDone(s);   // ไม่มี WebUSB (เช่น iPad) = พิมพ์ตรงไม่ได้เลย บอกบนหน้าสำเร็จพอ ไม่กองในแถบส้มทุกบิล
    return Promise.resolve(false);
  }
  const jobs = ks.map(k => [k, k === 'receipt' ? receiptBlocks(s) : kitchenBlocks(s)]);
  const p = printJobs(jobs, st);   // ตั้ง wait ทันที
  dropFail(s.id); renderDone(s);
  return p.then(res => {
    if(missingOf(st)) addFail(s);   // หมดเวลา / ถูกล้างคิว / สายหลุด → แถบส้ม รอพนักงานกดพิมพ์ซ้ำ (ไม่เด้งหน้าพิมพ์ของระบบเอง)
    renderDone(s);
    return res === 'ok';
  });
}

/* ---------- พิมพ์ซ้ำ ----------
   รู้แน่ว่าใบไหนไม่ออก (ส่งครบ/ไม่ครบ ทั้งสองใบ) → พิมพ์เฉพาะใบนั้น · ไม่แน่ใจ (หน้าพิมพ์ของระบบ, ส่งครบแล้วแต่กระดาษไม่ออก, ยังส่งอยู่) → ให้เลือก */
const known = v => v === 'ok' || notOut(v) || v === undefined;   // undefined = ไม่ได้สั่งพิมพ์ (ใบเสร็จโหมดเมื่อลูกค้าขอ)
function reprint(s){
  const st = PRINTED.get(s.id) || {}, miss = missingOf(st);
  if(miss && known(st.receipt) && known(st.kitchen)) return printSale(s, miss, true);
  openModal(`<p style="color:var(--mute);margin:0 0 10px">ออเดอร์ #${esc(pad(s.no, 3))} · เลือกใบที่ยังไม่ออก</p>
    <div class="row wrap">${['receipt', 'kitchen', 'both'].map(k => `<button class="opt" data-rp="${k}" data-rpid="${s.id}">${SLIP_NAME[k]}</button>`).join('')}</div>`,
    {title:`${icon('printer', 22)} พิมพ์ซ้ำ`, key:'reprint'});
}

/* ---------- หน้าสำเร็จหลังชำระเงิน: สถานะพิมพ์ + ปุ่มพิมพ์ใบเสร็จ / พิมพ์ตั๋วครัวซ้ำ (Tee 2026-10-17) ----------
   ปุ่มอยู่ใต้ "ออเดอร์ถัดไป" ไม่บัง · ใบที่กำลังพิมพ์ ปุ่มกดไม่ได้ */
function doneHtml(s){
  const ask = receiptMode() === 'ask';
  return `<div id="prStatus" class="prstatus" role="status" aria-live="polite"></div>
    <button class="pay" id="nextOrder">ออเดอร์ถัดไป</button>
    <div class="row donebtns"><button class="${ask ? 'ghost accent' : 'ghost'}" id="prReceipt">${icon('printer', 18)} พิมพ์ใบเสร็จ</button><button class="ghost" id="prKitchen">${icon('printer', 18)} พิมพ์ตั๋วครัวซ้ำ</button></div>`;
}
function renderDone(s){
  const box = $('prStatus'); if(!box || !lastSale || lastSale.id !== s.id) return;
  const st = PRINTED.get(s.id) || {}, ks = ['kitchen', 'receipt'].filter(k => st[k] !== undefined), of = v => ks.filter(k => st[k] === v);
  const names = l => l.map(k => SLIP_NAME[k]).join(' + ');
  let h = '', cls = '';
  if(of('wait').length) h = `${icon('printer', 18)} กำลังพิมพ์${names(of('wait'))}…`;
  else if(of('nocon').length && !(usbPrinter && usbPrinter.connected)){ cls = 'warn';
    h = usbPrinter ? `<span>${icon('alert', 18)} ${esc(NOCON_MSG)}</span><button class="pfbtn" id="prConnect">${icon('printer', 18)} เชื่อมปริ้นเตอร์</button>`
      : `<span>${icon('alert', 18)} เครื่องนี้พิมพ์ตรงไม่ได้ — ตั๋วยังไม่ออก · กดปุ่มพิมพ์ด้านล่าง</span>`; }
  else if(of('fail').length || of('nocon').length){ cls = 'warn'; h = `<span>${icon('alert', 18)} ${names([...of('fail'), ...of('nocon')])}ยังไม่ออก — ${FAIL_HINT[printWhy]}</span>`; }
  else if(of('unknown').length) h = `${icon('printer', 18)} ส่งไปหน้าพิมพ์ของระบบแล้ว`;
  else if(of('ok').length){ cls = 'ok'; h = `พิมพ์แล้ว ✓ ${names(of('ok'))}`; }
  box.className = 'prstatus ' + cls; box.innerHTML = h;
  const rb = $('prReceipt'), kb = $('prKitchen');
  if(rb) rb.disabled = st.receipt === 'wait';
  if(kb) kb.disabled = st.kitchen === 'wait';
}
/* แถบแจ้งพิมพ์ไม่สำเร็จ: ค้างจนกดพิมพ์ซ้ำ (หมดเวลา 15 วิ พนักงานมักไปออเดอร์ถัดไปแล้ว ข้อความลอย 1.4 วิ ไม่พอ) */
let PRINT_FAILS = [];   // [{id, no}] บิลที่ยังมีใบไม่ออก
let printCleared = true;
function addFail(s){ if(!PRINT_FAILS.some(f => f.id === s.id)) PRINT_FAILS.push({id:s.id, no:s.no}); renderFailBar(); }
function dropFail(id){ PRINT_FAILS = PRINT_FAILS.filter(f => f.id !== id); renderFailBar(); }
function printFailBar(cleared){ printCleared = cleared; toast(STUCK_MSG, 'alert', 6000); renderFailBar(); }
const noconOnly = () => !(usbPrinter && usbPrinter.connected) && PRINT_FAILS.every(f => { const st = PRINTED.get(f.id) || {}; return st.receipt !== 'fail' && st.kitchen !== 'fail'; });   // แถบอยู่บนสุดของหน้า ตอนเลื่อนลงเลือกเมนูอาจไม่เห็น ข้อความลอยจึงค้าง 6 วิ
function renderFailBar(){
  let bar = $('printFail');
  if(!PRINT_FAILS.length){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement('div'); bar.id = 'printFail'; bar.setAttribute('role', 'alert'); document.body.prepend(bar); }
  bar.innerHTML = (noconOnly() ? `<span>${icon('alert', 18)} ${esc(NOCON_MSG)}<small>เชื่อมปริ้นเตอร์แล้วกดพิมพ์ซ้ำ</small></span>`
    : printWhy !== 'stuck' ? `<span>${icon('alert', 18)} ${esc(FAIL_MSG[printWhy])}</span>`
    : `<span>${icon('alert', 18)} ${esc(STUCK_MSG)}${printCleared ? '' : ' · ล้างงานค้างไม่ได้ ถอดสายปริ้นเตอร์แล้วเสียบใหม่ก่อนพิมพ์ซ้ำ'}<small>ตอนพิมพ์ซ้ำ เศษใบเก่าจะออกมาเป็นชิ้นสั้นก่อน ทิ้งได้</small></span>`) +
    PRINT_FAILS.map(f => { const st = PRINTED.get(f.id) || {}, m = missingOf(st); return `<button class="pfbtn" data-pfid="${f.id}">พิมพ์ซ้ำ #${esc(pad(f.no, 3))}${m ? ' ' + SLIP_NAME[m] : ''}</button>`; }).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pfid], [data-rp]'); if(!b) return;
  if(b.dataset.pfid){ const s = loadSales().find(x => String(x.id) === b.dataset.pfid); if(s) reprint(s); else dropFail(Number(b.dataset.pfid)); return; }
  const s = loadSales().find(x => String(x.id) === b.dataset.rpid); closeModal(); if(s) printSale(s, b.dataset.rp, true);
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
  if(ok) printPending();
  if(PRINT_FAILS.length) renderFailBar();
  if(typeof lastSale !== 'undefined' && lastSale) renderDone(lastSale);   // lastSale ประกาศใน pay.js (โหลดทีหลัง)
}
/* เพิ่งเชื่อมได้ ขณะหน้าสำเร็จของบิลล่าสุดยังเปิดอยู่ → พิมพ์ใบที่ยังไม่ได้ส่งเพราะไม่ได้เชื่อม (บิลเก่ากว่านั้นรอพนักงานกดจากแถบส้ม) */
function printPending(){
  if(!$('prStatus') || !lastSale) return;
  const st = PRINTED.get(lastSale.id) || {}, ks = ['receipt', 'kitchen'].filter(k => st[k] === 'nocon');
  if(ks.length) setTimeout(() => printSale(lastSale, ks.length === 2 ? 'both' : ks[0]), 0);
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
    <p style="color:var(--mute);margin:0 0 6px">ตั๋วครัว${receiptMode() === 'all' ? 'และใบเสร็จ' : ''}จะพิมพ์ออกเครื่องนี้ทันทีหลังชำระเงิน${receiptMode() === 'all' ? '' : ' · ใบเสร็จพิมพ์เมื่อลูกค้าขอ'}</p>
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
