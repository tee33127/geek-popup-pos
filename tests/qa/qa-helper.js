// ตัวช่วยของเทสต์ QA (/check-all) · รหัสทดสอบใช้บัญชีเดียวกับ auth-helper (เจ้าของ 1234 · แพร 1111)
// ผลแต่ละข้อ: PASS / FAIL / KNOWN-BUG (บั๊กที่รายงานแล้ว ไม่ทำให้ npm test แดง แต่ต้องอยู่ในรายงาน)
const {JSDOM} = require('jsdom'); const fs = require('fs'), path = require('path'), vm = require('vm');
const A = require('../auth-helper');
const F = require('../flow-helper');
const ROOT = path.join(__dirname, '../..');
const HTML = {pos: fs.readFileSync(path.join(ROOT, 'prototype/pos.html'), 'utf8')};

let fails = 0, bugs = 0;
const J = v => JSON.stringify(v);
/* bug = คำอธิบายบั๊กที่รู้แล้ว · ถ้าไม่ตรงและมี bug → พิมพ์ KNOWN-BUG แทน FAIL */
function eq(name, got, exp, bug){
  const ok = J(got) === J(exp);
  if(ok) console.log('PASS', name);
  else if(bug){ bugs++; console.log('KNOWN-BUG', name, `· ได้ ${J(got)} · คาด ${J(exp)} · ${bug}`); }
  else { fails++; console.log('FAIL', name, `got ${J(got)} expected ${J(exp)}`); }
  return ok;
}
function done(){ console.log(fails ? `\n${fails} FAILED` : `\nALL PASSED${bugs ? ` (known bugs: ${bugs})` : ''}`); process.exit(fails ? 1 : 0); }

/* สุ่มแบบกำหนด seed (mulberry32) */
function rng(seed){ let a = seed >>> 0; const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = n => Math.floor(r() * n); r.pick = list => list[r.int(list.length)]; return r; }

/* โหลดไฟล์ใน app/js ลง vm เปล่า (ไม่มี DOM) */
function vmLoad(files){
  const ctx = vm.createContext({console});
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8'), ctx, {filename:f}));
  return c => vm.runInContext(c, ctx);
}

/* เปิด prototype/pos.html ใน jsdom · now = เวลาจำลอง (ms) เดินทีละ 1 ms ทุกครั้งที่ new Date() ไม่ให้ id บิลซ้ำ
   ls = ค่าใส่ localStorage ก่อนเปิดหน้า · seed=false = เครื่องเปล่า */
function open(o = {}){
  const errors = [];
  const dom = new JSDOM(HTML.pos, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
    beforeParse(w){
      w.__printed = 0; w.print = () => { w.__printed++; };
      w.addEventListener('error', e => errors.push(e.message));
      w.alert = w.confirm = w.prompt = () => { errors.push('native dialog'); };
      if(o.now !== undefined){
        w.__now = o.now; const WD = w.Date;
        w.Date = class extends WD { constructor(...a){ if(a.length) super(...a); else super(w.__now++); } static now(){ return w.__now++; } };
      }
      Object.entries(o.ls || {}).forEach(([k, v]) => w.localStorage.setItem(k, typeof v === 'string' ? v : J(v)));
      if(o.seed !== false) A.seed(w, o.settings || {});
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function(){ w.__dl = {name:this.download}; };
      if(o.before) o.before(w);
    }});
  const w = dom.window, d = w.document;
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing ' + s); el.click(); };
  const ev = c => w.eval(c);
  const type = (sel, v) => { const i = $(sel); i.value = v; i.dispatchEvent(new w.Event('input', {bubbles:true})); };
  const P = {w, d, $, $$, click, ev, type, errors};
  P.signIn = (code = '1234') => A.signIn(w, code);
  P.keys = code => code.split('').forEach(c => click(`[data-kp="${c}"]`));   // กดแป้นรหัสของแอป (codepad.js)
  P.enter = code => { P.keys(code); click('#lgGo'); };
  /* เพิ่มแก้วผ่านหน้าจอ: {menu, size, picks, comps:{slot:name|null}, adds, honey, sep, note, answer} · answer = id ปุ่มในหน้าต่างถาม */
  /* หน้าเลือกออเดอร์แบบทีละขั้น: ปุ่มมีเฉพาะขั้นที่กางอยู่ ตัวช่วยกางให้ก่อน (../flow-helper.js) */
  P.menu = id => F.menu(w, id); P.size = id => F.size(w, id); P.honey = id => F.honey(w, id); P.off = () => F.off(w); P.finish = h => F.finish(w, h);
  /* เพิ่มแก้วผ่านหน้าจอ: {menu, size, picks, comps:{slot:name|null}, adds, honey, sep, note, answer}
     answer = id ปุ่มในหน้าต่างถาม (ถามตอนกดเพิ่มลงออเดอร์) ตอบตามลำดับ · หมายเหตุอยู่ขั้นสุดท้าย */
  P.add = (c) => {
    P.menu(c.menu);
    if(c.size) P.size(c.size);
    (c.picks || []).forEach(n => click(`[data-pick="${n}"]`));   // แตะ = เพิ่ม 1 ชิ้น
    Object.entries(c.comps || {}).forEach(([i, n]) => { if(n === null) click(`[data-skip="${i}"]`); else { click(`[data-swap="${i}"]`); click(`[data-choose="${n}"][data-slot="${i}"]`); } });
    if(c.adds && c.adds.length){ click('[data-addopen]'); c.adds.forEach(n => click(`#modal [data-add="${n}"]`)); click('#addsDone'); }   // หน้าต่างเพิ่มท็อปปิ้ง: แตะ = +1
    if(c.sep) click('.sep');
    const answers = Array.isArray(c.answer) ? [...c.answer] : c.answer ? [c.answer] : [];
    for(let i = 0; i < 8; i++){
      if($('#fewBack') || $('#cheapSwitch')){ const id = answers.shift(); if(!id) return; click('#' + id); continue; }
      if(!ev('sel.menu')) return;
      if($('[data-honey]') && !$('.hon.on')) click(`[data-honey="${c.honey || 'normal'}"]`);
      if(c.note && $('[data-noteopen]')) click('[data-noteopen]');
      if(c.note && $('#note') && $('#note').value !== c.note){ const n = $('#note'); n.value = c.note; n.dispatchEvent(new w.Event('input', {bubbles:true})); }
      if(P.off()) return;
      click('#btnAdd');
    }
  };
  P.pay = (method = 'cash', recv, dine = 'dinein') => {
    click('#btnPay'); click(`[data-dine="${dine}"]`); click(`[data-method="${method}"]`);
    if(method === 'cash'){ if(recv === undefined) click('[data-q]'); else { const r = $('#recv'); r.value = String(recv); r.oninput(); } }
    click('#payOk');
    const s = ev('lastSale'); if($('#nextOrder')) click('#nextOrder'); return s;
  };
  P.close = () => w.close();
  return P;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ตัวช่วยสร้างบิลโดยไม่ผ่านหน้าจอ (ใช้ราคาจาก priceItem ในหน้า) */
const T = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

module.exports = {eq, done, rng, vmLoad, open, wait, T, ROOT, J, counts: () => ({fails, bugs})};
