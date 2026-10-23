// ปริ้นเตอร์ ESC/POS จำลอง: แปลคำสั่งทีละ byte แบบเครื่องจริง (state machine) ใช้เทสต์ว่าพิมพ์ต่อหลังงานถูกตัดกลางคันแล้วไม่ได้ตัวมั่ว
// รองรับ: NUL (ข้าม) · ESC @ · ESC d n · ESC p m t1 t2 (เปิดลิ้นชัก บันทึกใน drawers) · GS v 0 m xL xH yL yH + ข้อมูลภาพ · GS V m [n] (ตัด = จบ 1 ใบ) · DLE EOT n (ตอบสถานะ)
//         GS a n (ASB: เปิดเฉพาะ asbCapable · ส่ง 4 byte แบบเครื่องจริง (ES-8805U = XP-Q807K) เมื่อเปิดและเมื่อฝา/กระดาษเปลี่ยน ผ่าน setCover/setPaper) · GS r n (ตอบ 0x00 เมื่อทำงานถึงจุดนี้ · noAck = ไม่รองรับ)
// replies = คิวคำตอบทาง bulk IN (ตัวเลข = 1 byte · array = 1 ก้อน เช่น ASB)
// byte อื่นนอกคำสั่ง = พิมพ์เป็นตัวอักษร (ตัวมั่ว) · ระหว่างรับข้อมูลภาพ ทุก byte เป็นข้อมูลภาพ (รวม ESC @ ของงานถัดไป) แบบเครื่องจริง
class EscPosEmu {
  constructor(){ this.pages = []; this.page = this.newPage(); this.st = 'idle'; this.cmd = []; this.need = 0; this.img = null; this.cover = false; this.paper = true; this.replies = []; this.asbMode = 0; this.acks = 0; this.drawers = []; }
  /* ASB ค่าจริง (ES-8805U printer-test 2026-10-23 · XP-Q807K 2026-10-17 เหมือนกัน): ปกติ 14 00 00 0F · ฝาเปิด 3C 00 00 0F แล้ว 3C 00 0C 0F (เซนเซอร์กระดาษใต้ฝา) · กระดาษหมดฝาปิด 1C 00 0C 0F (วัดแล้วบน ES-8805U) */
  asbBytes(){ const noPaper = !this.paper || (this.cover && this.coverSensed); return [0x14 | (this.cover || !this.paper || this.pulsing ? 0x08 : 0) | (this.cover ? 0x20 : 0), 0x00, (noPaper ? 0x0C : 0) | (this.near ? 0x03 : 0), 0x0F]; }
  /* drawerOffline = แบบ ES-8805U (เครื่องจริง 2026-10-23): ระหว่างดีดลิ้นชัก (t1 + t2) × 2 ms เครื่องออฟไลน์ ASB 1C 00 00 0F แล้วกลับเป็น 14 00 00 0F
     timer = setTimeout ของเทสต์ (นาฬิกาจำลอง) · pulsing = ระหว่างนี้หัวพิมพ์ไม่ทำงาน (ให้เทสต์เช็กก่อนป้อนข้อมูล) */
  sendAsb(){ if(this.asbCapable && this.asbMode) this.replies.push(this.asbBytes()); }
  setCover(v){ if(this.cover === v) return; this.cover = v; this.coverSensed = false; this.sendAsb(); if(v){ this.coverSensed = true; this.sendAsb(); } }
  setPaper(v){ if(this.paper === v) return; this.paper = v; this.sendAsb(); }
  newPage(){ return {rows:[], text:'', inits:0, images:0}; }
  /* DLE EOT n เป็นคำสั่ง real-time: เครื่องตอบทันทีที่รับ ไม่ว่ากำลังอยู่กลางคำสั่งอะไร (ตามสเปก ESC/POS) · byte ยังไหลเข้าตัวแปลคำสั่งตามปกติ (กลางภาพ = เป็นข้อมูลภาพ) */
  feed(data){ for(const b of data){ this.realtime(b); this.byte(b); } return this; }
  feedParser(data){ for(const b of data) this.byte(b); return this; }   // ไม่ผ่านตัวตอบ real-time (ใช้กับปริ้นเตอร์มีบัฟเฟอร์ที่ตอบสถานะไปแล้วตอนรับ)
  realtime(b){
    const [p2, p1] = this.rt || [];
    if(p2 === 0x10 && p1 === 0x04 && b >= 1 && b <= 4) this.reply(b);
    this.rt = [p1, b];
  }
  reply(n){
    let v = 0x12;
    const noPaper = !this.paper || this.cover;                 // เครื่องจริง: ฝาเปิด เซนเซอร์กระดาษ (ใต้ฝา) บอกว่าหมดด้วย (0x36 / 0x72)
    if(n === 2){ if(this.cover) v |= 0x04; if(noPaper) v |= 0x20; }
    if(n === 4 && noPaper) v |= 0x60;
    if(n === 4 && this.near) v |= 0x0C;
    this.replies.push(v);
  }
  byte(b){
    if(this.st === 'raster'){
      this.img.buf.push(b);
      if(this.img.buf.length === this.img.wb){ if(this.loseRows > 0) this.loseRows--; else this.page.rows.push(this.img.buf.slice()); this.img.buf = []; }   // loseRows = แถวที่เสียตรงรอยต่อตอนฝาเปิด (เครื่องพิมพ์ต่อเองแต่บรรทัดขาด)
      if(--this.need === 0){ this.st = 'idle'; this.img = null; }
      return;
    }
    if(this.st === 'cmd'){
      this.cmd.push(b);
      const c = this.cmd;
      if(c[0] === 0x1D && c[1] === 0x76 && c.length >= 3 && c[2] !== 0x30){ this.st = 'idle'; return; }   // GS v ที่ไม่ใช่ '0' = ไม่รู้จัก ทิ้ง
      if(c[0] === 0x1D && c[1] === 0x56 && c.length === 3 && c[2] !== 0x41 && c[2] !== 0x42){ this.cut(); return; }   // GS V 0/1/48/49 ไม่มี n
      if(c.length < this.cmdLen(c)) return;
      this.run(c); return;
    }
    if(b === 0x00) return;                                   // NUL: เครื่องไม่ทำอะไร
    if(b === 0x1B || b === 0x1D || b === 0x10){ this.st = 'cmd'; this.cmd = [b]; return; }
    if(b === 0x0A){ this.page.text += '\n'; return; }
    this.page.text += String.fromCharCode(b);                // นอกคำสั่ง = ตัวอักษร
  }
  /* ความยาวคำสั่งรวม byte นำ (ยังไม่รู้ = Infinity รอ byte ต่อไป) */
  cmdLen(c){
    if(c.length < 2) return Infinity;
    const [a, k] = c;
    if(a === 0x1B) return k === 0x40 ? 2 : k === 0x64 ? 3 : k === 0x70 ? 5 : 2;
    if(a === 0x1D) return k === 0x76 ? 8 : k === 0x56 ? 4 : k === 0x61 || k === 0x72 ? 3 : 2;
    if(a === 0x10) return k === 0x04 ? 3 : 2;
    return 2;
  }
  run(c){
    this.st = 'idle';
    const [a, k] = c;
    if(a === 0x1B && k === 0x40){ this.page.inits++; if(this.initClearsAsb) this.asbMode = 0; return; }   // initClearsAsb = ESC @ ปิด ASB (ยังไม่รู้ว่าเครื่องจริงทำไหม แอปเปิดซ้ำหลัง ESC @ ทุกงาน)
    if(a === 0x1B && k === 0x70){
      this.drawers.push({pin:c[2], t1:c[3], t2:c[4], pages:this.pages.length}); if(this.onDrawer) this.onDrawer(c[2]);
      if(this.drawerOffline && this.timer){ this.pulsing = true; this.sendAsb(); this.timer(() => { this.pulsing = false; this.sendAsb(); }, (c[3] + c[4]) * 2); }
      return;
    }   // ESC p m t1 t2: pages = จำนวนใบที่ตัดออกไปก่อนลิ้นชักเปิด
    if(a === 0x1D && k === 0x61){ const was = this.asbMode; this.asbMode = c[2]; if(c[2] && !was) this.sendAsb(); return; }   // เปิด ASB = ส่งสถานะปัจจุบันทันที
    if(a === 0x1D && k === 0x72){ this.acks++; if(!this.noAck) this.replies.push(0x00); if(this.onAck) this.onAck(); return; }
    if(a === 0x1D && k === 0x76){
      const wb = c[4] | c[5] << 8, h = c[6] | c[7] << 8;
      this.page.images++;
      if(wb && h){ this.st = 'raster'; this.need = wb * h; this.img = {wb, buf:[]}; }
      return;
    }
    if(a === 0x1D && k === 0x56){ this.cut(); return; }
    // DLE EOT ตอบไปแล้วตอนรับ (realtime) ที่นี่แค่กินคำสั่ง
  }
  cut(){ this.st = 'idle'; this.pages.push(this.page); this.page = this.newPage(); }
  /* แถวภาพของใบ (ไม่นับแถวขาวล้วน) เป็นข้อความ hex ไว้เทียบ */
  static ink(page){ return page.rows.filter(r => r.some(x => x)).map(r => r.map(x => x.toString(16).padStart(2, '0')).join('')); }
}
module.exports = {EscPosEmu};
