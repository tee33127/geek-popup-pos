/* ---------- Print: ใบเสร็จลูกค้า + ตั๋วครัว ----------
   เนื้อหาอยู่ที่ js/slips.js ชุดเดียว (receiptBlocks / kitchenBlocks) · HTML สำหรับ window.print สร้างจากบล็อกเดียวกัน */
const receiptHtml = s => slipHtml(receiptBlocks(s));
const kitchenHtml = s => slipHtml(kitchenBlocks(s));
/* บิล → byte ESC/POS: แต่ละใบวาดเป็นภาพ (ภาษาไทยไม่พึ่งฟอนต์ปริ้นเตอร์) แล้วตัดกระดาษ
   เครื่องที่ตอบกลับได้ (ep2 IN): เปิด ASB ซ้ำหลัง ESC @ · ท้ายงาน GS r 1 = เครื่องตอบเมื่อพิมพ์ + ตัดจบจริง (เลิกส่งถ้าเครื่องไม่เคยตอบ) */
const printerTalks = () => !!(typeof usbPrinter !== 'undefined' && usbPrinter && usbPrinter.connected && usbPrinter.epIn != null);
function slipBytes(blockSets, talk = printerTalks()){
  const ack = ESCPOS.ack(), parts = [ESCPOS.init()];
  if(talk) parts.push(ESCPOS.asb(true));
  blockSets.forEach(bl => parts.push(...canvasBands(renderSlip(bl)), ESCPOS.cut()));
  if(talk && usbPrinter.ackMode !== 'no') parts.push(ack);
  return jobBytes(parts, ack);   // จำรอยต่อคำสั่ง: ส่ง/ถามสถานะระหว่างงานเฉพาะตรงรอยต่อ
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
/* เหตุที่พิมพ์ไม่ออกล่าสุด (แถบส้ม + หน้าสำเร็จ) · cover/paper = อ่านสถานะได้ (ep2 IN) จึงไม่ส่งงาน (Tee 2026-10-17)
   auto = อ่านสถานะได้ แอปจะพิมพ์ใบที่ขาดต่อให้เองเมื่อเครื่องพร้อม (resumePoll) · ไม่ได้ = ให้พนักงานกดพิมพ์ซ้ำ */
const FAIL_MSG = {stuck:() => STUCK_MSG, cover:a => `ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้ว${a ? 'จะพิมพ์ต่อให้' : 'กดพิมพ์ซ้ำ'}`, paper:a => `กระดาษหมด — ใส่กระดาษแล้ว${a ? 'จะพิมพ์ต่อให้' : 'กดพิมพ์ซ้ำ'}`, pause:a => `ปริ้นเตอร์หยุดกลางใบ — ${a ? 'จะพิมพ์ใบแทนให้' : 'กดพิมพ์ซ้ำ'}`,
  offline:a => `ปริ้นเตอร์ไม่พร้อม — เช็กฝาและกระดาษ${a ? ' แล้วจะพิมพ์ต่อให้' : ' แล้วกดพิมพ์ซ้ำ'}`};
const FAIL_HINT = {stuck:a => a ? 'ปิดฝา/ใส่กระดาษแล้วจะพิมพ์ต่อให้' : 'เช็กกระดาษและฝาปิด แล้วกดพิมพ์ซ้ำ', cover:a => `ฝาปริ้นเตอร์เปิดอยู่ ปิดฝาแล้ว${a ? 'จะพิมพ์ต่อให้' : 'กดพิมพ์ซ้ำ'}`, paper:a => `กระดาษหมด ใส่กระดาษแล้ว${a ? 'จะพิมพ์ต่อให้' : 'กดพิมพ์ซ้ำ'}`, pause:a => `ปริ้นเตอร์หยุดกลางใบ ${a ? 'จะพิมพ์ใบแทนให้' : 'กดพิมพ์ซ้ำ'}`,
  offline:a => `ปริ้นเตอร์ไม่พร้อม เช็กฝาและกระดาษ${a ? ' แล้วจะพิมพ์ต่อให้' : ' แล้วกดพิมพ์ซ้ำ'}`};
const STOP = ['timeout', 'cover', 'paper', 'pause', 'offline'];   // ผลที่แปลว่าปริ้นเตอร์สะดุด (พิมพ์ต่อเองได้เมื่อพร้อม)
const BLOCKS = ['cover', 'paper', 'offline'];                      // รู้สาเหตุจากสถานะ: บอกครั้งหนึ่งแล้ว พนักงานกดซ้ำ = ส่งเลย
/* แจ้งเหตุพิมพ์ไม่ออก (ข้อความเดียวกันไม่ขึ้นซ้ำใน 3 วิ: ASB กับงานพิมพ์อาจแจ้งเหตุเดียวกัน) */
let failToastAt = 0, failToastWhy = '';
function failToast(why){ if(why === failToastWhy && Date.now() - failToastAt < 3000) return; failToastWhy = why; failToastAt = Date.now(); toast(FAIL_MSG[why](canAuto()), 'alert', 6000); }
let printWhy = 'stuck', nearWarned = false;   // nearWarned = เตือนกระดาษใกล้หมดแล้ว (ครั้งเดียวต่อการเปิดแอป)
let printGen = 0;            // เพิ่มเมื่อล้างคิว · งานที่เข้าคิวก่อนหน้านั้นจะไม่ถูกส่ง
const PRINTED = new Map();   // sale.id → {receipt, kitchen}: wait = รอ/กำลังส่ง · ok = ส่งครบ · fail = ไม่ได้ส่งหรือส่งไม่ครบ · nocon = ยังไม่ได้เชื่อมปริ้นเตอร์ ไม่ได้ส่ง · unknown = ใช้หน้าพิมพ์ของระบบ (แอปไม่รู้ผล) · ไม่มีค่า = ไม่ได้สั่งพิมพ์ (ใบเสร็จโหมด "เมื่อลูกค้าขอ")
const SLIP_NAME = {receipt:'ใบเสร็จ', kitchen:'ตั๋วครัว', both:'ตั๋วครัว + ใบเสร็จ'};
const SLIP_ORDER = ['kitchen', 'receipt'];   // พิมพ์คู่กัน ตั๋วครัวก่อนเสมอ (Tee 2026-10-17) ครัวเริ่มทำได้ก่อน
const NOCON_MSG = 'ยังไม่ได้เชื่อมปริ้นเตอร์ — ตั๋วยังไม่ออก';
const notOut = v => v === 'fail' || v === 'nocon';
const missingOf = st => notOut(st.receipt) && notOut(st.kitchen) ? 'both' : notOut(st.receipt) ? 'receipt' : notOut(st.kitchen) ? 'kitchen' : null;
/* ใบเสร็จหลังชำระเงิน (Tee 2026-10-17): all = ทุกบิล (ค่าเริ่มต้น) · ask = เมื่อลูกค้าขอ (กดปุ่มพิมพ์ใบเสร็จบนหน้าสำเร็จ) · ตั๋วครัวพิมพ์เองทุกบิลเสมอ */
const receiptMode = () => SETTINGS.receiptMode === 'ask' ? 'ask' : 'all';

/* ส่ง 1 งาน · คืน true / 'timeout' / error
   ASB บอกว่าฝาเปิด/กระดาษหมดอยู่ = รู้ว่าทำไมค้าง ไม่นับหมดเวลา (ไม่ปิด USB · ปิดฝาแล้วส่งต่อแล้วหยุดเองที่ก้อนถัดไป) */
function sendJob(data, hook, ms = jobTimeout(data.length)){
  return new Promise(done => {
    let over = false, t;
    const arm = () => { t = setTimeout(() => { if(over) return; if(asbLive() && UsbPrinter.asbTrouble(usbPrinter.asb)) return arm(); over = true; done('timeout'); }, ms); };
    arm();
    usbPrinter.send(data, PRINTER.chunk, hook).then(() => { if(!over){ over = true; clearTimeout(t); done(true); } }, e => { if(!over){ over = true; clearTimeout(t); done(e || new Error('send')); } });
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
function printJobs(jobs, st, resumed, sid){   // resumed = แอปพิมพ์ต่อเอง (resumePoll) · ล้มอีกไม่ตั้ง resumeArmed (กันวน) · sid = เลขบิล (ใบทดสอบไม่มี)
  const gen = printGen;
  jobs.forEach(([k]) => { st[k] = 'wait'; });
  return printQueue = printQueue.then(async () => {
    await slipFontsReady();
    let res = 'ok', stumbleAt = 0, byStatus = false, cut = false, lastPoll = 0, estEnd = Date.now();   // byStatus = รู้ว่าสะดุดจากสถานะ (ไม่ใช่หมดเวลา/ค้าง/หลุด)
    let seq = usbPrinter.asbSeq;   // ASB: เลขครั้งที่เครื่องมีปัญหา ณ ตอนเริ่ม · เปลี่ยนระหว่างงาน = สะดุด (แม้ปิดฝาไปแล้ว เช่นเปิดแป๊บเดียว)
    const stop = why => Object.assign(new Error(why), {stumble:why});
    /* สถานะก่อนงาน / ระหว่างงาน (ไม่มี ASB): พร้อม = ยืนยันใบที่หัวพิมพ์น่าจะพิมพ์จบนานพอแล้ว · ฝาเปิด/กระดาษหมด = สะดุด (ใบที่ยังไม่ยืนยันต้องพิมพ์ใบแทน)
       มี ASB: รู้สถานะอยู่แล้ว ไม่ต้องถาม */
    const check = async () => {
      lastPoll = Date.now();
      let why;
      if(asbLive()){ why = UsbPrinter.asbTrouble(usbPrinter.asb); seq = usbPrinter.asbSeq; }
      else {
        const ps = await usbPrinter.status();
        if(!ps) return 'ok';
        if(ps.near && !nearWarned){ nearWarned = true; toast('กระดาษใกล้หมด เตรียมม้วนใหม่ไว้', 'alert', 4000); }
        why = ps.cover ? 'cover' : ps.paper ? 'paper' : null;
        if(!why) slipsConfirmed(Date.now());
      }
      if(!why) return 'ok';
      if(st.blocked){ st.override = true; plog('override', sid, why); return 'ok'; }   // บอกปัญหาไปแล้วครั้งหนึ่ง พนักงานกดซ้ำ = ส่งเลย (อ่านค่าผิดต้องไม่ทำให้พิมพ์ไม่ได้ · ไม่นับเป็นสะดุด ไม่งั้นวน)
      stumbleAt = Date.now(); byStatus = true; plog('status', sid, why);
      return why;
    };
    /* ระหว่างส่ง (หลังทุกก้อน)
       มี ASB (หลัก): เครื่องแจ้งปัญหาตั้งแต่เริ่มงาน = หยุดส่งใบนี้ · ไม่ดูก้อนค้าง (เครื่องที่ยังพิมพ์ของเก่าค้างในบัฟเฟอร์รับช้าเป็นปกติ = ต้นเหตุใบแทนเปล่า)
       ไม่มี ASB (สำรอง): ก้อนค้างนานผิดปกติ = เครื่องหยุดรับ (ยกเว้นช่วงที่เครื่องน่าจะยังพิมพ์ของเก่าอยู่) · ถามสถานะทุก PRINT_WATCH.ms (Tee 2026-10-17 · บั๊กเครื่องจริง #018) */
    const watch = async (dt, last, safe) => {
      if(asbLive()){ if(usbPrinter.asbSeq !== seq) throw stop(asbWhy()); return; }
      if(dt > PRINT_WATCH.stall){
        const from = usbPrinter.lastAck - dt;
        if(from < PRINT_EST.end){ plog('slow', sid, `${dt} ms (เครื่องยังพิมพ์ของเก่า)`); }
        else { stumbleAt = from; byStatus = false; plog('stall', sid, dt + ' ms'); throw stop('pause'); }
      }
      if(safe && canPoll() && !usbPrinter.statusMiss && Date.now() - lastPoll >= PRINT_WATCH.ms){   // ถามเฉพาะตรงรอยต่อคำสั่ง ไม่แทรกกลางภาพ · ไม่ตอบแล้ว = ไม่ถามระหว่างงาน (กันช้า)
        const r = await check(); if(r !== 'ok') throw stop(r);
      }
    };
    /* ไม่มี ASB: รอจนใบที่ส่งแล้วของบิลนี้ยืนยันว่าออก (GS r ตอบ หรือเลยเวลาพิมพ์จบที่คาด + ช่วงยืนยัน) ถามสถานะทุก PRINT_WATCH.ms · ฝาเปิด/กระดาษหมด = หยุด
       ใช้ก่อนส่งใบถัดไป (ฝาเปิดตอนใบเสร็จ ตั๋วครัวที่ยืนยันแล้วไม่พิมพ์ซ้ำ) และหลังใบสุดท้าย · อ่านสถานะไม่ได้ = ยืนยันด้วยเวลาตอนสะดุด */
    const settle = async () => {
      while(UNCONF.some(u => u.id === sid) && canPoll() && !usbPrinter.statusMiss && gen === printGen && usbPrinter.connected){
        const ackDue = usbPrinter.ackMode !== 'no' && UNCONF.some(u => u.id === sid && u.ack);   // รอคำตอบ GS r ก่อนถามสถานะ (ได้คำตอบ = ไม่ต้องถาม)
        const left = Math.max(estEnd + PRINT_CONFIRM.ms - Date.now(), ackDue ? Math.min(PRINT_WATCH.ms, 1000) : 0), until = Date.now() + Math.max(0, Math.min(PRINT_WATCH.ms - (Date.now() - lastPoll), left));
        while(Date.now() < until && UNCONF.some(u => u.id === sid)) await sleep(Math.min(5, until - Date.now()));   // GS r ตอบระหว่างรอ = ไปต่อทันที
        if(!UNCONF.some(u => u.id === sid)) break;   // GS r ตอบแล้ว = ออกแล้วจริง
        const r = await check(); if(r !== 'ok') return r;
        if(Date.now() >= estEnd + PRINT_CONFIRM.ms) break;     // ครั้งสุดท้ายหลังพ้นช่วง = ยืนยัน
      }
      return 'ok';
    };
    /* มี ASB: ก่อนส่งใบถัดไป รอใบก่อนของบิลนี้ออก · GS r ตอบ = ไปต่อทันที · ยังไม่รู้ว่าเครื่องตอบ GS r ไหม / ไม่ตอบ = เวลาพิมพ์จบที่คาด + PRINT_CONFIRM.ms (แบบเดิม)
       เครื่องตอบ GS r ได้ แต่ใบนี้ยังไม่ตอบ = รอได้ถึง PRINT_ACK.max · ASB แจ้งปัญหาระหว่างรอ = หยุด */
    const gate = async () => {
      for(;;){
        if(gen !== printGen || !usbPrinter.connected) return 'ok';
        if(usbPrinter.asbSeq !== seq) return asbWhy();
        confirmTick();
        const now = Date.now(), mine = UNCONF.filter(u => u.id === sid);
        if(!mine.length || mine.every(u => now >= u.end + (u.ack && usbPrinter.ackMode === 'yes' ? PRINT_ACK.max : PRINT_CONFIRM.ms))) return 'ok';
        await sleep(5);
      }
    };
    if(PRINT_EST.lost){ PRINT_EST.end = Math.max(PRINT_EST.end, Date.now() + PRINT_EST.lost / PRINT_WATCH.rate * 1000); PRINT_EST.lost = 0; }   // หลังสะดุด เครื่องอาจยังพิมพ์ของเก่าที่ค้างในบัฟเฟอร์
    if(usbPrinter.connected && gen === printGen){
      if(usbPrinter.dirty){
        plog('recover', sid, usbPrinter.dirty);
        const r = await sendJob(jobBytes([ESCPOS.recover(usbPrinter.dirty === 'fail'), ...(printerTalks() ? [ESCPOS.asb(true)] : [])]));
        if(r === true) usbPrinter.dirty = null; else res = r === 'timeout' ? 'timeout' : 'error';
      }
      if(res === 'ok') res = await check();
    }
    for(const [i, [k, bl]] of jobs.entries()){
      if(i && res === 'ok' && sid) res = asbLive() ? await gate() : await settle();      // ก่อนใบถัดไป: รอยืนยันใบก่อน · ฝาเปิดก็หยุดตรงนี้
      if(res !== 'ok' || gen !== printGen || !usbPrinter.connected){ st[k] = 'fail'; if(res === 'ok') res = 'dropped'; continue; }
      const data = slipBytes([bl]), t0 = Date.now();
      if(sid) (st.sent = st.sent || {})[k] = true;           // เริ่มส่งแล้ว: พิมพ์ใบนี้อีกครั้งเมื่อไร = ใบแทน
      plog('send', sid, `${k} ${data.length} B${bl[0] && bl[0].text && bl[0].text.startsWith('ใบแทน') ? ' (ใบแทน)' : ''}`);
      const r = await sendJob(data, sid ? watch : null);
      estEnd = Math.max(Date.now(), Math.max(estEnd, PRINT_EST.end, t0) + data.length / PRINT_WATCH.rate * 1000);   // หัวพิมพ์น่าจะพิมพ์ใบนี้จบเมื่อไร (ของที่ส่งก่อนต้องจบก่อน)
      PRINT_EST.end = Math.max(PRINT_EST.end, estEnd);
      const late = r === true && sid && asbLive() && usbPrinter.asbSeq !== seq;   // ส่งครบพอดีตอนเครื่องแจ้งปัญหา = ใบนี้ก็สะดุด
      if(r === true && !late){
        st[k] = 'ok';
        if(sid){ UNCONF.push({id:sid, k, at:Date.now(), end:estEnd, n:data.length, ack:data.ackSid === usbPrinter.session ? data.ackN : 0, ses:usbPrinter.session}); confirmTick(); }
        continue;
      }
      st[k] = 'fail'; cut = true;
      if(sid) (st.redo = st.redo || {})[k] = true;           // สะดุดกลางใบนี้ = ออกไปบางส่วน พิมพ์ใหม่ทั้งใบเป็นใบแทน
      PRINT_EST.lost += data.length;
      if(late){ res = asbWhy(); plog('asb → ใบแทน', sid, k); continue; }
      if(r && r.stumble){ res = r.stumble; plog('stumble → ใบแทน', sid, `${k} · ${res}`); continue; }       // ฝาเปิด / กระดาษหมด / เครื่องหยุดรับ ระหว่างส่ง
      res = r === 'timeout' ? 'timeout' : 'error';
      stumbleAt = usbPrinter.lastAck || Date.now(); byStatus = false;   // สะดุดตั้งแต่เครื่องรับก้อนสุดท้าย
      if(res === 'error') console.warn('usb print', r);
      plog(res, sid, k);
    }
    /* ส่งครบแล้ว · ไม่มี ASB: เฝ้าต่อจนหัวพิมพ์น่าจะพิมพ์จบ + ช่วงยืนยัน (ฝาเปิดตอนเครื่องพิมพ์จากบัฟเฟอร์ก็จับได้)
       มี ASB: ไม่ต้องถือคิว ยืนยันเองเมื่อ GS r ตอบ / เลยเวลา (confirmTick) · ASB แจ้งปัญหาก่อนนั้น = ใบแทน (asbChanged) */
    if(res === 'ok' && sid && !asbLive()) res = await settle();
    if(stumbleAt) slipsStumbled(stumbleAt, byStatus);        // ใบที่ส่งครบแต่ยังไม่ยืนยันว่าออก → ใบแทน (สะดุดจากสถานะ ไม่นับบิลที่พนักงานสั่งส่งทั้งที่สถานะบอกปัญหา)
    if(cut || res === 'timeout' || res === 'error') usbPrinter.dirty = 'fail';   // ค้าง/ขาดกลางงาน → งานถัดไปล้างก่อน + ป้อนแล้วตัดเศษใบเก่า (เชื่อมใหม่ก็ยังจำไว้)
    else if(STOP.includes(res) && !usbPrinter.dirty) usbPrinter.dirty = 'open';
    if(!resumed && STOP.includes(res)) resumeArmed = true;   // เครื่องพร้อมเมื่อไร พิมพ์ต่อให้ 1 ครั้ง · พิมพ์ต่อเองแล้วล้มอีก = รอเห็นเครื่องไม่พร้อมก่อน (ASB เห็นเอง)
    if(BLOCKS.includes(res) || res === 'pause'){ printWhy = res; if(res !== 'pause') st.blocked = true; failToast(res); }
    else if(res === 'ok') delete st.blocked;
    if(res === 'timeout'){ printWhy = 'stuck'; const cleared = await printerStuck(); printFailBar(cleared); }
    else if(res === 'error'){ usbPrinter.forget(); renderPrinterBtn(); toast('ส่งไปปริ้นเตอร์ไม่ได้ เช็กสายแล้วกดเชื่อมใหม่', 'alert'); }
    plog('done', sid, `${res} · ${jobs.map(([k]) => k + '=' + st[k] + (st.redo && st.redo[k] ? '(ใบแทน)' : '')).join(' ')}`);
    if(STOP.includes(res) && asbLive()) resumeKick();       // ASB บอกพร้อมแล้ว (เช่นเปิดฝาแป๊บเดียว) → พิมพ์ใบแทนทันทีหลังงานนี้
    return res;
  }).catch(e => { console.warn('print', e); jobs.forEach(([k]) => { if(st[k] === 'wait') st[k] = 'fail'; }); return 'error'; });
}
/* ---------- ใบที่สะดุดกลางคัน → พิมพ์ใหม่ทั้งใบเป็น "ใบแทน" (Tee 2026-10-17 · บั๊ก H33 เครื่องจริง) ----------
   ส่งครบ ≠ ออกแล้ว: เครื่องรับข้อมูลเข้าบัฟเฟอร์แล้วยังพิมพ์ไม่เสร็จ ถ้าฝาเปิด/หมดเวลา/สายหลุดตอนนั้น ท้ายใบหายได้ (ตั๋วครัว #017 จบที่หัวข้อ Banana Choco)
   UNCONF = ใบที่ส่งครบแต่ยังไม่ยืนยัน · ยืนยัน = อ่านสถานะได้ "พร้อม" เมื่อผ่านไป ≥ PRINT_CONFIRM.ms หลังส่งครบ
   สะดุด (หมดเวลา / ฝาเปิด / กระดาษหมด / สายหลุด) → ใบที่ยังไม่ยืนยันและส่งไม่นานก่อนจุดสะดุด = fail + redo (ใบแทน) · ใบที่ไม่สะดุดไม่พิมพ์ซ้ำ
   อ่านสถานะได้: ใบที่ยังไม่ถูกยืนยันทุกใบ (ไม่เกิน stale ms) · อ่านสถานะไม่ได้: ยืนยันด้วยเวลา (ส่งครบนานกว่า PRINT_CONFIRM.ms ก่อนจุดสะดุด = ถือว่าออกแล้ว) */
const PRINT_CONFIRM = {ms:500, stale:20000};   // ms = เผื่อหลังเวลาพิมพ์จบที่คาด (PRINT_WATCH.rate)
/* เฝ้าระหว่างพิมพ์: ถามสถานะทุก ms · ก้อน 4 KB ปกติ ~80 ms (วัดจริง 109 KB ≈ 2.1 วิ) ค้างเกิน stall ms = เครื่องหยุดรับ
   rate = ความเร็วหัวพิมพ์โดยประมาณ (byte/วิ ต่ำกว่าที่วัดได้ 52 KB/วิ เผื่อไว้) ใช้คาดว่าใบไหนพิมพ์จบเมื่อไร */
const PRINT_WATCH = {ms:300, stall:500, rate:45000};
/* GS r (Tee 2026-10-17): ใบที่ส่งครบนับว่า "ออกแล้ว" เมื่อเครื่องตอบ GS r ท้ายใบ (พิมพ์ + ตัดจบจริง ไม่ต้องเดาเวลา)
   เครื่องไม่ตอบ (ไม่รองรับ) = นับด้วยเวลาพิมพ์จบที่คาด + grace โดยระหว่างนั้น ASB ไม่แจ้งปัญหา · ไม่ตอบ 2 ใบ = เลิกส่ง GS r จนเชื่อมใหม่
   max = เครื่องเคยตอบแล้วแต่ใบนี้ยังไม่ตอบ รอได้นานสุดเท่านี้หลังเวลาที่คาด (ช้ากว่าที่คาด) */
const PRINT_ACK = {grace:3000, max:10000};
/* เวลาที่เครื่องน่าจะพิมพ์ของที่ส่งไปทั้งหมดจบ (end) · lost = byte ของใบที่สะดุด อาจยังค้างในบัฟเฟอร์รอพิมพ์ต่อหลังปิดฝา
   ใช้กับการจับก้อนค้าง (สำรองเมื่อไม่มี ASB): เครื่องยังพิมพ์ของเก่า บัฟเฟอร์เต็ม รับช้าเป็นปกติ ไม่ใช่สะดุด */
const PRINT_EST = {end:0, lost:0};
/* บันทึกการพิมพ์ (ดูได้ที่ปุ่มปริ้นเตอร์ → บันทึกการพิมพ์) ไว้ไล่ปัญหาบนเครื่องจริง · เก็บ 200 บรรทัดล่าสุดในหน่วยความจำ */
const PLOG = [];
function plog(ev, sid, msg){
  const t = new Date(), no = sid && typeof loadSales === 'function' ? (loadSales().find(x => x.id === sid) || {}).no : null;
  PLOG.push(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}.${String(t.getMilliseconds()).padStart(3, '0')} ${no ? '#' + pad(no, 3) + ' ' : ''}${ev}${msg ? ' · ' + msg : ''}`);
  if(PLOG.length > 200) PLOG.shift();
}
let UNCONF = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function slipsConfirmed(t){ UNCONF = UNCONF.filter(u => (u.end || u.at) + PRINT_CONFIRM.ms > t + 10); confirmTick(); }   // ยืนยันเมื่อเลยเวลาที่หัวพิมพ์น่าจะพิมพ์จบ + ช่วงยืนยัน · +10 ms: ตัวจับเวลาอาจมาก่อนกำหนดเล็กน้อย
/* ยืนยันใบที่ส่งครบแล้ว: GS r ตอบถึงลำดับของใบ = ออกแล้วจริง · มี ASB + เลยเวลาที่คาด + grace โดย ASB ไม่แจ้งปัญหา = นับว่าออก (เครื่องไม่ตอบ GS r)
   ไม่มี ASB: ยืนยันด้วยเวลาผ่านการถามสถานะ (slipsConfirmed) · ทำงานเองทุก 100 ms ตอนมีใบรอ + ทันทีที่ GS r ตอบ */
let confirmTimer = null;
function confirmTick(){
  if(!usbPrinter) return;
  const now = Date.now(), live = asbLive(), got = usbPrinter.ackGot, ses = usbPrinter.session;
  UNCONF = UNCONF.filter(u => {
    if(u.ack && u.ses === ses && got >= u.ack){ plog('ออกแล้ว', u.id, `${u.k} · เครื่องตอบ GS r ${now - u.at} ms หลังส่งครบ`); return false; }
    const wait = u.ack && usbPrinter.ackMode === 'yes' ? PRINT_ACK.max : PRINT_ACK.grace;
    if(live && now >= u.end + wait){
      if(u.ack && usbPrinter.ackMode !== 'yes' && ++usbPrinter.ackMiss >= 2){ usbPrinter.ackMode = 'no'; plog('GS r', null, 'เครื่องไม่ตอบ ใช้เวลาประมาณแทน'); }
      if(u.ack && u.ses === ses && usbPrinter.ackGot < u.ack) usbPrinter.ackGot = u.ack;   // คำตอบของใบนี้หาย (เครื่องทิ้งข้อมูล) → นับข้าม ใบถัดไปไม่รับคำตอบผิดใบ
      plog('ออกแล้ว', u.id, `${u.k} · นับด้วยเวลา (ASB ไม่แจ้งปัญหา)`); return false;
    }
    return true;
  });
  if(UNCONF.length && !confirmTimer) confirmTimer = setInterval(confirmTick, 100);
  else if(!UNCONF.length && confirmTimer){ clearInterval(confirmTimer); confirmTimer = null; }
}
function slipsStumbled(t, byStatus){   // byStatus = รู้จากสถานะ (ไม่ใช่หมดเวลา/หลุด) · บิลที่พนักงานสั่งส่งทั้งที่สถานะบอกปัญหา (st.override) ไม่นับ กันวน
  const hit = UNCONF.filter(u => u.at >= t - (canAuto() ? PRINT_CONFIRM.stale : PRINT_CONFIRM.ms) && !(byStatus && (PRINTED.get(u.id) || {}).override));
  UNCONF = []; confirmTick();   // ที่เก่ากว่าจุดสะดุดนานพอ = ออกแล้ว
  usbPrinter.dirty = usbPrinter.dirty || 'open';   // สะดุด = เครื่องอาจค้างกลางคำสั่ง (เช่นทิ้งบัฟเฟอร์กลางภาพ) → ล้างก่อนงานถัดไปเสมอ กันตัวมั่ว
  if(!hit.length) return 0;
  PRINT_EST.lost += hit.reduce((a, u) => a + (u.n || 0), 0);
  const all = loadSales();
  hit.forEach(u => { const st = PRINTED.get(u.id), s = all.find(x => x.id === u.id); if(!st) return; st[u.k] = 'fail'; (st.redo = st.redo || {})[u.k] = true; if(s) addFail(s); plog('stumble → ใบแทน', u.id, u.k); });
  usbPrinter.dirty = 'fail';   // ก่อนใบแทน: ล้าง + ป้อนกระดาษแล้วตัด เศษใบเก่า (รวมที่เครื่องพิมพ์ต่อจากบัฟเฟอร์) เป็นชิ้นแยก
  return hit.length;
}
/* บล็อกของใบ · ใบแทนมีกรอบบนสุด (เส้นกรอบ ไม่ใช้พื้นดำ) บอกครัว/ลูกค้าให้ทิ้งใบก่อนหน้า
   ใบแทน = ใบนี้เคยเริ่มส่งไปแล้ว (st.sent) หรือสะดุด (st.redo) · ทุกครั้งที่พิมพ์ซ้ำ ไม่ว่าแอปพิมพ์ต่อเอง กดจากแถบส้ม หน้าสำเร็จ หรือสรุปยอด
   (บั๊กเครื่องจริง #018: ใบที่พิมพ์ใหม่ไม่มีกรอบ ครัวเห็นตั๋วสองใบ · ไม่พึ่งว่าแอปจับการสะดุดได้หรือไม่) */
const redoBlock = s => ({box:'single', text:`ใบแทน — ทิ้งใบก่อนหน้าของ #${pad(s.no, 3)}`, size:28, bold:true});
const isRedo = (st, k) => !!st && !!((st.redo && st.redo[k]) || (st.sent && st.sent[k]));
function slipBlocks(s, k, st){
  const bl = k === 'receipt' ? receiptBlocks(s) : kitchenBlocks(s);
  return isRedo(st, k) ? [redoBlock(s), ...bl] : bl;
}

/* manual = พนักงานกดเอง (ปุ่มพิมพ์) · ไม่ใช่ = พิมพ์เองหลังชำระเงิน
   ยังไม่ได้เชื่อม: พิมพ์เอง → ไม่ส่ง (nocon) บอกบนหน้าสำเร็จ + แถบส้ม ห้ามเด้งหน้าพิมพ์ของระบบ (Tee 2026-10-17)
                    กดเอง → เปิดหน้าต่างเลือกปริ้นเตอร์ แล้วพิมพ์ · เบราว์เซอร์ไม่มี WebUSB → หน้าพิมพ์ของระบบ
   ใบที่กำลังพิมพ์อยู่ (wait) ไม่สั่งซ้ำ กดรัวๆ ไม่พิมพ์ซ้อน */
function printSale(s, which = 'both', manual = false, resumed = false){
  const st = PRINTED.get(s.id) || {}; PRINTED.set(s.id, st);
  const want = SLIP_ORDER.filter(k => which === 'both' || which === k);
  const ks = want.filter(k => st[k] !== 'wait');
  if(!ks.length){ if(manual) toast('กำลังพิมพ์อยู่'); return Promise.resolve(false); }
  const part = ks.length === 2 ? 'both' : ks[0];
  if(!usbPrinter || !usbPrinter.connected){
    if(manual && usbPrinter) return connectPrinter().then(() => usbPrinter.connected ? printSale(s, part, true) : false);
    if(manual){ ks.forEach(k => { st[k] = 'unknown'; }); dropFail(s.id); printHtml(s, part); renderDone(s); return Promise.resolve(false); }
    ks.forEach(k => { st[k] = 'nocon'; }); if(usbPrinter) addFail(s); renderDone(s);   // ไม่มี WebUSB (เช่น iPad) = พิมพ์ตรงไม่ได้เลย บอกบนหน้าสำเร็จพอ ไม่กองในแถบส้มทุกบิล
    return Promise.resolve(false);
  }
  const jobs = ks.map(k => [k, slipBlocks(s, k, st)]);
  const wasFail = PRINT_FAILS.some(f => f.id === s.id);
  const p = printJobs(jobs, st, resumed, s.id);   // ตั้ง wait ทันที
  dropFail(s.id); renderDone(s);
  return p.then(res => {
    if(missingOf(st)) addFail(s);   // หมดเวลา / ถูกล้างคิว / สายหลุด → แถบส้ม (พิมพ์ต่อเองเมื่อพร้อม หรือพนักงานกดพิมพ์ซ้ำ · ไม่เด้งหน้าพิมพ์ของระบบเอง)
    else if(PRINT_FAILS.some(f => f.id === s.id)) dropFail(s.id);   // ASB เคยขึ้นแถบระหว่างงาน แต่สุดท้ายออกครบ
    if(!missingOf(st) && wasFail && res === 'ok') flashOk(`พิมพ์แล้ว ✓ #${pad(s.no, 3)} ${ks.map(k => SLIP_NAME[k]).join(' + ')}`);   // ใบที่เคยค้างในแถบ ออกครบแล้ว
    renderDone(s);
    return res === 'ok';
  });
}

/* ---------- พิมพ์ซ้ำ ----------
   รู้แน่ว่าใบไหนไม่ออก (ส่งครบ/ไม่ครบ ทั้งสองใบ) → พิมพ์เฉพาะใบนั้น · ไม่แน่ใจ (หน้าพิมพ์ของระบบ, ส่งครบแล้วแต่กระดาษไม่ออก, ยังส่งอยู่) → ให้เลือก */
const known = v => v === 'ok' || notOut(v) || v === undefined;   // undefined = ไม่ได้สั่งพิมพ์ (ใบเสร็จโหมดเมื่อลูกค้าขอ)
function reprint(s){
  const st = PRINTED.get(s.id) || {}, miss = missingOf(st);
  if(st.kitchen === 'wait' || st.receipt === 'wait'){ toast('กำลังพิมพ์อยู่'); return; }   // แอปกำลังพิมพ์ต่อให้อยู่ (กดแถบพร้อมกับที่เริ่มพิมพ์เอง) → ไม่ซ้อน
  if(miss && known(st.receipt) && known(st.kitchen)) return printSale(s, miss, true);
  openModal(`<p style="color:var(--mute);margin:0 0 10px">ออเดอร์ #${esc(pad(s.no, 3))} · เลือกใบที่ยังไม่ออก</p>
    <div class="row wrap">${['kitchen', 'receipt', 'both'].map(k => `<button class="opt" data-rp="${k}" data-rpid="${s.id}">${SLIP_NAME[k]}</button>`).join('')}</div>`,
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
  const halt = asbLive() && UsbPrinter.asbTrouble(usbPrinter.asb);   // ASB: ฝาเปิด/กระดาษหมดอยู่ตอนนี้
  if(of('wait').length && halt){ cls = 'warn'; h = `<span>${icon('alert', 18)} ${names(of('wait'))}ยังไม่ออก — ${FAIL_HINT[halt](true)}</span>`; }
  else if(of('wait').length) h = `${icon('printer', 18)} กำลังพิมพ์${names(of('wait'))}…`;
  else if(of('nocon').length && !(usbPrinter && usbPrinter.connected)){ cls = 'warn';
    h = usbPrinter ? `<span>${icon('alert', 18)} ${esc(NOCON_MSG)}</span><button class="pfbtn" id="prConnect">${icon('printer', 18)} เชื่อมปริ้นเตอร์</button>`
      : `<span>${icon('alert', 18)} เครื่องนี้พิมพ์ตรงไม่ได้ — ตั๋วยังไม่ออก · กดปุ่มพิมพ์ด้านล่าง</span>`; }
  else if(of('fail').length || of('nocon').length){ cls = 'warn'; h = `<span>${icon('alert', 18)} ${names([...of('fail'), ...of('nocon')])}ยังไม่ออก — ${FAIL_HINT[printWhy](canAuto())}</span>`; }
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
  resumeWatch();
  if(!PRINT_FAILS.length){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement('div'); bar.id = 'printFail'; bar.setAttribute('role', 'alert'); document.body.prepend(bar); }
  const auto = canAuto();
  bar.innerHTML = (noconOnly() ? `<span>${icon('alert', 18)} ${esc(NOCON_MSG)}<small>เชื่อมปริ้นเตอร์แล้วกดพิมพ์ซ้ำ</small></span>`
    : printWhy !== 'stuck' ? `<span>${icon('alert', 18)} ${esc(FAIL_MSG[printWhy](auto))}<small>ตอนพิมพ์ต่อ เศษใบเก่า (ถ้ามี) จะออกมาเป็นชิ้นสั้นก่อน ทิ้งได้</small></span>`
    : `<span>${icon('alert', 18)} ${esc(STUCK_MSG)}${printCleared ? '' : ' · ล้างงานค้างไม่ได้ ถอดสายปริ้นเตอร์แล้วเสียบใหม่ก่อนพิมพ์ซ้ำ'}<small>${auto ? 'ปิดฝาหรือใส่กระดาษแล้ว แอปจะพิมพ์ใบที่ขาดให้เอง · ' : ''}เศษใบเก่าจะออกมาเป็นชิ้นสั้นก่อน ทิ้งได้</small></span>`) +
    PRINT_FAILS.map(f => { const st = PRINTED.get(f.id) || {}, m = missingOf(st); return `<button class="pfbtn" data-pfid="${f.id}">พิมพ์ซ้ำ #${esc(pad(f.no, 3))}${m ? ' ' + SLIP_NAME[m] : ''}</button>`; }).join('');
}
/* แถบเขียวสั้นๆ หลังใบที่ค้างออกครบ (พิมพ์ต่อเอง หรือกดจากแถบ) แล้วหายเอง */
let okTimer = null;
function flashOk(msg){
  let el = $('printOk');
  if(!el){ el = document.createElement('div'); el.id = 'printOk'; el.setAttribute('role', 'status'); document.body.prepend(el); }
  el.textContent = el.textContent && okTimer ? el.textContent + ' · ' + msg : msg;
  clearTimeout(okTimer); okTimer = setTimeout(() => { el.remove(); okTimer = null; }, PRINT_RESUME.okMs);
}

/* ---------- พิมพ์ใบที่ขาดต่อเองเมื่อเครื่องพร้อม (Tee 2026-10-17) ----------
   มีใบค้าง (fail) ในแถบส้ม + อ่านสถานะได้ → ถามสถานะทุก PRINT_RESUME.ms (ต่อคิวเดียวกับงานพิมพ์ ไม่ปนกัน)
   ฝาปิด + มีกระดาษ → พิมพ์เฉพาะใบที่ขาด ตั๋วครัวก่อน 1 ครั้ง (resumeArmed) · ล้มอีก = แถบเดิม ไม่วน: พิมพ์เองได้อีกเมื่อเห็นเครื่องไม่พร้อมแล้วกลับมาพร้อมเท่านั้น
   อ่านสถานะไม่ได้ (ไม่ตอบ) = หยุดถาม พนักงานกดเอง · ใบที่ส่งเข้าเครื่องครบแล้ว (ok) ไม่พิมพ์ซ้ำ · พนักงานกดแทรก = printSale ข้ามใบที่ wait ออกชุดเดียว */
const PRINT_RESUME = {ms:1000, okMs:3500};   // พร้อมแล้วพิมพ์ใบแทนต่อภายใน ~1 วิ
let resumeTimer = null, resumeArmed = false, resumeBusy = false;
const canPoll = () => !!(usbPrinter && usbPrinter.connected && usbPrinter.epIn != null && !usbPrinter.noStatus);
/* ASB ใช้ได้ในรอบการเชื่อมนี้ (เครื่องส่ง ASB มาแล้วอย่างน้อยครั้งหนึ่ง หลังเปิดตอนเชื่อม) = สัญญาณหลัก · ไม่งั้นถามสถานะ (DLE EOT) + จับก้อนค้างแบบเดิม */
const asbLive = () => !!(usbPrinter && usbPrinter.connected && usbPrinter.asbSeen);
const canAuto = () => asbLive() || canPoll();   // แอปรู้เองว่าเครื่องพร้อมเมื่อไร → พิมพ์ต่อให้เอง
let asbLastWhy = 'cover';
const asbWhy = () => UsbPrinter.asbTrouble(usbPrinter.asb) || asbLastWhy;   // เหตุที่ ASB แจ้ง (ปิดฝาไปแล้ว = เหตุล่าสุด)
const failedSlips = f => { const st = PRINTED.get(f.id) || {}; return SLIP_ORDER.filter(k => st[k] === 'fail'); };
function resumeWatch(){
  const need = canAuto() && PRINT_FAILS.some(f => failedSlips(f).length);
  if(need && !resumeTimer) resumeTimer = setInterval(resumePoll, PRINT_RESUME.ms);
  else if(!need && resumeTimer){ clearInterval(resumeTimer); resumeTimer = null; }
}
/* มี ASB: เครื่องพร้อม (ASB ปกติ) + เคยเห็นปัญหา (resumeArmed) → พิมพ์ใบที่ขาดต่อทันทีหลังงานที่อยู่ในคิว · ตั๋วครัวก่อน · ใบที่กำลังพิมพ์ (wait) ไม่ซ้ำ */
let resumeKickQ = false;
function resumeKick(){
  if(resumeKickQ) return; resumeKickQ = true;
  printQueue.then(() => sleep(0)).then(() => {
    resumeKickQ = false;
    if(!asbLive() || UsbPrinter.asbTrouble(usbPrinter.asb) || !resumeArmed) return;
    const all = loadSales(), todo = PRINT_FAILS.map(f => [all.find(x => x.id === f.id), failedSlips(f)]).filter(([s, ks]) => s && ks.length);
    if(!todo.length) return;
    resumeArmed = false; plog('พร้อม → พิมพ์ต่อเอง', null, todo.map(([s, ks]) => '#' + pad(s.no, 3) + ' ' + ks.join('+')).join(', '));
    todo.forEach(([s, ks]) => printSale(s, ks.length === 2 ? 'both' : ks[0], false, true));
  });
}
function resumePoll(){
  if(resumeBusy) return;
  if(asbLive()){ if(!UsbPrinter.asbTrouble(usbPrinter.asb)) resumeKick(); return resumeWatch(); }   // รู้สถานะจาก ASB ไม่ต้องถาม
  if(!canPoll() || !PRINT_FAILS.some(f => failedSlips(f).length)) return resumeWatch();
  resumeBusy = true;
  printQueue = printQueue.then(() => usbPrinter.status()).then(ps => {
    resumeBusy = false;
    if(!ps){ renderFailBar(); return; }                      // ไม่ตอบ (noStatus → หยุดถาม ข้อความเปลี่ยนเป็นกดพิมพ์ซ้ำ) / ค่าผิดรูป (ถามต่อ)
    if(ps.cover || ps.paper){ resumeArmed = true; const why = ps.cover ? 'cover' : 'paper'; if(printWhy !== why){ printWhy = why; renderFailBar(); if(lastSale) renderDone(lastSale); } return; }
    if(!resumeArmed) return;
    resumeArmed = false;
    const all = loadSales();
    PRINT_FAILS.slice().forEach(f => { const ks = failedSlips(f), s = all.find(x => x.id === f.id); if(s && ks.length) printSale(s, ks.length === 2 ? 'both' : ks[0], false, true); });
  }, e => { resumeBusy = false; console.warn('resume status', e); });
}
/* ---------- ASB: เครื่องแจ้งสถานะเอง (Tee 2026-10-17 · XP-Q807K ยืนยันแล้ว: ฝาเปิด/ปิด แจ้งภายใน ~1 วิ) ----------
   เปิดตอนเชื่อม (ล้างคำสั่งค้างก่อน) · อ่านแยกจากคิวส่งข้อมูล จึงรู้แม้ช่องส่งค้างตอนฝาเปิด
   มีปัญหา (ฝาเปิด / กระดาษหมด / ออฟไลน์) ตอนมีใบที่ยังพิมพ์ไม่จบ → ใบนั้นสะดุด (ส่งครบแล้ว = ใบแทนทันที · กำลังส่ง = printJobs หยุดเองที่ก้อนถัดไป)
   กลับมาปกติ = เครื่องพร้อม → ตัดเศษ + พิมพ์ใบแทนทันที (resumeKick) */
function asbChanged(s, prev){
  const why = UsbPrinter.asbTrouble(s), was = UsbPrinter.asbTrouble(prev);
  if(why !== was || !prev) plog('ASB', null, `${s.raw.map(v => v.toString(16).padStart(2, '0')).join(' ')} = ${why || 'พร้อม'}`);
  if(s.near && !nearWarned){ nearWarned = true; toast('กระดาษใกล้หมด เตรียมม้วนใหม่ไว้', 'alert', 4000); }
  if(why && !was){
    asbLastWhy = why; printWhy = why; resumeArmed = true;
    const printing = [...PRINTED.entries()].filter(([, st]) => st.kitchen === 'wait' || st.receipt === 'wait').map(([id]) => id);
    const n = UNCONF.length ? slipsStumbled(Date.now(), true) : 0;   // ใบที่ส่งครบแต่ยังไม่ออก → ใบแทน
    if(printing.length){ const all = loadSales(); printing.forEach(id => { const s = all.find(x => x.id === id); if(s) addFail(s); }); }   // กำลังส่งอยู่ (ช่องส่งอาจค้างจนปิดฝา): แถบส้มขึ้นทันที ไม่รอให้งานจบ
    if(n || printing.length) failToast(why);
    if(PRINT_FAILS.length) renderFailBar();
    if(typeof lastSale !== 'undefined' && lastSale) renderDone(lastSale);
  } else if(!why && was){
    if(PRINT_FAILS.length) renderFailBar();
    if(typeof lastSale !== 'undefined' && lastSale) renderDone(lastSale);
    resumeKick();
  }
}
/* เชื่อมแล้ว (ทุกครั้ง รวมเชื่อมใหม่หลังหมดเวลา): ล้างคำสั่งค้าง (ถ้ายังไม่ได้ล้าง) + เปิด ASB
   ส่งทันทีไม่รอคิว (รอบการเชื่อมใหม่ยังไม่มีงานกำลังส่ง · USB ส่งตามลำดับที่เรียก งานที่ตามมาจึงอยู่หลังเสมอ) · ฝาเปิดอยู่ ช่องส่งค้าง = ไม่ถือคิวงานพิมพ์ไว้ */
function printerHello(){
  if(usbPrinter.epIn == null) return;
  const clean = usbPrinter.dirty === 'open';
  if(clean) usbPrinter.dirty = null;
  usbPrinter.send(jobBytes([...(clean ? [ESCPOS.recover(false)] : []), ESCPOS.asb(true)])).then(() => { usbPrinter.asbEnabled = true; plog('เชื่อม', null, 'เปิด ASB'); },
    e => { if(clean && !usbPrinter.dirty) usbPrinter.dirty = 'open'; plog('เชื่อม', null, 'เปิด ASB ไม่ได้ ' + (e && e.message)); });
}
if(usbPrinter){ usbPrinter.onAsb = asbChanged; usbPrinter.onAck = () => confirmTick(); usbPrinter.onOpen = printerHello; }
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pfid], [data-rp]'); if(!b) return;
  if(b.dataset.pfid){ const s = loadSales().find(x => String(x.id) === b.dataset.pfid); if(s) reprint(s); else dropFail(Number(b.dataset.pfid)); return; }
  const s = loadSales().find(x => String(x.id) === b.dataset.rpid); closeModal(); if(s) printSale(s, b.dataset.rp, true);
});
function printHtml(s, which){
  let h = '';
  if(which !== 'receipt') h += kitchenHtml(s);   // ตั๋วครัวก่อน
  if(which !== 'kitchen') h += receiptHtml(s);
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
    toast(UsbPrinter.isBusy(e) ? PRINTER_BUSY_MSG : 'เชื่อมปริ้นเตอร์ไม่สำเร็จ ลองถอดสายแล้วเสียบใหม่', 'alert', UsbPrinter.isBusy(e) ? 8000 : undefined);
  }
}
function openPrinterInfo(){
  const d = usbPrinter.dev;
  openModal(`<p style="margin:0 0 6px"><b>เชื่อมอยู่:</b> ${esc((d && d.productName) || 'ปริ้นเตอร์ USB')}</p>
    <p style="color:var(--mute);margin:0 0 6px">ตั๋วครัว${receiptMode() === 'all' ? 'และใบเสร็จ' : ''}จะพิมพ์ออกเครื่องนี้ทันทีหลังชำระเงิน${receiptMode() === 'all' ? '' : ' · ใบเสร็จพิมพ์เมื่อลูกค้าขอ'}</p>
    <div class="row"><button class="ghost" id="prOff">ยกเลิกการเชื่อม</button><button class="pay" id="prTest">พิมพ์ทดสอบ</button></div>
    <details class="plog"><summary>บันทึกการพิมพ์ (ไว้ส่งให้คนดูแลระบบ)</summary><pre id="plogText">${esc(PLOG.slice(-80).join('\n') || 'ยังไม่มี')}</pre></details>`, {title:`${icon('printer', 22)} ปริ้นเตอร์`, key:'printer'});
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
  const auto = quiet => { if(!usbPrinter.connected) usbPrinter.reconnect().then(renderPrinterBtn, e => {
    console.warn('usb reconnect', e); renderPrinterBtn();
    if(!quiet && UsbPrinter.isBusy(e)) toast(PRINTER_BUSY_MSG, 'alert', 8000);   // อีกหน้าจับปริ้นเตอร์ไว้
  }); };
  navigator.usb.addEventListener('connect', () => auto());
  /* กลับมาที่แอป (เช่นปิดหน้าทดสอบที่จับปริ้นเตอร์ไว้) ยังไม่ได้เชื่อม → ลองเชื่อมเงียบๆ 1 ครั้งต่อการกลับมา
     หน้าที่ถูกล็อก (แอปเปิดอยู่อีกหน้า · tablock.js) ไม่แย่งปริ้นเตอร์ */
  let backAt = 0;
  const back = () => {
    if(document.visibilityState === 'hidden' || usbPrinter.connected || Date.now() - backAt < 1500) return;
    if(typeof TAB_STATE !== 'undefined' && TAB_STATE === 'other') return;
    backAt = Date.now(); auto(true);
  };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('focus', back);
  navigator.usb.addEventListener('disconnect', e => {
    if(e.device !== usbPrinter.dev) return;
    usbPrinter.forget(); renderPrinterBtn(); toast('ปริ้นเตอร์หลุด เสียบสายใหม่แล้วจะเชื่อมเอง', 'alert');
  });
  auto();
}
renderPrinterBtn();
slipFontsReady();   // โหลดฟอนต์ตั๋วไว้ตั้งแต่เปิดแอป บิลแรกไม่ช้า
