// นาฬิกาจำลองสำหรับเทสต์ jsdom (Tee 2026-10-18 · เทสต์ต้องผลนิ่ง ห้ามรอเวลาจริง)
// แทน setTimeout / setInterval / Date / performance.now ของหน้า (และของปริ้นเตอร์จำลองในเทสต์) ด้วยเวลาที่เทสต์เดินเอง
// - เวลาไม่เดินเอง: เทสต์เรียก until(cond) / advance(ms) แล้วนาฬิกายิงตัวจับเวลาตามลำดับเวลา (เท่ากัน = ตามลำดับที่ตั้ง แบบเบราว์เซอร์)
// - ระหว่างตัวจับเวลาแต่ละตัว รอ 1 macrotask ของ node = promise / microtask ที่ค้างทำครบก่อน (เหมือนเบราว์เซอร์ทำ microtask หลังทุก task)
// - ผลไม่ขึ้นกับความเร็วเครื่อง: เครื่องช้า = ใช้เวลาจริงนานขึ้น แต่ลำดับเหตุการณ์และเวลาจำลองเท่าเดิมทุกรอบ
// - เพดานใน until(cond, ms) เป็นเวลาจำลอง (ไม่ใช่เวลารอจริง) เกินแล้วคืน false ให้เทสต์ FAIL
const flush = () => new Promise(r => setImmediate(r));

class VClock {
  constructor(start = new Date(2026, 9, 18, 12, 0).getTime()){ this.now = start; this.t0 = start; this.seq = 0; this.timers = new Map(); }
  setTimeout(fn, ms = 0, ...a){ return this.add(fn, ms, a, 0); }
  setInterval(fn, ms = 0, ...a){ return this.add(fn, ms, a, Math.max(1, Number(ms) || 0)); }
  clear(id){ this.timers.delete(id); }
  add(fn, ms, args, every){
    const id = ++this.seq;
    if(typeof fn === 'function') this.timers.set(id, {at: this.now + Math.max(0, Number(ms) || 0), id, fn, args, every});
    return {id, unref(){ return this; }, ref(){ return this; }, hasRef: () => false, [Symbol.toPrimitive]: () => id};
  }
  key(t){ return t && typeof t === 'object' ? t.id : t; }
  next(){ let b = null; for(const t of this.timers.values()) if(!b || t.at < b.at || (t.at === b.at && t.id < b.id)) b = t; return b; }
  /* เดินเวลาจนกว่า cond() เป็นจริง หรือครบ ms (เวลาจำลอง) · ไม่มี cond = เดินครบ ms แล้วหยุด (ช่วงสังเกตว่า "ไม่มีอะไรเกิดเพิ่ม") */
  async run(cond, ms, step = 1){
    const end = this.now + ms;
    let seen = -Infinity;
    for(;;){
      await flush();
      const t = this.next();
      if(cond && (!t || t.at > this.now) && this.now - seen >= step){ seen = this.now; if(cond()) return true; }   // เช็กเมื่อไม่มีอะไรถึงเวลาแล้ว ณ ตอนนี้ (setTimeout 0 ที่แอปตั้งไว้ทำก่อน แบบเบราว์เซอร์)
      if(!t || t.at > end){ this.now = Math.max(this.now, end); await flush(); return cond ? !!cond() : true; }
      this.now = Math.max(this.now, t.at);
      if(t.every) t.at = this.now + t.every; else this.timers.delete(t.id);
      t.fn(...t.args);
    }
  }
  /* step = เช็ก cond ทุกกี่ ms ของเวลาจำลอง (cond ที่หนัก เช่นถอดข้อความจากกระดาษทุกใบ ใช้ step ใหญ่ขึ้นได้ ผลยังนิ่งเพราะเวลาเป็นของจำลอง) */
  until(cond, ms = 10000, step = 1){ return this.run(cond, ms, step); }
  advance(ms){ return this.run(null, ms); }
  /* เวลาที่คนใช้ระหว่างกดแต่ละครั้ง: เลื่อนเวลาโดยไม่ยิงตัวจับเวลา (ไม่ให้สองบิลได้เวลา = id เดียวกัน) */
  bump(ms = 1){ this.now += ms; }
  /* ใส่ในหน้า jsdom (beforeParse) */
  install(w){
    const c = this;
    w.setTimeout = (f, ms, ...a) => c.setTimeout(f, ms, ...a);
    w.setInterval = (f, ms, ...a) => c.setInterval(f, ms, ...a);
    w.clearTimeout = w.clearInterval = t => c.clear(c.key(t));
    const WD = w.Date;
    w.Date = class extends WD { constructor(...a){ if(a.length) super(...a); else super(c.now); } static now(){ return c.now; } };
    if(w.performance) Object.defineProperty(w.performance, 'now', {value: () => c.now - c.t0, configurable: true});
    return c;
  }
  /* ตัวจับเวลาฝั่งเทสต์ (ปริ้นเตอร์จำลอง ฟอนต์จำลอง) ใช้นาฬิกาเดียวกัน */
  get api(){ const c = this; return {setTimeout: (f, ms, ...a) => c.setTimeout(f, ms, ...a), setInterval: (f, ms, ...a) => c.setInterval(f, ms, ...a), clearTimeout: t => c.clear(c.key(t)), clearInterval: t => c.clear(c.key(t)), now: () => c.now}; }
}
module.exports = {VClock, flush};
