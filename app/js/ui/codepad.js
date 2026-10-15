/* ---------- ใส่รหัส 2 แบบ (Tee 2026-10-13) ----------
   1) แป้นตัวเลขของแอป (padNew/padHtml): เฉพาะหน้าเข้าใช้งาน (รหัส 4 หลัก + รหัสกู้คืน 8 หลัก)
   2) ช่องกรอกรหัส codeField(): ตั้งค่าครั้งแรก, ตั้งรหัสเจ้าของใหม่, ฟอร์มพนักงาน, askOwner · แป้นพิมพ์ระบบหน้าตัวเลข
   ห้ามใช้ <input type=password> เพราะ iPad (Safari) ไม่สนใจ inputmode บนช่อง password จึงขึ้นแป้นตัวอักษร
   แป้นของแอป: 1 แป้นมีได้หลายช่อง (รหัส + ใส่อีกครั้ง) ใส่ครบช่องแรกแล้วไปช่องถัดไปเอง · แตะช่องเพื่อแก้ · ⌫ ที่ช่องว่างกลับไปช่องก่อน
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

/* ช่องกรอกรหัส: type=text + inputmode numeric (ไม่ใช่ password) ซ่อนตัวเลขด้วย CSS -webkit-text-security
   enter = id ปุ่มหลักที่กด Enter แล้วทำงาน · ปุ่มรูปตา กดค้างเพื่อดูรหัส ปล่อยแล้วซ่อน */
function codeField(id, enter, len = CODE_LEN, value = ''){
  return `<span class="codein"><input class="secret" id="${id}" type="text" inputmode="numeric" pattern="[0-9]*" data-digits data-enter="${enter}" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="${len}" value="${esc(value)}">` +
    `<button type="button" class="eye" data-eye="${id}" aria-label="กดค้างเพื่อดูรหัส" title="กดค้างเพื่อดูรหัส">${icon('eye', 22)}</button></span>`;
}
const eyeShow = (b, on) => { const i = document.getElementById(b.dataset.eye); if(i) i.classList.toggle('secret', !on); b.classList.toggle('on', on); };
document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('[data-eye]'); if(!b) return; e.preventDefault(); eyeShow(b, true); });   // preventDefault: ช่องรหัสไม่หลุด focus แป้นพิมพ์ไม่ปิด
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, e => { const b = e.target.closest && e.target.closest('[data-eye]'); if(b) eyeShow(b, false); }, true));
document.addEventListener('contextmenu', e => { if(e.target.closest && e.target.closest('[data-eye]')) e.preventDefault(); });   // กดค้างบนมือถือไม่ขึ้นเมนู
document.addEventListener('keydown', e => {
  const i = e.target; if(e.key !== 'Enter' || !i.dataset || !i.dataset.enter) return;
  const b = document.getElementById(i.dataset.enter); if(b && !b.disabled){ e.preventDefault(); b.click(); }
});

/* ช่องตัวเลขที่เป็น <input> (รหัส, เงิน, เลข PromptPay): data-digits = เหลือแต่ตัวเลข ก่อนตัวจัดการของช่องนั้นจะเห็นค่า
   pattern="[0-9]*" ทำให้ iPad ขึ้นแป้นตัวเลข */
document.addEventListener('input', e => {
  const i = e.target; if(!i.hasAttribute || !i.hasAttribute('data-digits')) return;
  const v = i.value.replace(/\D/g, ''); if(v !== i.value) i.value = v;
}, true);

/* ---------- แป้นตัวเลขเงินของแอป (Tee 2026-10-14 Redmi จริง: แป้นพิมพ์ Android กินครึ่งจอ หน้าต่างไม่เหลือที่) ----------
   ใช้กับช่องเงินที่ใช้บ่อย: รับเงินมา (เงินสด), เงินทอนตั้งต้น, ตั้งต้น/นับได้จริง (ปิดร้าน)
   ช่อง moneyField(): หน้าตาเหมือนช่องกรอก แต่ readonly + inputmode="none" แป้นระบบไม่ขึ้น · แตะช่อง = เลือกช่องที่จะใส่ (class cur)
   แป้น moneyPadHtml(): วางข้างช่องแบบเครื่องคิดเลข 0-9, 00, ⌫, ล้าง · กดแล้วยิง input ให้ตัวจัดการเดิมของช่องทำงาน */
const MONEY_MAX = 7;   // สูงสุด 9,999,999 บาท
function moneyField(id, value, cur, cls = 'num'){
  return `<input class="${cls} moneyin ${cur ? 'cur' : ''}" id="${id}" readonly inputmode="none" data-money autocomplete="off" placeholder="0" value="${value === null || value === undefined ? '' : value}" aria-label="ช่องเงิน แตะแล้วใช้แป้นตัวเลขด้านข้าง">`;
}
function moneyPadHtml(){
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'back'];
  return `<div class="mpad" role="group" aria-label="แป้นตัวเลข">` + keys.map(k => `<button type="button" data-mk="${k}"${k === 'back' ? ' aria-label="ลบ"' : ''}>${k === 'back' ? '⌫' : k}</button>`).join('') +
    `<button type="button" data-mk="clear" class="mclear">ล้าง</button></div>`;
}
document.addEventListener('click', e => {
  const t0 = e.target.closest && e.target.closest('input[data-money]');
  if(t0){ (t0.closest('.box') || document).querySelectorAll('input[data-money]').forEach(x => x.classList.toggle('cur', x === t0)); return; }
  const k = e.target.closest && e.target.closest('[data-mk]'); if(!k) return;
  const scope = k.closest('.box') || document, t = scope.querySelector('input[data-money].cur') || scope.querySelector('input[data-money]'); if(!t) return;
  let v = t.value.replace(/\D/g, ''); const key = k.dataset.mk;
  if(key === 'back') v = v.slice(0, -1);
  else if(key === 'clear') v = '';
  else { v = (v === '0' ? '' : v) + key; if(!/[1-9]/.test(v)) v = '0'; v = v.slice(0, MONEY_MAX); }
  t.value = v; t.dispatchEvent(new Event('input', {bubbles:true}));
});
