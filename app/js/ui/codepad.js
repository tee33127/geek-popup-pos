/* ---------- แป้นใส่รหัสของแอปเอง: ใช้ทุกที่ที่ใส่รหัส (เข้าใช้งาน, ตั้งค่าครั้งแรก, ตั้งรหัสใหม่, รหัสเจ้าของ, ฟอร์มพนักงาน, รหัสกู้คืน)
   ไม่ใช้ <input type=password> เพราะ iPad (Safari) ไม่สนใจ inputmode บนช่อง password จึงขึ้นแป้นพิมพ์เต็ม (Tee 2026-10-13)
   1 แป้นมีได้หลายช่อง (รหัส + ใส่อีกครั้ง) ใส่ครบช่องแรกแล้วไปช่องถัดไปเอง · แตะช่องเพื่อแก้ · ⌫ ที่ช่องว่างกลับไปช่องก่อน
   padNew(id, {len, labels, msg, onEnter, onChange}) → padHtml(id) ใส่ในหน้า · padVal(id, i) อ่านค่า · padError(id, msg) ล้างทุกช่องแล้วแสดงข้อความ
   กดปุ่มวาดใหม่เฉพาะแป้น ช่องอื่นในหน้า (เช่น ชื่อ) ไม่หาย */
const PADS = {};
function padNew(id, o = {}){
  const labels = o.labels || [''];
  return PADS[id] = {id, len:o.len || CODE_LEN, labels, bufs:labels.map(() => ''), cur:0, msg:o.msg || '', onEnter:o.onEnter || null, onChange:o.onChange || null};
}
const padVal = (id, i = 0) => PADS[id] ? PADS[id].bufs[i] : '';
const padFull = (id, i = 0) => padVal(id, i).length === (PADS[id] || {}).len;
function padHtml(id){ return `<div class="cpad" id="cp-${id}" data-pad="${id}">${padInner(PADS[id])}</div>`; }
function padInner(p){
  const multi = p.labels.length > 1;
  const fields = p.labels.map((lb, i) => {
    const dots = Array.from({length:p.len}, (_, k) => `<i class="${k < p.bufs[i].length ? 'on' : ''}"></i>`).join('');
    const body = `${lb ? `<span class="cpl">${esc(lb)}</span>` : ''}<span class="dots ${p.len > CODE_LEN ? 'long' : ''}">${dots}</span>`;
    return multi ? `<button type="button" class="cpf ${i === p.cur ? 'cur' : ''}" data-cpf="${i}" aria-label="${esc(lb)} ใส่แล้ว ${p.bufs[i].length} จาก ${p.len} หลัก">${body}</button>`
      : `<div class="cpf" aria-label="ใส่แล้ว ${p.bufs[i].length} จาก ${p.len} หลัก">${body}</div>`;
  }).join('');
  return `<div class="cpfs ${multi ? 'multi' : ''}">${fields}</div><div class="lgmsg" role="alert">${esc(p.msg)}</div>
    <div class="keypad">${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" data-kp="${n}">${n}</button>`).join('')}
    <button type="button" data-kp="clear" class="kfn">ล้าง</button><button type="button" data-kp="0">0</button><button type="button" data-kp="back" class="kfn" aria-label="ลบ">⌫</button></div>`;
}
function padDraw(p){ const el = document.getElementById('cp-' + p.id); if(el) el.innerHTML = padInner(p); if(p.onChange) p.onChange(p); }
function padKey(p, k){
  const a = document.activeElement;
  if(a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) a.blur();   // iPad: ปิดแป้นพิมพ์ระบบที่ค้างจากช่องชื่อ
  const b = p.bufs[p.cur];
  if(k === 'back'){ if(!b && p.cur > 0) p.cur--; else p.bufs[p.cur] = b.slice(0, -1); }
  else if(k === 'clear'){ p.bufs = p.bufs.map(() => ''); p.cur = 0; }
  else if(/^\d$/.test(k) && b.length < p.len){ p.bufs[p.cur] = b + k; if(p.bufs[p.cur].length === p.len && p.cur < p.bufs.length - 1) p.cur++; }
  p.msg = ''; padDraw(p);
}
function padError(id, msg){ const p = PADS[id]; if(!p) return; p.bufs = p.bufs.map(() => ''); p.cur = 0; p.msg = msg; padDraw(p); }

document.addEventListener('click', e => {
  const box = e.target.closest('[data-pad]'), p = box && PADS[box.dataset.pad]; if(!p) return;
  const k = e.target.closest('[data-kp]'), f = e.target.closest('[data-cpf]');
  if(k) padKey(p, k.dataset.kp);
  else if(f){ p.cur = Number(f.dataset.cpf); padDraw(p); }
});
/* แป้นพิมพ์จริง (คอมพิวเตอร์): ตัวเลข / Backspace / Enter ไปที่แป้นที่เปิดอยู่ · ยกเว้นตอนพิมพ์ในช่องข้อความ */
document.addEventListener('keydown', e => {
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
  const box = [...document.querySelectorAll('[data-pad]')].pop(), p = box && PADS[box.dataset.pad]; if(!p) return;
  if(/^\d$/.test(e.key)) padKey(p, e.key);
  else if(e.key === 'Backspace') padKey(p, 'back');
  else if(e.key === 'Enter' && p.onEnter){ e.preventDefault(); p.onEnter(); }
});

/* ช่องตัวเลขที่ยังเป็น <input> (เงิน, เลข PromptPay): data-digits = เหลือแต่ตัวเลข ก่อนตัวจัดการของช่องนั้นจะเห็นค่า
   pattern="[0-9]*" ทำให้ iPad ขึ้นแป้นตัวเลข */
document.addEventListener('input', e => {
  const i = e.target; if(!i.hasAttribute || !i.hasAttribute('data-digits')) return;
  const v = i.value.replace(/\D/g, ''); if(v !== i.value) i.value = v;
}, true);
