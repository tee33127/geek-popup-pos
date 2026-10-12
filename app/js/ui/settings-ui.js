/* ---------- ตั้งค่า (ปุ่มบนแถบหัว ต้องใส่ PIN): ของหมด + เลข PromptPay ---------- */
$('btnSettings').onclick = () => askPin(openSettings);

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
  h += `</div><p class="note2">ปิดสวิตช์เมื่อของหมด ปุ่มบนหน้าขายจะเป็นสีเทาและกดไม่ได้ · มีของแล้วเปิดสวิตช์กลับ</p>
    <div class="q2">เลข PromptPay</div>
    <div class="slist"><div class="srow"><span class="nm">${pp ? esc(PP.format(pp)) : '<span style="color:var(--bad)">ยังไม่ได้ตั้ง</span>'}</span><button class="ghost" id="ppOpen">${pp ? 'เปลี่ยน' : 'ตั้งเลข'}</button></div></div>
    <div class="row payrow"><button class="pay" id="closeX">ปิด</button></div>`;
  openModal(h);
  if(top) $('modal').querySelector('.box').scrollTop = top;   // กดสวิตช์แล้วไม่เด้งกลับขึ้นบน
}
$('modal').addEventListener('click', e => {
  const b = e.target.closest('[data-stock]'); if(!b) return;
  const kind = b.dataset.stock, key = b.dataset.key;
  const now = kind === 'menus' ? MENU[key].out : ITEM[key].out;
  if(!setOut(kind, key, !now)){ toast('บันทึกไม่สำเร็จ', 'alert'); return; }
  openSettings(); renderBuilder();
});

/* ---------- เลข PromptPay ---------- */
function openPromptPay(){
  openModal(`<h3>${icon('settings', 22)} เลข PromptPay ของร้าน</h3>
    <p class="note2" style="margin:0 0 8px">เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/ผู้เสียภาษี 13 หลัก ที่ผูกพร้อมเพย์ไว้ · เก็บในเครื่องนี้เท่านั้น</p>
    <input class="num" id="ppIn" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="ยังไม่ได้ตั้ง" value="${esc(PP.format(SETTINGS.promptpay || ''))}">
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
  const id = PP.clean($('ppIn').value);
  if(id && PP.problem(id)) return;
  const next = {...SETTINGS}; if(id) next.promptpay = id; else delete next.promptpay;
  if(!saveSettings(next)){ toast('บันทึกไม่สำเร็จ', 'alert'); return; }
  toast(id ? 'บันทึกเลข PromptPay แล้ว' : 'ลบเลข PromptPay แล้ว', 'check');
  openSettings();
}
