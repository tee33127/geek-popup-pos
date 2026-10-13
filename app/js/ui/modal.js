/* ---------- ตัวช่วยหน้าจอ: $, toast, modal, ยืนยัน, รหัสเจ้าของ ---------- */
const $ = id => document.getElementById(id);

function toast(msg, ic){ const t = $('toast'); t.innerHTML = (ic ? icon(ic, 18) + ' ' : '') + esc(msg); t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(()=> t.style.display='none', 1800); }

/* ---------- Modal ---------- */
function openModal(html, wide){ $('modal').innerHTML = `<div class="box ${wide?'wide':''}">${html}</div>`; $('modal').classList.add('show'); }
function closeModal(){ $('modal').classList.remove('show'); $('modal').innerHTML = ''; }
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
