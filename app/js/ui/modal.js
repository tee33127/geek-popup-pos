/* ---------- ตัวช่วยหน้าจอ: $, toast, modal, ยืนยัน, PIN ---------- */
const $ = id => document.getElementById(id);

function toast(msg, ic){ const t = $('toast'); t.innerHTML = (ic ? icon(ic, 18) + ' ' : '') + esc(msg); t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(()=> t.style.display='none', 1800); }

/* ---------- Modal ---------- */
function openModal(html, wide){ $('modal').innerHTML = `<div class="box ${wide?'wide':''}">${html}</div>`; $('modal').classList.add('show'); }
function closeModal(){ $('modal').classList.remove('show'); $('modal').innerHTML = ''; }
/* หน้าต่างยืนยัน/PIN ของระบบเอง (ไม่ใช้ confirm/prompt ของเบราว์เซอร์ เพราะบางโหมดเปิดไฟล์จะถูกบล็อก) */
let confirmCb = null, confirmNo = null, pinCb = null;
function askConfirm(o){
  confirmCb = o.onYes || null; confirmNo = o.onNo || null;
  openModal(`<h3>${esc(o.msg)}</h3>${o.sub ? `<p style="color:var(--mute);margin:0 0 6px">${esc(o.sub)}</p>` : ''}
    <div class="row"><button class="ghost" id="cfNo">กลับ</button><button class="pay" id="cfYes" style="background:${o.ok ? 'var(--ok)' : 'var(--bad)'}">${esc(o.yes || 'ยืนยัน')}</button></div>`);
}
function askPin(onOk, err){
  pinCb = onOk;
  openModal(`<h3>ใส่ PIN</h3>
    <input class="num" id="pinIn" type="password" inputmode="numeric" autocomplete="off" maxlength="8" style="text-align:center;letter-spacing:8px">
    ${err ? `<p style="color:var(--bad);margin:8px 0 0">${esc(err)}</p>` : ''}
    <div class="row"><button class="ghost" id="pinNo">ยกเลิก</button><button class="pay" id="pinOk">ตกลง</button></div>`);
  const i = $('pinIn'); i.focus(); i.onkeydown = e => { if(e.key === 'Enter') checkPin(); };
}
function checkPin(){
  const v = $('pinIn').value;
  if(v === CONFIG.pin){ const cb = pinCb; pinCb = null; if(cb) cb(); }
  else askPin(pinCb, 'PIN ไม่ถูกต้อง');
}
