/* ---------- ตั้งค่า (ปุ่มบนแถบหัว) · ทุกคน: ของหมด · เจ้าของ: เลข PromptPay, พนักงาน/รหัส, รหัสกู้คืน ---------- */
$('btnSettings').onclick = () => { if(needUser()) openSettings(); };

/* สวิตช์ มี/หมด · กดแล้วใช้ทันที ไม่ต้องกดบันทึก · หมด = ทั้งแถวเป็นสีเทาอ่อน */
function stockRow(kind, key, label, out){
  return `<div class="srow ${out ? 'out' : ''}"><span class="nm">${esc(label)}</span><span class="st">${out ? 'หมด' : 'มี'}</span>` +
    `<button class="sw ${out ? '' : 'on'}" role="switch" aria-checked="${!out}" aria-label="${esc(label)} ${out ? 'หมด' : 'มี'}" data-stock="${kind}" data-key="${esc(key)}"><span></span></button></div>`;
}
function openSettings(){
  const box = $('modal').querySelector('.box'), top = box && $('stockList') ? box.scrollTop : 0;
  const pp = SETTINGS.promptpay;
  let h = `<h3>${icon('settings', 22)} ตั้งค่า</h3><div id="stockList">
    <div class="q2">เมนู</div><div class="slist">` + CONFIG.menus.map(m => stockRow('menus', m.id, m.name, m.out)).join('') + '</div>';
  CONFIG.cats.forEach(c => {
    h += `<div class="q2">${esc(c.th || c.name)}</div><div class="slist">` +
      CONFIG.items.filter(it => it.cat === c.id).map(it => stockRow('items', it.name, it.th || it.name, it.out)).join('') + '</div>';
  });
  h += `</div><p class="note2">ปิดสวิตช์เมื่อของหมด ปุ่มบนหน้าขายจะเป็นสีเทาและกดไม่ได้ · มีของแล้วเปิดสวิตช์กลับ</p>`;
  if(can('promptpay')) h += `<div class="q2">เลข PromptPay</div>
    <div class="slist"><div class="srow"><span class="nm">${pp ? esc(PP.format(pp)) : '<span style="color:var(--bad)">ยังไม่ได้ตั้ง</span>'}</span><button class="ghost" id="ppOpen">${pp ? 'เปลี่ยน' : 'ตั้งเลข'}</button></div></div>`;
  if(can('users')) h += `<div class="q2">พนักงานและรหัส</div><div class="slist">` + users().map(u =>
      `<div class="srow"><span class="nm">${esc(u.name)}${USER && u.id === USER.id ? ' <small class="me">(คุณ)</small>' : ''}<small class="role ${u.role}">${ROLE_NAME[u.role]}</small></span>
        <button class="ghost" data-uedit="${esc(u.id)}">แก้ไข</button>${USER && u.id === USER.id ? '' : `<button class="ghost danger" data-udel="${esc(u.id)}">ลบ</button>`}</div>`).join('') +
      `</div><button class="ghost wide" id="usrAdd">${icon('user', 18)} เพิ่มพนักงาน</button>
    <div class="q2">รหัสกู้คืน</div><div class="slist"><div class="srow"><span class="nm">${recoveryHash() ? 'ตั้งไว้แล้ว' : '<span style="color:var(--bad)">ยังไม่มี</span>'}<small>ใช้ตั้งรหัสเจ้าของใหม่ถ้าลืม</small></span><button class="ghost" id="rcNew">สร้างใหม่</button></div></div>`;
  else h += `<p class="note2">${icon('lock', 14)} เลข PromptPay และรายชื่อพนักงาน เจ้าของเป็นคนตั้ง</p>`;
  h += `<div class="q2">ข้อมูล</div><div class="slist">
    <div class="srow"><span class="nm">สำรองข้อมูล<small style="${SETTINGS.lastBackup ? '' : 'color:var(--bad)'}">${backupLabel()}</small></span><button class="ghost" id="bkSet">สำรองตอนนี้</button></div>
    ${can('users') ? `<div class="srow"><span class="nm">นำข้อมูลกลับ<small>จากไฟล์สำรอง (เช่นเปลี่ยนเครื่อง)</small></span><button class="ghost" id="rsOpen">เลือกไฟล์</button></div>` : ''}</div>`;
  h += `<div class="row payrow"><button class="pay" id="closeX">ปิด</button></div>`;
  /* เวอร์ชันที่เครื่องนี้ใช้อยู่จริง (โหลดจาก cache เดียวกับโค้ด) · เทียบกับที่ Tee บอก ถ้ายังเก่า ปัดปิดแอปแล้วเปิดใหม่ */
  h += `<p class="appver">เวอร์ชัน ${typeof APP_VERSION === 'object' ? `${esc(APP_VERSION.v)} · build ${fmtDT(APP_VERSION.built)}` : 'ไม่ทราบ'}</p>`;
  openModal(h);
  if(top) $('modal').querySelector('.box').scrollTop = top;   // กดสวิตช์แล้วไม่เด้งกลับขึ้นบน
}
$('modal').addEventListener('click', e => {
  const ue = e.target.closest('[data-uedit]'); if(ue && can('users')) return openUserForm(ue.dataset.uedit);
  const ud = e.target.closest('[data-udel]');
  if(ud && can('users')){
    const u = users().find(x => x.id === ud.dataset.udel); if(!u) return;
    return askConfirm({msg:`ลบ ${u.name}?`, sub:'บิลเก่ายังแสดงชื่อนี้ตามเดิม แต่รหัสนี้จะเข้าใช้งานไม่ได้อีก', yes:'ลบ',
      onYes: () => { const err = deleteUser(u.id); toast(err || `ลบ ${u.name} แล้ว`, err ? 'alert' : 'check'); openSettings(); }, onNo: openSettings});
  }
  const b = e.target.closest('[data-stock]'); if(!b) return;
  const kind = b.dataset.stock, key = b.dataset.key;
  const now = kind === 'menus' ? MENU[key].out : ITEM[key].out;
  if(!setOut(kind, key, !now)){ toast('บันทึกไม่สำเร็จ', 'alert'); return; }
  openSettings(); renderBuilder();
});

/* ---------- พนักงาน: เพิ่ม / แก้ชื่อ ตำแหน่ง รหัส (เจ้าของเท่านั้น) ---------- */
let userForm = null;
function openUserForm(id){
  if(!can('users')) return;
  const u = id ? users().find(x => x.id === id) : null;
  userForm = {id: u ? u.id : null, role: u ? u.role : 'staff', msg:''};
  padNew('usr', {labels:[u ? 'รหัสใหม่' : `รหัส ${CODE_LEN} หลัก`, 'ใส่รหัสอีกครั้ง'], onEnter:userFormSave});   // เปลี่ยนตำแหน่งแล้ววาดใหม่ รหัสที่กดไว้ยังอยู่
  renderUserForm(u ? u.name : '');
}
function renderUserForm(name){
  const f = userForm;
  openModal(`<h3>${icon('user', 22)} ${f.id ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h3>
    <div class="q2">ชื่อ <small>(พิมพ์ในใบเสร็จ)</small></div><input class="num" id="usrName" style="text-align:left" maxlength="20" autocomplete="off" value="${esc(name)}">
    <div class="q2">ตำแหน่ง</div>
    <div class="row">${['staff', 'owner'].map(r => `<button class="opt ${f.role === r ? 'on' : ''}" data-urole="${r}">${ROLE_NAME[r]}</button>`).join('')}</div>
    <p class="note2">${f.role === 'owner' ? 'เจ้าของ: ยกเลิกบิล ดูยอดย้อนหลัง ตั้งเลข PromptPay และจัดการพนักงานได้' : 'พนักงาน: ขาย ดูยอดวันนี้ และกดของหมดได้ · ยกเลิกบิลต้องให้เจ้าของใส่รหัส'}</p>
    <div class="q2">${f.id ? 'เปลี่ยนรหัส <small>(เว้นว่างถ้าไม่เปลี่ยน)</small>' : `ตั้งรหัส ${CODE_LEN} หลัก`}</div>
    ${padHtml('usr')}
    <div class="ppmsg">${f.msg ? `<span style="color:var(--bad)">${icon('alert', 16)} ${esc(f.msg)}</span>` : ''}</div>
    <div class="row payrow"><button class="ghost" id="usrCancel">กลับ</button><button class="pay" id="usrSave">บันทึก</button></div>`);
}
$('modal').addEventListener('click', e => {
  const r = e.target.closest('[data-urole]'); if(!r || !userForm) return;
  userForm.role = r.dataset.urole; renderUserForm($('usrName').value);
});
function userFormSave(){
  const f = userForm; if(!f || !can('users')) return;
  const name = $('usrName').value, code = padVal('usr', 0), code2 = padVal('usr', 1);
  if(code !== code2) return padError('usr', 'รหัสสองช่องไม่ตรงกัน');
  f.msg = saveUser({id:f.id, name, role:f.role}, code);
  if(f.msg) return renderUserForm(name);
  if(USER && f.id === USER.id) USER = users().find(x => x.id === USER.id);   // แก้ชื่อตัวเอง → แถบหัวเปลี่ยนตาม
  userForm = null; renderUser(); toast('บันทึกแล้ว', 'check'); openSettings();
}
function recoveryNew(){
  askConfirm({msg:'สร้างรหัสกู้คืนใหม่?', sub:'รหัสกู้คืนเดิมจะใช้ไม่ได้อีก', yes:'สร้างใหม่', ok:true, onNo: openSettings, onYes: () => {
    const c = newRecovery(); if(!c){ toast('บันทึกไม่สำเร็จ', 'alert'); return openSettings(); }
    openModal(`<h3>${icon('lock', 22)} รหัสกู้คืนใหม่</h3><p class="note2">จดเก็บไว้ที่ปลอดภัย ใช้ตั้งรหัสเจ้าของใหม่ถ้าลืม · ระบบจะไม่แสดงอีก</p>
      <div class="recov">${fmtRecovery(c)}</div><div class="row payrow"><button class="pay" id="setBack">จดแล้ว</button></div>`);
  }});
}

/* ---------- เลข PromptPay ---------- */
function openPromptPay(){
  if(!can('promptpay')) return;
  openModal(`<h3>${icon('settings', 22)} เลข PromptPay ของร้าน</h3>
    <p class="note2" style="margin:0 0 8px">เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/ผู้เสียภาษี 13 หลัก ที่ผูกพร้อมเพย์ไว้ · เก็บในเครื่องนี้เท่านั้น</p>
    <input class="num" id="ppIn" inputmode="numeric" pattern="[0-9]*" data-digits autocomplete="off" maxlength="15" placeholder="ยังไม่ได้ตั้ง" value="${esc(SETTINGS.promptpay || '')}">
    <div id="ppMsg" class="ppmsg"></div>
    <div id="ppPrev"></div>
    <div class="row payrow"><button class="ghost" id="setBack">กลับ</button><button class="pay" id="setSave">บันทึก</button></div>`);
  const i = $('ppIn'); i.oninput = settingsCheck; settingsCheck();
}
/* เช็กเลขระหว่างพิมพ์ · ใช้ได้ → แสดง QR ทดสอบ 1 บาท ให้สแกนดูชื่อบัญชีก่อน */
function settingsCheck(){
  const id = PP.clean($('ppIn').value), bad = id ? PP.problem(id) : '';
  $('ppMsg').innerHTML = !id ? (SETTINGS.promptpay ? `<span style="color:var(--bad)">บันทึกแบบว่างจะลบเลขเดิม หน้าชำระเงินจะไม่แสดง QR</span>` : '')
    : bad ? `<span style="color:var(--bad)">${icon('alert', 16)} ${esc(bad)}</span>`
    : `<span style="color:var(--ok)">${icon('check', 16)} ${PP.type(id) === 'phone' ? 'เบอร์มือถือ' : PP.type(id) === 'tax' ? 'เลขบัตร/ผู้เสียภาษี' : 'e-Wallet'} ${esc(PP.format(id))}</span>`;
  $('ppPrev').innerHTML = id && !bad ? `<div class="ppqr">${qrSvg(PP.payload(id, 1), 180)}
    <p class="note2">QR ทดสอบ ฿1 · สแกนด้วยแอปธนาคาร แล้วดูว่า<b>ชื่อบัญชีถูกต้อง</b> (ไม่ต้องกดโอน)</p></div>` : '';
  $('setSave').disabled = !!bad;
}
function settingsSave(){
  if(!can('promptpay')) return;
  const id = PP.clean($('ppIn').value);
  if(id && PP.problem(id)) return;
  const next = {...SETTINGS}; if(id) next.promptpay = id; else delete next.promptpay;
  if(!saveSettings(next)){ toast('บันทึกไม่สำเร็จ', 'alert'); return; }
  toast(id ? 'บันทึกเลข PromptPay แล้ว' : 'ลบเลข PromptPay แล้ว', 'check');
  openSettings();
}
