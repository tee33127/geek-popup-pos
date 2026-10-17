/* ---------- ตัวช่วยหน้าจอ: $, toast, modal, ยืนยัน, รหัสเจ้าของ ---------- */
const $ = id => document.getElementById(id);

/* toast (Tee 2026-10-15 Redmi จริง)
   ไม่มีหน้าต่าง: ลอยเหนือแถบล่างของหน้าเลือกเมนู ตรงปุ่ม "เพิ่มลงออเดอร์" (ไม่ทับปุ่มหลัก ยอดเงิน · กล่องออเดอร์ที่ขยายอยู่)
   มีหน้าต่างเปิด: ห้ามทับหน้าต่าง → แสดงเป็นแถบข้อความในตัวหน้าต่างใต้หัว (.mtoast) กันทับยอดเงินทอน
   แสดง 1.4 วินาที (ms = นานกว่านี้ เช่นปริ้นเตอร์ไม่ตอบ) · แตะแล้วหายทันที · หน้าต่างวาดใหม่ระหว่างนั้น (openModal) ข้อความยังอยู่ */
let MTOAST = null;   // ข้อความที่แสดงในหน้าต่าง {html, until}
function toast(msg, ic, ms = 1400){
  const html = (ic ? icon(ic, 18) + ' ' : '') + esc(msg), t = $('toast');
  clearTimeout(toast.h);
  if($('modal').classList.contains('show')){
    t.style.display = 'none'; MTOAST = {html, until:Date.now() + ms}; modalToast();
    toast.h = setTimeout(() => { MTOAST = null; const m = document.querySelector('#modal .mtoast'); if(m) m.remove(); }, ms);
    return;
  }
  t.innerHTML = html; t.style.display = 'block';
  placeToast(t); toast.h = setTimeout(() => { t.style.display = 'none'; }, ms);
}
function modalToast(){
  const box = document.querySelector('#modal .box'); if(!box || !MTOAST || Date.now() > MTOAST.until) return;
  let m = box.querySelector('.mtoast');
  if(!m){ m = document.createElement('div'); m.className = 'mtoast'; m.setAttribute('role', 'status');
    const head = box.querySelector('.mhead'); if(head) head.after(m); else box.prepend(m);
    m.onclick = () => { MTOAST = null; m.remove(); }; }
  m.innerHTML = MTOAST.html;
}
function placeToast(t){
  const W = window.innerWidth, bar = $('actBar'), b = bar && bar.getBoundingClientRect ? bar.getBoundingClientRect() : null;
  let cx = W / 2, bottom = 16, L = 8, R = W - 8;
  if(b && b.width){ const add = $('btnAdd').getBoundingClientRect(); cx = add.left + add.width / 2; bottom = window.innerHeight - b.top + 8; }
  if(document.body.classList.contains('cartopen')){ const c = document.querySelector('aside.cart').getBoundingClientRect(); if(c.width) R = Math.min(R, c.left - 8); }   // ไม่ทับกล่องออเดอร์ที่ขยาย
  t.style.maxWidth = Math.max(160, R - L) + 'px'; t.style.top = 'auto'; t.style.bottom = bottom + 'px';
  const w = t.offsetWidth || 0;
  t.style.left = Math.min(Math.max(cx, L + w / 2), R - w / 2) + 'px';
  /* ห้ามทับปุ่มหลัก/ยอดเงินที่เห็นอยู่ (แนวตั้ง: ปุ่มชำระเงินในกล่องออเดอร์อาจเลื่อนมาอยู่เหนือแถบล่าง) → ขยับขึ้นเหนือสิ่งนั้น */
  const keep = ['btnPay', 'total', 'barTotal', 'btnClear'].map($).filter(e => e && e.getBoundingClientRect && e.offsetParent !== null);
  for(let i = 0; i < 4; i++){
    const a = t.getBoundingClientRect(), hit = keep.map(e => e.getBoundingClientRect()).find(r => r.width && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top);
    if(!hit) break;
    bottom = window.innerHeight - hit.top + 8; t.style.bottom = bottom + 'px';
  }
}
$('toast').addEventListener('click', () => { clearTimeout(toast.h); $('toast').style.display = 'none'; });
/* ความสูงแถบหัว → หน้าต่างเริ่มใต้แถบนี้ */
const setHdrH = () => { const hd = document.querySelector('header'); if(hd) document.documentElement.style.setProperty('--hdrh', hd.offsetHeight + 'px'); };
window.addEventListener('resize', setHdrH); setHdrH();

/* ---------- Modal: แบบเดียวกันทุกหน้าต่าง (Tee 2026-10-13 · iPad ปัดในตั้งค่าแล้วหน้าขายข้างหลังเลื่อนแทน) ----------
   openModal(body, o) · o = {title, key, foot, wide, backdrop, onClose} (ส่ง true = wide แบบเดิม)
   - title → หัวติดบน: ชื่อซ้าย + ปุ่ม X ขวา (id closeX, aria-label "ปิด") · X เรียก o.onClose หรือ closeModal
   - foot → แถบล่างติดกล่อง (ปุ่มหลัก) · เนื้อหาเลื่อนเฉพาะใน .mbody (overscroll-behavior: contain)
   - key → เปิดหน้าต่างเดิมซ้ำ (เช่น กดสวิตช์ในตั้งค่า เปลี่ยนแท็บสรุปยอด) คงตำแหน่งเลื่อน · หน้าต่างใหม่เริ่มบนสุด
   - backdrop → แตะพื้นหลังนอกกล่องเพื่อปิด (เฉพาะตั้งค่าและสรุปยอด กันข้อมูลที่กรอกหาย)
   - back = {label, fn} → ปุ่ม "‹ label" ซ้ายสุดของหัว (หน้าย่อย เช่น ตั้งค่า → สินค้าหมด) · head = ปุ่มที่ติดหัวหน้าต่าง เห็นตลอดแม้เลื่อน (เช่น สรุปยอด: CSV ปิดร้าน)
   ระหว่างเปิด ล็อกหน้าหลัง: iOS ไม่สน overflow:hidden จึงใช้ body position:fixed + จำ scrollY แล้วคืนตอนปิด */
let MD = null, mdLockY = null;
function lockPage(){
  if(mdLockY !== null) return;
  mdLockY = window.scrollY || 0;
  const b = document.body.style; b.position = 'fixed'; b.top = -mdLockY + 'px'; b.left = '0'; b.right = '0'; b.width = '100%';
}
function unlockPage(){
  if(mdLockY === null) return;
  const y = mdLockY; mdLockY = null;
  const b = document.body.style; b.position = b.top = b.left = b.right = b.width = '';
  (document.scrollingElement || document.documentElement).scrollTop = y;
}
function openModal(body, o = {}){
  if(o === true || o === false) o = {wide:o};
  const prev = MD, body0 = $('modal').querySelector('.mbody'), keep = prev && o.key && prev.key === o.key && body0 ? body0.scrollTop : 0;
  MD = {key:o.key || null, backdrop:!!o.backdrop, onClose:o.onClose || null, back:o.back ? o.back.fn : null};
  $('modal').innerHTML = `<div class="box ${o.wide ? 'wide' : ''} ${o.cls || ''}" role="dialog" aria-modal="true"${o.title ? ' aria-labelledby="mdTitle"' : ''}>` +
    (o.title ? `<div class="mhead">${o.back ? `<button class="tbtn mback" id="mdBack" aria-label="กลับไป${esc(o.back.label)}">${icon('chevL', 22)}${esc(o.back.label)}</button>` : ''}<h3 id="mdTitle">${o.title}</h3>${o.head ? `<div class="mtools">${o.head}</div>` : ''}<button class="mx" id="closeX" aria-label="ปิด">${icon('x', 26)}</button></div>` : '') +
    `<div class="mbody">${body}</div>` + (o.foot ? `<div class="mfoot">${o.foot}</div>` : '') + `</div>`;
  $('modal').classList.add('show'); lockPage();
  if(keep) $('modal').querySelector('.mbody').scrollTop = keep;
  modalToast();   // ข้อความที่ยังแสดงอยู่ ไม่หายตอนหน้าต่างวาดใหม่
  $('toast').style.display = 'none';   // toast ที่ค้างอยู่ห้ามทับหน้าต่าง
}
/* แป้นพิมพ์บนจอ (Android/iOS) ทำให้จอที่มองเห็นเตี้ยลงโดยหน้าไม่ย่อตาม: หน้าต่างใช้ความสูงของ visualViewport
   แล้วเลื่อนช่องที่กำลังพิมพ์ (และเงินทอนใต้ช่อง) ให้อยู่ในจอ · ปุ่มยืนยันอยู่ในแถบล่างของกล่องจึงเห็นตลอด (Tee 2026-10-14 Redmi) */
function fitViewport(){
  const vv = window.visualViewport; if(!vv) return;
  const r = document.documentElement.style;
  r.setProperty('--vvh', Math.round(vv.height) + 'px'); r.setProperty('--vvtop', Math.round(vv.offsetTop) + 'px');
  const a = document.activeElement, mb = a && a.closest && a.closest('#modal .mbody');
  if(!mb || !a.scrollIntoView) return;
  a.scrollIntoView({block:'nearest'});
  const ch = mb.querySelector('.change'); if(ch) ch.scrollIntoView({block:'nearest'});
}
if(window.visualViewport){ visualViewport.addEventListener('resize', fitViewport); visualViewport.addEventListener('scroll', fitViewport); fitViewport(); }
document.addEventListener('focusin', e => { if(e.target.closest && e.target.closest('#modal')) setTimeout(fitViewport, 300); });   // แป้นพิมพ์ขึ้นหลัง focus นิดหน่อย
function closeModal(){ $('modal').classList.remove('show'); $('modal').innerHTML = ''; MD = null; unlockPage(); }
/* ปุ่ม X / แตะพื้นหลัง: ใช้ onClose ของหน้าต่างนั้น (ล้างข้อมูลที่ค้าง) ถ้ามี */
function modalClose(){ const f = MD && MD.onClose; if(f) f(); else closeModal(); }
$('modal').addEventListener('click', e => { if(e.target === $('modal') && MD && MD.backdrop) modalClose(); });
$('modal').addEventListener('click', e => { if(e.target.closest('#mdBack') && MD && MD.back) MD.back(); });
/* หน้าต่างยืนยัน/PIN ของระบบเอง (ไม่ใช้ confirm/prompt ของเบราว์เซอร์ เพราะบางโหมดเปิดไฟล์จะถูกบล็อก) */
let confirmCb = null, confirmNo = null, pinCb = null, pinMsg = '';
function askConfirm(o){
  confirmCb = o.onYes || null; confirmNo = o.onNo || null;
  openModal(`<h3>${esc(o.msg)}</h3>${o.sub ? `<p style="color:var(--mute);margin:0 0 6px">${esc(o.sub)}</p>` : ''}
    <div class="row confirmrow"><button class="tbtn" id="cfNo">กลับ</button><button class="pay ${o.ok ? '' : 'danger'}" id="cfYes">${esc(o.yes || 'ยืนยัน')}</button></div>`);
}
/* ให้เจ้าของใส่รหัส (พนักงานกดยกเลิก/นำบิลกลับ) · ผ่าน → onOk(เจ้าของคนนั้น) · ช่องกรอก codeField (codepad.js) */
function askOwner(onOk, msg, err){
  pinCb = onOk; pinMsg = msg || '';
  openModal(`<h3>${icon('lock', 22)} ให้เจ้าของใส่รหัส</h3>${msg ? `<p style="color:var(--mute);margin:0 0 8px">${esc(msg)}</p>` : ''}
    ${codeField('pinIn', 'pinOk')}
    ${err ? `<p class="pinerr" role="alert">${esc(err)}</p>` : ''}
    <div class="row confirmrow"><button class="tbtn" id="pinNo">ยกเลิก</button><button class="pay" id="pinOk">ตกลง</button></div>`);
  $('pinIn').focus();
}
function checkPin(){
  const u = userByCode($('pinIn').value), cb = pinCb;
  if(u && u.role === 'owner'){ pinCb = null; if(cb) cb(u); }
  else askOwner(cb, pinMsg, u ? 'รหัสนี้ไม่ใช่รหัสเจ้าของ' : 'รหัสไม่ถูกต้อง');
}
