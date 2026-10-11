/* ---------- ตั้งค่า (เปิดจากหน้าสรุปยอด ซึ่งผ่าน PIN แล้ว) ---------- */
function openSettings(){
  openModal(`<h3>${icon('settings', 22)} ตั้งค่า</h3>
    <div class="q2">เลข PromptPay ของร้าน</div>
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
  renderSummary();
}
