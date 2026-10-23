/* ---------- ลิ้นชักเก็บเงิน: หน้าจอ (Tee 2026-10-23) · คำสั่งเปิดอยู่ใน print.js (kickDrawer ต่อคิวงานพิมพ์) ----------
   เปิดเอง: ยืนยันรับเงินสด (ก่อนตั๋วครัว) · เปิดร้าน (ถามเงินทอนตั้งต้น) · ปิดร้าน/นับเงิน · PromptPay / ไทยช่วยไทย ไม่เปิด
   เปิดด้วยปุ่ม "เปิดลิ้นชัก" บนแถบหัว (ทุกคน) ต้องเลือกเหตุผล · ทดสอบจากหน้าตั้งค่า (เจ้าของ)
   ไม่เปิด (ไม่ได้เชื่อม / ปริ้นเตอร์ไม่พร้อม) = ขายต่อได้ บอก DRAWER_MSG ให้ใช้กุญแจ
   log: ทุกครั้งที่แอปสั่งเปิด ยกเว้นตอนขาย (บิลคือบันทึกอยู่แล้ว) เก็บต่อท้ายในบันทึกเงินสด (cash.js) {type:'drawer', reason, ok, why} → อยู่ในไฟล์สำรองด้วย
   เบราว์เซอร์ที่ไม่มี WebUSB เปิดลิ้นชักไม่ได้เลย: ไม่มีปุ่มบนแถบหัว ไม่บันทึก log แต่ยังบอก DRAWER_MSG ตอนรับเงินสด/เปิด/ปิดร้าน */
const DRAWER_WHY = {change:'แลกเงิน', count:'นับเงิน', other:'อื่นๆ', open:'เปิดร้าน', close:'ปิดร้าน / นับเงิน', test:'ทดสอบ'};
const DRAWER_ASK = ['change', 'count', 'other'];   // เหตุผลที่พนักงานเลือกตอนกดปุ่มบนแถบหัว
const DRAWER_HINT = {nocon:'ยังไม่ได้เชื่อมปริ้นเตอร์', trouble:'ปริ้นเตอร์ไม่พร้อม (ฝาเปิดหรือกระดาษหมด)', timeout:'ปริ้นเตอร์ไม่ตอบ', error:'ส่งไปปริ้นเตอร์ไม่ได้'};
const drawerFailHtml = r => `<span>${icon('alert', 18)} ${esc(DRAWER_MSG)}${DRAWER_HINT[r] ? ` · ${esc(DRAWER_HINT[r])}` : ''}</span>`;
/* แถบในหน้าต่าง (หน้าสำเร็จ / เงินทอนตั้งต้น / นับเงิน) · ว่าง = ซ่อน (.prstatus:empty) */
const drawerLine = () => '<div id="drStatus" class="prstatus" role="status" aria-live="polite"></div>';
function drawerShow(r){
  const el = $('drStatus'); if(!el) return false;
  el.className = 'prstatus' + (r === 'ok' || r === 'wait' ? '' : ' warn');
  el.innerHTML = r === 'ok' || r === 'wait' ? '' : drawerFailHtml(r);
  return true;
}
/* สั่งเปิดแล้วเรียก done(ผล) · ไม่ได้เชื่อม = รู้ผลทันที (บอกพร้อมหน้าต่างที่เพิ่งเปิด ไม่รอ) */
function drawerRun(why, done){
  if(!usbPrinter || !usbPrinter.connected){ kickDrawer(why); done('nocon'); return; }
  kickDrawer(why).then(done);
}
/* สั่งเปิด + บันทึก (ไม่ใช่ตอนขาย) · done(ผล) ok / nocon / trouble / timeout / error */
function drawerOpen(reason, done){
  drawerRun(DRAWER_WHY[reason] || reason, r => {
    if(usbPrinter) addCash({type:'drawer', reason, ok:r === 'ok', ...(r !== 'ok' && {why:r})});
    done(r);
  });
}
/* รับเงินสด: เปิดก่อนตั๋วครัว (เรียกก่อน printSale) · แสดงผลบนหน้าสำเร็จของบิลนี้ · ไปออเดอร์ถัดไปแล้ว = ข้อความลอย */
function saleDrawer(s){
  if(s.method !== 'cash' || !drawerOn()) return;
  drawerRun(`ขายเงินสด #${pad(s.no, 3)}`, r => {
    const here = lastSale && lastSale.id === s.id && drawerShow(r);
    if(!here && r !== 'ok') toast(`${DRAWER_MSG} (#${pad(s.no, 3)})`, 'alert', 6000);
  });
}
/* เปิดร้าน / ปิดร้าน: เปิดให้ 1 ครั้งต่อการเปิดหน้าต่าง ผลแสดงในหน้าต่างนั้น */
function autoDrawer(reason){
  if(!drawerOn()) return;
  drawerOpen(reason, r => { if(!drawerShow(r) && r !== 'ok') toast(DRAWER_MSG, 'alert', 6000); });
}

/* ---------- ปุ่มบนแถบหัว (ปุ่มรอง) · แสดงเมื่อเบราว์เซอร์มี WebUSB และเจ้าของเปิดใช้ลิ้นชัก ---------- */
function renderDrawerBtn(){
  const b = $('btnDrawer'); if(!b) return;
  b.style.display = usbPrinter && drawerOn() ? '' : 'none';
  b.innerHTML = icon('cash', 18) + ' เปิดลิ้นชัก';
}
$('btnDrawer').onclick = () => { if(needUser()) openDrawerAsk(); };
function openDrawerAsk(){
  openModal(`<p class="note2" style="margin:0 0 var(--s2)">เลือกเหตุผล ลิ้นชักจะเปิดทันที · ระบบบันทึกชื่อและเวลาไว้</p>
    <div class="row">${DRAWER_ASK.map(k => `<button class="opt" data-drwhy="${k}">${DRAWER_WHY[k]}</button>`).join('')}</div>
    <p class="note2">รับเงินสด เปิดร้าน และปิดร้าน ลิ้นชักเปิดเอง ไม่ต้องกดปุ่มนี้</p>`, {title:`${icon('cash', 22)} เปิดลิ้นชัก`, key:'drawer'});
}
function drawerAsked(reason){
  closeModal();
  drawerOpen(reason, r => toast(r === 'ok' ? `เปิดลิ้นชักแล้ว · ${DRAWER_WHY[reason]}` : `${DRAWER_MSG}${DRAWER_HINT[r] ? ' · ' + DRAWER_HINT[r] : ''}`, r === 'ok' ? 'check' : 'alert', r === 'ok' ? 1400 : 6000));
}

/* ---------- ตั้งค่า (เจ้าของ): ใช้/ไม่ใช้ · ทดสอบ · ขั้นสูง = ขาที่ต่อ (2 / 5) ---------- */
let drawerAdvOpen = false;   // เปลี่ยนขาแล้ววาดหน้าตั้งค่าใหม่ ส่วนขั้นสูงยังเปิดค้าง
function drawerSettingsHtml(){
  const on = drawerOn(), adv = drawerAdvOpen; drawerAdvOpen = false;
  return `<div class="q2">ลิ้นชักเก็บเงิน</div>
    <div class="slist"><div class="srow"><span class="nm">ใช้ลิ้นชักเก็บเงิน<small>${on ? 'เปิดเองเมื่อรับเงินสด เปิดร้าน และปิดร้าน · มีปุ่ม "เปิดลิ้นชัก" บนแถบหัว' : 'ปิดอยู่ · ลิ้นชักไม่เปิดเอง ไม่มีปุ่มบนแถบหัว'}</small></span>` +
      `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="ใช้ลิ้นชักเก็บเงิน" id="drSwitch"><span></span></button></div>` +
    (on ? `<div class="srow"><span class="nm">ทดสอบ<small>ต่อปริ้นเตอร์แล้ว กดแล้วลิ้นชักต้องเปิด</small></span><button class="ghost" id="drTest">ทดสอบเปิดลิ้นชัก</button></div>` : '') + `</div>` +
    (on ? `<details class="plog" id="drAdv"${adv ? ' open' : ''}><summary>ขั้นสูง</summary>
      <div class="q2" style="margin-top:0">ขาที่ต่อลิ้นชัก</div>
      <div class="row">${[2, 5].map(p => `<button class="opt ${drawerPin() === p ? 'on' : ''}" data-drpin="${p}" aria-pressed="${drawerPin() === p}">ขา ${p}${p === 2 ? ' (ปกติ)' : ''}</button>`).join('')}</div>
      <p class="note2">เปลี่ยนเฉพาะเมื่อกดทดสอบแล้วลิ้นชักไม่เปิด (ลิ้นชักบางรุ่นต่อขา 5)</p></details>` : '');
}
function setDrawer(next){
  if(!can('drawer')) return false;
  if(!saveSettings(next)){ toast('บันทึกไม่สำเร็จ', 'alert'); return false; }
  renderDrawerBtn(); return true;
}
$('modal').addEventListener('click', e => {
  const w = e.target.closest('[data-drwhy]'); if(w) return drawerAsked(w.dataset.drwhy);
  const p = e.target.closest('[data-drpin]');
  if(p){ const n = Number(p.dataset.drpin), next = {...SETTINGS}; if(n === 5) next.drawerPin = 5; else delete next.drawerPin; if(setDrawer(next)){ toast(`ลิ้นชักต่อขา ${n}`, 'check'); drawerAdvOpen = true; openSettings(); } return; }
  const id = (e.target.closest('button') || {}).id;
  if(id === 'drSwitch'){ const next = {...SETTINGS}; if(drawerOn()) next.drawer = false; else delete next.drawer; if(setDrawer(next)){ toast(drawerOn() ? 'ใช้ลิ้นชักเก็บเงิน' : 'ไม่ใช้ลิ้นชักเก็บเงิน', 'check'); openSettings(); } }
  else if(id === 'drTest' && can('drawer')) drawerOpen('test', r => toast(r === 'ok' ? `ส่งคำสั่งเปิดลิ้นชักแล้ว (ขา ${drawerPin()}) · ไม่เปิด ลองเปลี่ยนขาในขั้นสูง` : `${DRAWER_MSG}${DRAWER_HINT[r] ? ' · ' + DRAWER_HINT[r] : ''}`, r === 'ok' ? 'check' : 'alert', 6000));
});

/* ---------- สรุปยอด แท็บชำระเงิน: การเปิดลิ้นชักของช่วงที่เลือก (ใคร เวลา เหตุผล) ---------- */
const drawerLog = () => cashLog().filter(c => c.type === 'drawer' && c.date >= REP.from && c.date <= REP.to).sort((a, b) => b.at.localeCompare(a.at));
const drawerResult = c => c.ok ? 'เปิดแล้ว' : 'ไม่เปิด' + (DRAWER_HINT[c.why] ? ` (${DRAWER_HINT[c.why]})` : '');
function drawerTable(){
  const rows = drawerLog(), multi = REP.from !== REP.to;
  return `<div class="sec2">เปิดลิ้นชัก</div>` + (rows.length
    ? tbl([['เวลา'], ['เหตุผล'], ['คนเปิด'], ['ผล']], rows.map(c => [multi ? fmtDT(c.at) : fmtDT(c.at).slice(-5), esc(DRAWER_WHY[c.reason] || c.reason), esc(c.by), c.ok ? 'เปิดแล้ว' : `<span style="color:var(--bad)">${esc(drawerResult(c))}</span>`]))
    : `<p class="note2">ยังไม่มีการเปิดลิ้นชักด้วยปุ่มหรือตอนเปิด/ปิดร้านในช่วงนี้</p>`) +
    `<p class="note2">ตอนรับเงินสด ลิ้นชักเปิดเองและไม่บันทึกแยก (ดูได้จากบิลเงินสด)</p>`;
}
const drawerCsv = () => { const rows = drawerLog(); return rows.length ? [[], ['วันที่รอบขาย', 'เวลาเปิดลิ้นชัก', 'เหตุผล', 'คนเปิด', 'ผล']].concat(rows.map(c => [c.date, fmtDT(c.at), DRAWER_WHY[c.reason] || c.reason, c.by, drawerResult(c)])) : []; };
renderDrawerBtn();
