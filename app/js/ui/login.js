/* ---------- หน้าเข้าใช้งาน (เต็มจอ ทับทุกอย่าง) ----------
   ครั้งแรก (ยังไม่มีเจ้าของ) → ตั้งชื่อ + รหัสเจ้าของ → แสดงรหัสกู้คืนให้จด
   ปกติ → แป้นตัวเลข ใส่รหัสแล้วกด เข้าสู่ระบบ (ไม่เข้าเองเมื่อครบ 4 หลัก Tee 2026-10-12) · ลืมรหัสเจ้าของ → ใส่รหัสกู้คืน → ตั้งรหัสใหม่ */
let LG = {mode:'code', buf:'', msg:''};
let LOGIN_HINT = '';   // DEMO ใส่คำใบ้รหัส

function showLogin(){
  closeModal();
  /* settings เสีย: ห้ามขึ้น "ตั้งค่าครั้งแรก" (ใครก็สร้างเจ้าของได้) → หน้า "ข้อมูลตั้งค่าเสีย" (Tee 2026-10-12) */
  LG = {mode: SETTINGS_BROKEN ? 'broken' : owners().length ? 'code' : 'setup', buf:'', msg:''};
  renderLogin(); $('login').classList.add('show'); renderUser();
}
function hideLogin(){ $('login').classList.remove('show'); $('login').innerHTML = ''; renderUser(); updateNext(); }

function keypad(len){
  const dots = Array.from({length:len}, (_, i) => `<i class="${i < LG.buf.length ? 'on' : ''}"></i>`).join('');
  return `<div class="dots ${len > CODE_LEN ? 'long' : ''}">${dots}</div><div class="lgmsg">${esc(LG.msg)}</div>
    <div class="keypad">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-kp="${n}">${n}</button>`).join('')}
    <button data-kp="clear" class="kfn">ล้าง</button><button data-kp="0">0</button><button data-kp="back" class="kfn" aria-label="ลบ">⌫</button></div>
    <button class="pay" id="lgGo" ${LG.buf.length === len ? '' : 'disabled'}>${LG.mode === 'recover' ? 'ตรวจรหัสกู้คืน' : 'เข้าสู่ระบบ'}</button>`;
}
function renderLogin(){
  const head = `<div class="lgtitle">Geek <span>Pop-up</span> POS</div>`;
  let h = '';
  if(LG.mode === 'code') h = `${head}<p class="lgsub">ใส่รหัสเพื่อเข้าใช้งาน</p>${keypad(CODE_LEN)}
    <button class="linkbtn" id="lgForgot">ลืมรหัสเจ้าของ?</button>${LOGIN_HINT ? `<p class="note2">${esc(LOGIN_HINT)}</p>` : ''}`;
  else if(LG.mode === 'recover') h = `${head}<p class="lgsub">ใส่รหัสกู้คืน ${RECOVERY_LEN} หลัก ที่จดไว้ตอนตั้งเครื่อง</p>${keypad(RECOVERY_LEN)}
    <button class="linkbtn" id="lgBack">กลับ</button>`;
  else if(LG.mode === 'broken'){
    const rc = !!recoveryHash();
    h = `${head}
    <div class="lgform">
      <p class="lgsub lgbad">${icon('alert', 20)} <b>ข้อมูลตั้งค่าเสีย</b></p>
      <p class="note2">รายชื่อพนักงาน รหัส และเลข PromptPay ในเครื่องนี้อ่านไม่ได้ · <b>ยอดขายยังอยู่ครบ</b> · เก็บข้อมูลเดิมไว้แล้ว ไม่ได้ลบ</p>
      <button class="pay" id="lgRestore">${icon('upload', 20)} นำข้อมูลกลับจากไฟล์สำรอง</button>
      <button class="ghost wide" id="lgRebuild" ${rc ? '' : 'disabled'}>เริ่มตั้งค่าใหม่ · ใช้รหัสกู้คืน ${RECOVERY_LEN} หลัก</button>
      ${rc ? '' : '<p class="note2" style="color:var(--bad)">เครื่องนี้ไม่มีรหัสกู้คืน</p>'}
      <p class="note2">ไม่มีทั้งไฟล์สำรองและรหัสกู้คืน? ติดต่อผู้ดูแล (Tee)</p>
    </div>`;
  }
  else if(LG.mode === 'setup' || LG.mode === 'reset') h = `${head}
    <p class="lgsub">${LG.mode === 'setup' ? 'ตั้งค่าครั้งแรก · สร้างบัญชีเจ้าของร้าน' : `ตั้งรหัสใหม่ให้ ${esc(owners()[0].name)}`}</p>
    <div class="lgform">
      ${LG.mode === 'setup' ? `<label>ชื่อ<input id="lgName" maxlength="20" autocomplete="off" placeholder="เช่น ตี๋"></label>` : ''}
      <label>รหัส ${CODE_LEN} หลัก<input id="lgCode" type="password" inputmode="numeric" maxlength="${CODE_LEN}" autocomplete="off"></label>
      <label>ใส่รหัสอีกครั้ง<input id="lgCode2" type="password" inputmode="numeric" maxlength="${CODE_LEN}" autocomplete="off"></label>
      <div class="lgmsg">${esc(LG.msg)}</div>
      <button class="pay" id="lgSave">${LG.mode === 'setup' ? 'สร้างบัญชีเจ้าของ' : 'ตั้งรหัสใหม่'}</button>
      ${LG.mode === 'reset' ? '<button class="linkbtn" id="lgBack">ยกเลิก</button>' : `<button class="linkbtn" id="lgRestore">${icon('upload', 16)} เครื่องใหม่? นำข้อมูลกลับจากไฟล์สำรอง</button>`}
    </div>`;
  else if(LG.mode === 'setupDone') h = `${head}
    <div class="lgform">
      <p class="lgsub">${icon('alert', 20)} <b>จดรหัสกู้คืนนี้เก็บไว้</b> ใช้ตั้งรหัสเจ้าของใหม่ถ้าลืม · ระบบจะไม่แสดงอีก</p>
      <div class="recov">${fmtRecovery(LG.recovery)}</div>
      <button class="pay" id="lgDone">จดแล้ว เข้าใช้งาน</button>
    </div>`;
  $('login').innerHTML = `<div class="lgbox">${h}</div>`;
  const f = $('lgName') || $('lgCode'); if(f) f.focus();
}

function keyIn(k){
  const len = LG.mode === 'recover' ? RECOVERY_LEN : CODE_LEN;
  if(k === 'back') LG.buf = LG.buf.slice(0, -1);
  else if(k === 'clear') LG.buf = '';
  else if(LG.buf.length < len) LG.buf += k;
  LG.msg = '';
  renderLogin();
}
/* กด เข้าสู่ระบบ (หรือ Enter) */
function keySubmit(){
  const len = LG.mode === 'recover' ? RECOVERY_LEN : CODE_LEN;
  if(LG.buf.length !== len) return;
  if(LG.mode === 'code'){
    const u = userByCode(LG.buf);
    if(u){ signIn(u); hideLogin(); toast(`สวัสดี ${u.name}`, 'check'); askFloat(); return; }
    LG.msg = 'รหัสไม่ถูกต้อง';
  } else if(LG.mode === 'recover'){
    if(recoveryOk(LG.buf)){ LG = LG.after === 'setup' ? {mode:'setup', buf:'', msg:'', recovered:true} : {mode:'reset', buf:'', msg:''}; renderLogin(); return; }
    LG.msg = 'รหัสกู้คืนไม่ถูกต้อง';
  }
  LG.buf = ''; renderLogin();
}
function loginSave(){
  const code = $('lgCode').value, code2 = $('lgCode2').value;
  const err = !codeOk(code) ? `รหัสต้องเป็นตัวเลข ${CODE_LEN} หลัก` : code !== code2 ? 'รหัสสองช่องไม่ตรงกัน' : '';
  if(err){ LG.msg = err; return renderLogin(); }
  if(LG.mode === 'setup'){
    if(SETTINGS_BROKEN && !LG.recovered) return showLogin();   // settings เสีย: ตั้งใหม่ได้หลังผ่านรหัสกู้คืนเท่านั้น
    const name = $('lgName').value;
    const e2 = saveUser({name, role:'owner'}, code); if(e2){ LG.msg = e2; return renderLogin(); }
    const rc = newRecovery();
    signIn(owners()[0]);
    LG = {mode:'setupDone', buf:'', msg:'', recovery: rc || ''}; renderLogin();
  } else {
    const o = owners()[0], e2 = saveUser({...o}, code); if(e2){ LG.msg = e2; return renderLogin(); }
    signIn(users().find(x => x.id === o.id)); hideLogin(); toast('ตั้งรหัสเจ้าของใหม่แล้ว', 'check'); askFloat();
  }
}
$('login').onclick = e => {
  const k = e.target.closest('[data-kp]'); if(k) return keyIn(k.dataset.kp);
  const id = (e.target.closest('button') || {}).id;
  if(id === 'lgForgot'){ LG = {mode:'recover', buf:'', msg: recoveryHash() ? '' : 'เครื่องนี้ไม่มีรหัสกู้คืน'}; renderLogin(); }
  else if(id === 'lgBack') showLogin();
  else if(id === 'lgRebuild' && recoveryHash()){ LG = {mode:'recover', buf:'', msg:'', after:'setup'}; renderLogin(); }
  else if(id === 'lgGo') keySubmit();
  else if(id === 'lgSave') loginSave();
  else if(id === 'lgDone'){ hideLogin(); askFloat(); }
  else if(id === 'lgRestore') openRestore(true);
};
document.addEventListener('keydown', e => {
  if(!$('login').classList.contains('show') || !(LG.mode === 'code' || LG.mode === 'recover')) return;
  if(/^\d$/.test(e.key)) keyIn(e.key); else if(e.key === 'Backspace') keyIn('back'); else if(e.key === 'Enter') keySubmit();
});

/* ---------- ปุ่มผู้ใช้บนแถบหัว: ชื่อคนที่เข้าอยู่ · กด = ออกจากระบบ ---------- */
function renderUser(){
  const b = $('btnUser');
  b.style.display = USER ? '' : 'none';
  b.innerHTML = USER ? `${icon('user', 18)} ${esc(USER.name)}${USER.role === 'owner' ? ' <small>(เจ้าของ)</small>' : ''}` : '';
}
$('btnUser').onclick = () => askConfirm({msg:`ออกจากระบบ ${USER ? USER.name : ''}?`,
  sub: cart.length ? 'ออเดอร์ที่ยังไม่ได้ชำระเงินจะถูกล้าง' : 'คนต่อไปต้องใส่รหัสเพื่อเข้าใช้งาน', yes:'ออกจากระบบ',
  onYes: () => { cart = []; promo = null; resetSel(); renderBuilder(); renderCart(); signOut(); showLogin(); }});

/* ต้องเข้าระบบก่อนทำสิ่งที่บันทึกชื่อ · หลุดเพราะขึ้นรอบขายใหม่ → กลับหน้าเข้าใช้งาน (ตะกร้ายังอยู่) */
function needUser(){ if(loadSession()) return true; showLogin(); return false; }
setInterval(() => { if(USER && !loadSession()) showLogin(); }, 60000);
storeReady.then(() => { if(loadSession()) renderUser(); else showLogin(); });
