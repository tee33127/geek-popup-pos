/* ---------- ตัวช่วยหน้าจอ: $, toast, modal, ยืนยัน, รหัสเจ้าของ ---------- */
const $ = id => document.getElementById(id);

function toast(msg, ic){ const t = $('toast'); t.innerHTML = (ic ? icon(ic, 18) + ' ' : '') + esc(msg); t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(()=> t.style.display='none', 1800); }

/* ---------- Modal: แบบเดียวกันทุกหน้าต่าง (Tee 2026-10-13 · iPad ปัดในตั้งค่าแล้วหน้าขายข้างหลังเลื่อนแทน) ----------
   openModal(body, o) · o = {title, key, foot, wide, backdrop, onClose} (ส่ง true = wide แบบเดิม)
   - title → หัวติดบน: ชื่อซ้าย + ปุ่ม X ขวา (id closeX, aria-label "ปิด") · X เรียก o.onClose หรือ closeModal
   - foot → แถบล่างติดกล่อง (ปุ่มหลัก) · เนื้อหาเลื่อนเฉพาะใน .mbody (overscroll-behavior: contain)
   - key → เปิดหน้าต่างเดิมซ้ำ (เช่น กดสวิตช์ในตั้งค่า เปลี่ยนแท็บสรุปยอด) คงตำแหน่งเลื่อน · หน้าต่างใหม่เริ่มบนสุด
   - backdrop → แตะพื้นหลังนอกกล่องเพื่อปิด (เฉพาะตั้งค่าและสรุปยอด กันข้อมูลที่กรอกหาย)
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
  MD = {key:o.key || null, backdrop:!!o.backdrop, onClose:o.onClose || null};
  $('modal').innerHTML = `<div class="box ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true"${o.title ? ' aria-labelledby="mdTitle"' : ''}>` +
    (o.title ? `<div class="mhead"><h3 id="mdTitle">${o.title}</h3><button class="mx" id="closeX" aria-label="ปิด">${icon('x', 26)}</button></div>` : '') +
    `<div class="mbody">${body}</div>` + (o.foot ? `<div class="mfoot">${o.foot}</div>` : '') + `</div>`;
  $('modal').classList.add('show'); lockPage();
  if(keep) $('modal').querySelector('.mbody').scrollTop = keep;
}
function closeModal(){ $('modal').classList.remove('show'); $('modal').innerHTML = ''; MD = null; unlockPage(); }
/* ปุ่ม X / แตะพื้นหลัง: ใช้ onClose ของหน้าต่างนั้น (ล้างข้อมูลที่ค้าง) ถ้ามี */
function modalClose(){ const f = MD && MD.onClose; if(f) f(); else closeModal(); }
$('modal').addEventListener('click', e => { if(e.target === $('modal') && MD && MD.backdrop) modalClose(); });
/* หน้าต่างยืนยัน/PIN ของระบบเอง (ไม่ใช้ confirm/prompt ของเบราว์เซอร์ เพราะบางโหมดเปิดไฟล์จะถูกบล็อก) */
let confirmCb = null, confirmNo = null, pinCb = null, pinMsg = '';
function askConfirm(o){
  confirmCb = o.onYes || null; confirmNo = o.onNo || null;
  openModal(`<h3>${esc(o.msg)}</h3>${o.sub ? `<p style="color:var(--mute);margin:0 0 6px">${esc(o.sub)}</p>` : ''}
    <div class="row"><button class="ghost" id="cfNo">กลับ</button><button class="pay" id="cfYes" style="background:${o.ok ? 'var(--ok)' : 'var(--bad)'}">${esc(o.yes || 'ยืนยัน')}</button></div>`);
}
/* ให้เจ้าของใส่รหัส (พนักงานกดยกเลิก/นำบิลกลับ) · ผ่าน → onOk(เจ้าของคนนั้น) · ช่องกรอก codeField (codepad.js) */
function askOwner(onOk, msg, err){
  pinCb = onOk; pinMsg = msg || '';
  openModal(`<h3>${icon('lock', 22)} ให้เจ้าของใส่รหัส</h3>${msg ? `<p style="color:var(--mute);margin:0 0 8px">${esc(msg)}</p>` : ''}
    ${codeField('pinIn', 'pinOk')}
    ${err ? `<p class="pinerr" role="alert">${esc(err)}</p>` : ''}
    <div class="row"><button class="ghost" id="pinNo">ยกเลิก</button><button class="pay" id="pinOk">ตกลง</button></div>`);
  $('pinIn').focus();
}
function checkPin(){
  const u = userByCode($('pinIn').value), cb = pinCb;
  if(u && u.role === 'owner'){ pinCb = null; if(cb) cb(u); }
  else askOwner(cb, pinMsg, u ? 'รหัสนี้ไม่ใช่รหัสเจ้าของ' : 'รหัสไม่ถูกต้อง');
}
