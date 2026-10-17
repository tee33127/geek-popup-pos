// ปริ้นเตอร์ ESC/POS จำลอง: แปลคำสั่งทีละ byte แบบเครื่องจริง (state machine) ใช้เทสต์ว่าพิมพ์ต่อหลังงานถูกตัดกลางคันแล้วไม่ได้ตัวมั่ว
// รองรับ: NUL (ข้าม) · ESC @ · ESC d n · ESC p m t1 t2 · GS v 0 m xL xH yL yH + ข้อมูลภาพ · GS V m [n] (ตัด = จบ 1 ใบ) · DLE EOT n (ตอบสถานะ)
// byte อื่นนอกคำสั่ง = พิมพ์เป็นตัวอักษร (ตัวมั่ว) · ระหว่างรับข้อมูลภาพ ทุก byte เป็นข้อมูลภาพ (รวม ESC @ ของงานถัดไป) แบบเครื่องจริง
class EscPosEmu {
  constructor(){ this.pages = []; this.page = this.newPage(); this.st = 'idle'; this.cmd = []; this.need = 0; this.img = null; this.cover = false; this.paper = true; this.replies = []; }
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
      if(this.img.buf.length === this.img.wb){ this.page.rows.push(this.img.buf.slice()); this.img.buf = []; }
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
    if(a === 0x1D) return k === 0x76 ? 8 : k === 0x56 ? 4 : 2;
    if(a === 0x10) return k === 0x04 ? 3 : 2;
    return 2;
  }
  run(c){
    this.st = 'idle';
    const [a, k] = c;
    if(a === 0x1B && k === 0x40){ this.page.inits++; return; }
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
