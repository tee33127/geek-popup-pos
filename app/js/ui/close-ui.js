/* ---------- เปิดร้าน (เงินทอนตั้งต้น) · ปิดร้าน (นับเงิน) · สำรอง / นำข้อมูลกลับ ---------- */

/* หลังเข้าระบบด้วยรหัส: รอบนี้ยังไม่มีเงินทอนตั้งต้น → ถาม · ข้ามได้ (ตอนนับเงินใส่ได้อีกครั้ง) */
function askFloat(){
  if(dayFloat(bizDate(new Date())) !== null) return;
  openModal(`<h3>${icon('cash', 22)} เปิดร้าน · เงินทอนตั้งต้น</h3>
    <p class="note2" style="margin-top:-6px">นับเงินในลิ้นชักก่อนเริ่มขาย ใช้เทียบตอนปิดร้าน</p>
    <div class="quick">${[0, 500, 1000, 2000].map(v => `<button data-fq="${v}">${v}</button>`).join('')}</div>
    <input class="num" id="floatIn" inputmode="numeric" pattern="[0-9]*" data-digits autocomplete="off" placeholder="เงินทอนตั้งต้น (บาท)">
    <div class="row payrow"><button class="ghost" id="floatSkip">ข้ามไปก่อน</button><button class="pay" id="floatOk" disabled>บันทึก</button></div>`);
  $('floatIn').oninput = floatInput;
}
function floatInput(){ const i = $('floatIn'); i.value = i.value.replace(/\D/g, ''); $('floatOk').disabled = i.value === ''; }
function floatSave(){
  const v = $('floatIn').value; if(v === '') return;
  if(!addCash({type:'open', float:Number(v)})){ toast('บันทึกไม่สำเร็จ', 'alert'); return; }
  closeModal(); toast(`เงินทอนตั้งต้น ${baht(Number(v))}`, 'check');
}

/* ---------- ปิดร้าน: เทียบเงินที่นับได้กับที่ควรมี (ตั้งต้น + ขายเงินสด) ---------- */
let closeDraft = null;
function openClose(){
  if(!needUser()) return;
  const date = bizDate(new Date());
  closeDraft = {date, float:dayFloat(date), counted:null};
  renderClose();
}
function renderClose(){
  const d = closeDraft, c = cashCount(d.date, d.float, 0), last = lastCash(d.date, 'close');
  openModal(`<div class="note2" style="margin-top:0"><b>${roundLabel(d.date, d.date)}</b></div>
    ${last ? `<div class="note2">${icon('alert', 14)} นับไปแล้วเมื่อ ${fmtDT(last.at)} โดย ${esc(last.by)} (${diffText(last.diff)}) · นับใหม่ได้ รายงานใช้ครั้งล่าสุด</div>` : ''}
    <div class="cashbox">
      <div class="crow"><span>เงินทอนตั้งต้น${d.float === null ? ' <small class="need">ยังไม่ได้ใส่</small>' : ''}</span><input class="cnum" id="clFloat" inputmode="numeric" pattern="[0-9]*" data-digits autocomplete="off" value="${d.float === null ? '' : d.float}" placeholder="0"></div>
      <div class="crow"><span>เงินสดจากการขาย <small>(${c.cashBills} บิล)</small></span><b>${baht(c.cashSales)}</b></div>
      <div class="crow tot"><span>ควรมีในลิ้นชัก</span><b id="clExp">${d.float === null ? '–' : baht(c.expected)}</b></div>
      <div class="crow"><span>นับได้จริง</span><input class="cnum" id="clCount" inputmode="numeric" pattern="[0-9]*" data-digits autocomplete="off" placeholder="นับเงินสดทั้งหมดในลิ้นชัก"></div>
    </div>
    <div class="cldiff" id="clDiff">&nbsp;</div>
    <input class="note" id="clNote" maxlength="100" placeholder="หมายเหตุ (ถ้าเงินไม่ตรง เช่น ทอนผิด / หยิบไปซื้อน้ำแข็ง 100)">`,
    {title:`${icon('cash', 22)} ปิดร้าน · นับเงิน`, key:'close', onClose: () => { closeDraft = null; closeModal(); },
     foot:`<div class="row payrow"><button class="ghost" id="clBack">กลับ</button><button class="pay" id="clSave" disabled>บันทึกการนับเงิน</button></div>`});
  $('clFloat').oninput = $('clCount').oninput = closeInput;
}
/* พิมพ์ตัวเลข: อัปเดตยอดโดยไม่วาดใหม่ (คีย์บอร์ดไม่หาย) */
function closeInput(){
  const d = closeDraft, f = $('clFloat'), n = $('clCount');
  f.value = f.value.replace(/\D/g, ''); n.value = n.value.replace(/\D/g, '');
  d.float = f.value === '' ? null : Number(f.value); d.counted = n.value === '' ? null : Number(n.value);
  const c = cashCount(d.date, d.float, d.counted || 0), ready = d.float !== null && d.counted !== null;
  $('clExp').textContent = d.float === null ? '–' : baht(c.expected);
  $('clDiff').className = 'cldiff ' + (!ready ? '' : c.diff === 0 ? 'ok' : c.diff < 0 ? 'bad' : 'over');
  $('clDiff').textContent = !ready ? (d.float === null ? 'ใส่เงินทอนตั้งต้นก่อน' : ' ') : diffText(c.diff);
  $('clSave').disabled = !ready;
}
function closeSave(){
  const d = closeDraft; if(!d || d.float === null || d.counted === null) return;
  const c = cashCount(d.date, d.float, d.counted);
  if(!addCash({type:'close', date:d.date, float:d.float, ...c, note:$('clNote').value.trim()})){ toast('บันทึกไม่สำเร็จ', 'alert'); return; }
  closeDraft = null;
  const last = SETTINGS.lastBackup;
  openModal(`<div class="big ${c.diff === 0 ? '' : 'warn'}">${icon(c.diff === 0 ? 'checkCircle' : 'alert', 64)}</div>
    <h3 style="text-align:center">บันทึกการนับเงินแล้ว</h3>
    <div class="change" style="color:${c.diff === 0 ? 'var(--ok)' : 'var(--bad)'}">${diffText(c.diff)}</div>
    <p class="note2" style="text-align:center">ควรมี ${baht(c.expected)} · นับได้ ${baht(c.counted)}</p>
    <div class="q2">ขั้นต่อไป: สำรองข้อมูลเก็บไว้นอกเครื่อง</div>
    <p class="note2" style="margin-top:0">${last ? `สำรองล่าสุด ${fmtDT(last)}` : 'เครื่องนี้ยังไม่เคยสำรองข้อมูล'}</p>
    <button class="pay" id="bkNow">${icon('download', 20)} สำรองข้อมูล</button>
    <button class="ghost wide" id="clLogout">ออกจากระบบ</button>
    <button class="linkbtn" id="closeX">ปิด</button>`);
}

/* ---------- สำรองข้อมูล: ไฟล์ JSON เดียว (ทุกตำแหน่งทำได้ · ปิดร้านแล้วควรทำทุกวัน) ---------- */
function openBackup(back){
  const text = JSON.stringify(backupData());
  exportFile({filename:backupName(), text, type:'application/json', back, title:'สำรองข้อมูล', onDone:markBackup,
    size:`${loadSales().length} บิล · ${Math.max(1, Math.round(text.length / 1024))} KB`,
    tip:'เก็บไฟล์ไว้นอกแท็บเล็ต เช่น แชร์เข้า Google Drive หรือ LINE ของเจ้าของ · แท็บเล็ตหายหรือเปลี่ยนเครื่อง ใช้ไฟล์นี้นำข้อมูลกลับได้ · ไฟล์มียอดขายและรายชื่อพนักงาน อย่าส่งให้คนนอก'});
}
const backupLabel = () => SETTINGS.lastBackup ? `สำรองล่าสุด ${fmtDT(SETTINGS.lastBackup)}` : 'ยังไม่เคยสำรองข้อมูล';

/* ---------- นำข้อมูลกลับ: เจ้าของ (ตั้งค่า) หรือเครื่องใหม่ก่อนตั้งเจ้าของ (หน้าเข้าใช้งาน) ---------- */
let RS = null;   // {inLogin, parsed, err}
/* settings เสีย: ไฟล์ต้องมีเจ้าของ ไม่งั้นนำกลับแล้วจะกลายเป็นหน้าตั้งค่าครั้งแรก (ใครก็สร้างเจ้าของได้) */
const restoreNoOwner = p => SETTINGS_BROKEN && !((p.data.settings || {}).users || []).some(u => u.role === 'owner');
function restoreHtml(){
  const r = RS, p = r.parsed, i = p && p.info, noOwner = !!p && r.inLogin && restoreNoOwner(p);
  let h = `<p class="note2" style="margin-top:0">เลือกไฟล์ geek-popup-backup-….json · บิลจะรวมกับของในเครื่อง ไม่มีอะไรถูกลบ</p>
    <input type="file" id="rsFile" accept=".json,application/json" class="rsfile">`;
  if(r.err) h += `<div class="ppmsg"><span style="color:var(--bad)">${icon('alert', 16)} ${esc(r.err)}</span></div>`;
  if(i) h += `<div class="cashbox">
      <div class="crow"><span>ไฟล์สำรองเมื่อ</span><b>${i.at ? fmtDT(i.at) : '–'}${i.by ? ` · ${esc(i.by)}` : ''}</b></div>
      <div class="crow"><span>บิลในไฟล์</span><b>${i.bills}${i.from ? ` <small>(${thDate(i.from)} – ${thDate(i.to)})</small>` : ''}</b></div>
      <div class="crow tot"><span>บิลที่เครื่องนี้ยังไม่มี</span><b>${i.newBills}</b></div>
      <div class="crow"><span>พนักงานในไฟล์</span><b>${i.users} คน</b></div></div>` +
    (noOwner ? `<p class="note2" style="color:var(--bad)">${icon('alert', 16)} ไฟล์นี้ไม่มีรายชื่อเจ้าของ ใช้แก้ข้อมูลตั้งค่าเสียไม่ได้ · เลือกไฟล์สำรองอื่น</p>`
      : r.inLogin ? `<p class="note2">${i.users ? 'จะใช้รายชื่อพนักงานและรหัสจากไฟล์ เข้าระบบด้วยรหัสเดิมได้เลย' : 'ไฟล์นี้ไม่มีรายชื่อพนักงาน ต้องตั้งเจ้าของใหม่หลังนำข้อมูลกลับ'}</p>`
      : `<label class="rscheck"><input type="checkbox" id="rsSettings"><span>ใช้รายชื่อพนักงาน รหัส เลข PromptPay และของหมด จากไฟล์นี้แทนของเครื่อง <small>รหัสของเครื่องนี้จะใช้ไม่ได้ ต้องเข้าด้วยรหัสในไฟล์</small></span></label>`);
  const foot = `<div class="row payrow"><button class="ghost" id="rsCancel">กลับ</button><button class="pay" id="rsApply" ${i && !noOwner ? '' : 'disabled'}>${i ? `นำข้อมูลกลับ · ${i.newBills} บิลใหม่` : 'เลือกไฟล์ก่อน'}</button></div>`;
  return {body:h, foot};
}
function openRestore(inLogin){
  if(!inLogin && !can('users')) return;
  RS = {inLogin:!!inLogin, parsed:null, err:''};
  renderRestore();
}
function renderRestore(){
  const title = `${icon('upload', 22)} นำข้อมูลกลับจากไฟล์สำรอง`, r = restoreHtml();
  if(RS.inLogin){ $('login').innerHTML = `<div class="lgbox lgwide"><h3>${title}</h3>${r.body}${r.foot}</div>`; }
  else openModal(r.body, {title, key:'restore', foot:r.foot, onClose: () => { RS = null; closeModal(); }});
}
/* อ่านข้อความในไฟล์ (แยกจาก FileReader ให้เทสต์เรียกตรงได้) */
function restoreText(text){
  const p = parseBackup(text);
  RS.parsed = p.ok ? p : null; RS.err = p.ok ? '' : p.why;
  renderRestore();
}
function restoreApply(){
  const r = RS; if(!r || !r.parsed || (r.inLogin && restoreNoOwner(r.parsed))) return;
  const withSettings = r.inLogin ? true : !!($('rsSettings') && $('rsSettings').checked);
  const res = applyBackup(r.parsed.data, withSettings);
  RS = null;
  toast(`นำข้อมูลกลับแล้ว · บิลใหม่ ${res.added}${res.updated ? ` · อัปเดต ${res.updated}` : ''}`, 'check');
  renderBuilder(); updateNext();
  if(r.inLogin || (withSettings && !loadSession())) return showLogin();   // รายชื่อเปลี่ยน → เข้าด้วยรหัสในไฟล์
  renderUser(); openSettings();
}
document.addEventListener('change', e => {
  if(e.target.id !== 'rsFile' || !RS) return;
  const f = e.target.files && e.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = () => restoreText(String(rd.result));
  rd.onerror = () => { RS.err = 'อ่านไฟล์ไม่ได้'; renderRestore(); };
  rd.readAsText(f);
});
$('login').addEventListener('click', e => {
  const id = (e.target.closest('button') || {}).id;
  if(id === 'rsApply') restoreApply();
  else if(id === 'rsCancel'){ RS = null; showLogin(); }
});
