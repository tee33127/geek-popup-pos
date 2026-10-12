/* ---------- Summary · เจ้าของดูได้ทุกช่วง · พนักงานดูได้เฉพาะรอบขายวันนี้ ---------- */
$('btnSummary').onclick = () => {
  if(!needUser()) return;
  const r = can('pastReports') ? defaultRound() : {date:bizDate(new Date()), fallback:false};
  REP.from = REP.to = r.date; REP.fb = r.fallback; REP.range = r.fallback ? null : 'today'; REP.tab = 'items'; renderSummary();
};

let repCsv = null;

const shareCell = p => `${p}%<div class="share"><i style="width:${Math.min(100, p)}%"></i></div>`;
function tbl(head, rows, foot){
  const c = (cells, tag) => cells.map((x, i) => `<${tag} class="${head[i][1] ? 'n' : ''}">${x}</${tag}>`).join('');
  return `<table><tr>${c(head.map(h => h[0]), 'th')}</tr>${rows.map(r => `<tr>${c(r, 'td')}</tr>`).join('')}${foot ? `<tr class="tot">${c(foot, 'td')}</tr>` : ''}</table>`;
}
const EMPTY = '<p class="note2" style="padding:14px 0">ยังไม่มีข้อมูลในช่วงนี้</p>';

function tabItems(R){
  const mi = id => CONFIG.menus.findIndex(m => m.id === id);
  const rows = Object.values(R.items).sort((a, b) => mi(a.menu) - mi(b.menu) || a.name.localeCompare(b.name, 'th'));
  if(!rows.length) return {html:EMPTY, csv:[]};
  const byMenu = {};
  rows.forEach(r => { const b = byMenu[r.menu] || (byMenu[r.menu] = {name: MENU[r.menu] ? MENU[r.menu].name : r.menu, qty:0, rev:0}); b.qty += r.qty; b.rev += r.rev; });
  const H = [['รายการ'], ['จำนวน (แก้ว)', 1], ['ยอดขาย', 1], ['สัดส่วนยอดขาย']];
  const line = r => [esc(r.name), r.qty, baht(r.rev), shareCell(pct(r.rev, R.total))];
  return {
    html: `<div class="sec2">ตามเมนูหลัก</div>` + tbl(H, Object.values(byMenu).map(line).concat(R.discount ? [['ส่วนลดโปรโมชัน', '', '-' + baht(R.discount), '']] : []), ['รวม', R.cups, baht(R.total), '']) +
          `<div class="sec2">ตามรายการ <small>(แยกขนาด)</small></div>` + tbl(H, rows.map(line)),
    csv: [['รายการ','จำนวน (แก้ว)','ยอดขาย','สัดส่วนยอดขาย %']].concat(rows.map(r => [r.name, r.qty, r.rev, pct(r.rev, R.total)]))
  };
}
/* การนับเงินปิดร้านของช่วงที่เลือก (ครั้งล่าสุดของแต่ละรอบ) */
function cashTable(){
  const byDate = {};
  cashLog().filter(c => c.type === 'close' && c.date >= REP.from && c.date <= REP.to).forEach(c => { byDate[c.date] = c; });
  const rows = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  const multi = REP.from !== REP.to;
  return `<div class="sec2">นับเงินปิดร้าน</div>` + (rows.length
    ? tbl([['รอบ'], ['ตั้งต้น', 1], ['ขายเงินสด', 1], ['ควรมี', 1], ['นับได้', 1], ['ต่าง', 1], ['คนนับ']], rows.map(c => [
        (multi ? thDate(c.date) + '<br>' : '') + `<small>${fmtDT(c.at).slice(-5)}</small>`, baht(c.float), baht(c.cashSales), baht(c.expected), baht(c.counted),
        `<b style="color:${c.diff === 0 ? 'var(--ok)' : 'var(--bad)'}">${c.diff === 0 ? 'ตรง' : (c.diff > 0 ? '+' : '-') + baht(Math.abs(c.diff))}</b>`,
        esc(c.by) + (c.note ? `<br><small>${esc(c.note)}</small>` : '')]))
    : `<p class="note2">ยังไม่ได้นับเงินปิดร้านในช่วงนี้ · กด "ปิดร้าน / นับเงิน" ด้านล่าง</p>`);
}
function tabPay(R){
  if(!R.bills) return {html:EMPTY + cashTable(), csv:[]};
  const H = [['ช่องทางชำระเงิน'], ['จำนวนบิล', 1], ['ยอดขาย', 1], ['เฉลี่ย/บิล', 1], ['สัดส่วนยอดขาย']];
  const rows = CONFIG.methods.map(m => { const v = R.methods[m.id]; return [esc(m.name), v.bills, baht(v.rev), v.bills ? baht(Math.round(v.rev / v.bills)) : '–', shareCell(pct(v.rev, R.total))]; });
  return {
    html: tbl(H, rows, ['รวม', R.bills, baht(R.total), baht(Math.round(R.total / R.bills)), '']) +
          `<p class="note2">เงินสดจากการขาย (ไม่รวมเงินทอนตั้งต้น) = ${baht(R.methods.cash ? R.methods.cash.rev : 0)}</p>` + cashTable(),
    csv: [['ช่องทางชำระเงิน','จำนวนบิล','ยอดขาย','เฉลี่ย/บิล','สัดส่วนยอดขาย %']].concat(CONFIG.methods.map(m => { const v = R.methods[m.id]; return [m.name, v.bills, v.rev, v.bills ? Math.round(v.rev / v.bills) : 0, pct(v.rev, R.total)]; }))
  };
}
function tabOpts(R){
  const order = {
    'ขนาด': CONFIG.menus.filter(m => m.sizes).flatMap(m => m.sizes.map(sizeLabel)),
    'น้ำผึ้ง': CONFIG.honey.map(h => h.name),
    'กินเลย / กลับบ้าน': CONFIG.dining.map(d => d.name),
  };
  const notes = {
    'ขนาด': 'ยอดขาย = ยอดรวมของแก้วที่เลือกขนาดนี้',
    'น้ำผึ้ง': 'ยอดขาย = ยอดรวมของแก้วที่เลือกระดับน้ำผึ้งนี้ (น้ำผึ้งไม่คิดเงินเพิ่ม)',
    'กินเลย / กลับบ้าน': 'นับเป็นบิล · ยอดขาย = ยอดรวมของบิล',
    'ท็อปปิ้งที่คิดเงินเพิ่ม': 'ยอดขาย = เฉพาะเงินที่คิดเพิ่มจากท็อปปิ้ง (Extra, ชิ้นที่เกินโควตาฟรี และแก้วที่คิดทีละชิ้น)',
    'โปรโมชัน': 'นับเป็นบิล · ยอด = ส่วนลดที่ให้ลูกค้ารวม · ยอดขายรวม ช่องทางชำระเงิน และกินเลย/กลับบ้าน หักส่วนลดแล้ว ส่วนยอดตามเมนู ขนาด และน้ำผึ้งเป็นราคาก่อนหักส่วนลด',
    'แยกท็อปปิ้ง': `แก้วที่ลูกค้าขอแยกท็อปปิ้ง (+${CONFIG.separateToppingPrice}/แก้ว) · ยอดขาย = เฉพาะเงินค่าแยก`,
    'การปรับท็อปปิ้ง': 'Acai / Banana Choco ที่เปลี่ยนหรือไม่รับท็อปปิ้ง · เงินที่คิดเพิ่มจากการเปลี่ยนเป็นของ Extra ดูในกลุ่ม "ท็อปปิ้งที่คิดเงินเพิ่ม"',
    ['ท็อปปิ้งฟรีไม่ครบ ' + CONFIG.freeToppingCount + ' อย่าง']: 'Greek Yogurt ที่พนักงานยืนยันว่าลูกค้าขอน้อยกว่าโควตา · ใช้เทียบกับสต็อกจริง ถ้าสูงผิดปกติให้ตรวจปริมาณที่ตัก',
  };
  let html = '', csv = [['กลุ่มตัวเลือก','ตัวเลือก','หน่วย','จำนวน','ยอดขาย']];
  Object.keys(notes).forEach(g => {
    const G = R.groups[g]; if(!G) return;
    const rows = Object.entries(G.rows).map(([o, v]) => ({o, ...v}));
    const ord = order[g];
    rows.sort((a, b) => ord ? ((ord.indexOf(a.o) + 1 || 999) - (ord.indexOf(b.o) + 1 || 999)) : (b.qty - a.qty));
    const tq = rows.reduce((a, r) => a + r.qty, 0), noRev = g === 'การปรับท็อปปิ้ง';
    html += `<div class="sec2">${esc(g)} <small>· หน่วย: ${G.unit}</small></div>` +
      tbl([['ตัวเลือก'], ['จำนวน', 1], ['ยอดขาย', 1], ['สัดส่วนจำนวน']],
          rows.map(r => [esc(r.o), r.qty, noRev ? '–' : baht(r.rev), shareCell(pct(r.qty, tq))])) +
      `<p class="note2">${notes[g]}</p>`;
    rows.forEach(r => csv.push([g, r.o, G.unit, r.qty, noRev ? 0 : r.rev]));
  });
  if(!html) return {html:EMPTY, csv:[]};
  return {html: html + '<p class="note2">แต่ละกลุ่มนับแยกกัน ไม่ควรนำยอดขายระหว่างกลุ่มมารวมกัน</p>', csv};
}
function tabIngr(R){
  const secs = [['base','Base (ฐาน)'], ['dried','Dried'], ['fruit','Fruits'], ['sauce','Sauce'], ['honey','น้ำผึ้ง'], ['other','อื่นๆ']];
  let html = '', csv = [['หมวด','วัตถุดิบ','จำนวน']];
  secs.forEach(([k, label]) => {
    const rows = Object.values(R.ingr).filter(x => x.sec === k).sort((a, b) => b.qty - a.qty);
    if(!rows.length) return;
    html += `<div class="sec2">${label}</div>` + tbl([['วัตถุดิบ'], ['จำนวน', 1]], rows.map(r => [esc(r.name), r.qty]));
    rows.forEach(r => csv.push([label, r.name, r.qty]));
  });
  if(!html) return {html:EMPTY, csv:[]};
  return {html: html + '<p class="note2">นับเป็นจำนวนส่วนที่เสิร์ฟให้ลูกค้า (ไม่รวมท็อปปิ้งที่ลูกค้า "ไม่รับ") ยังไม่ใช่น้ำหนักกรัม · น้ำผึ้งแบบ "ไม่รับ" ไม่นับ</p>', csv};
}
function tabBills(R){
  const list = R.all.slice().sort((a, b) => b.ts.localeCompare(a.ts));
  const multi = REP.from !== REP.to;
  const rows = list.map(x => {
    const t = new Date(x.ts);
    return `<tr class="${x.void ? 'void' : ''}"><td>${multi ? x.date + '<br>' : ''}#${pad(x.no, 3)}<br><small>${pad(t.getHours())}:${pad(t.getMinutes())}</small>${x.staff ? `<br><small>${icon('user', 13)} ${esc(x.staff)}</small>` : ''}</td>
      <td>${x.items.map(i => `${esc(itemTitle(i))} ×${i.qty}`).join('<br>')}<br><small>${esc(DINE[x.dining].name)}</small></td>
      <td>${baht(x.total)}<br><small>${esc(METHOD[x.method].name)}</small>${x.promo ? `<br><small class="promotag">${icon('tag', 14)} ${esc(x.promo.name)} -${baht(x.promo.discount)}</small>` : ''}</td>
      <td><button class="sbtn" data-prr="${x.id}">ใบเสร็จ</button><button class="sbtn" data-prk="${x.id}">ตั๋วครัว</button>${x.void ? `<br><small style="color:var(--bad)">ยกเลิกแล้ว</small> <button class="rbtn" data-restore="${x.id}">${icon('undo', 16)} นำกลับ</button>` : `<button class="vbtn" data-v="${x.id}">ยกเลิกบิล</button>`}${(x.log || []).length ? `<br><small style="color:var(--mute)">${esc(historyText(x))}</small>` : ''}</td></tr>`;
  }).join('');
  return {
    html: list.length ? `<table><tr><th>บิล</th><th>รายการ</th><th>ยอด</th><th></th></tr>${rows}</table>` : EMPTY,
    csv: billsCsvRows(list), extra: can('pastReports') ? `<button class="ghost" id="csvAll">${icon('download')} สำรองข้อมูลทั้งหมด</button>` : ''
  };
}

/* พนักงาน: ใครกดกี่บิล ยอดเท่าไร ยกเลิกกี่บิล + เวลาเข้า/ออกระบบ */
function tabStaff(R){
  const by = {};
  const row = n => by[n] || (by[n] = {name:n, bills:0, rev:0, voided:0, voidBy:0});
  R.all.forEach(x => { const r = row(x.staff || 'ไม่ระบุ'); if(x.void) r.voided++; else { r.bills++; r.rev += x.total; } });
  R.all.forEach(x => (x.log || []).forEach(l => { if(l.act === 'void' && l.by) row(l.by).voidBy++; }));
  const rows = Object.values(by).sort((a, b) => b.rev - a.rev);
  const log = staffLog().filter(l => l.date >= REP.from && l.date <= REP.to).sort((a, b) => b.at.localeCompare(a.at));
  if(!rows.length && !log.length) return {html:EMPTY, csv:[]};
  const multi = REP.from !== REP.to, tm = at => { const t = new Date(at); return (multi ? fmtDT(at) : `${pad(t.getHours())}:${pad(t.getMinutes())}`); };
  return {
    html: `<div class="sec2">ยอดตามคนกดออเดอร์</div>` +
      tbl([['พนักงาน'], ['บิล', 1], ['ยอดขาย', 1], ['บิลที่ถูกยกเลิก', 1], ['กดยกเลิกบิล', 1]], rows.map(r => [esc(r.name), r.bills, baht(r.rev), r.voided, r.voidBy])) +
      `<p class="note2">บิลที่ถูกยกเลิก = บิลที่คนนี้กดออเดอร์แล้วภายหลังถูกยกเลิก (ไม่นับในยอด) · กดยกเลิกบิล = เจ้าของที่ใส่รหัสยกเลิก</p>` +
      `<div class="sec2">เข้า / ออกระบบ</div>` + (log.length ? tbl([['เวลา'], ['ชื่อ'], ['ตำแหน่ง'], ['']], log.map(l => [tm(l.at), esc(l.name), ROLE_NAME[l.role] || l.role, l.act === 'in' ? 'เข้า' : 'ออก'])) : EMPTY) +
      `<p class="note2">ขึ้นรอบขายใหม่ (${pad(CONFIG.resetHour)}:00) ระบบออกให้เองโดยไม่บันทึกเวลาออก</p>`,
    csv: [['พนักงาน','บิล','ยอดขาย','บิลที่ถูกยกเลิก','กดยกเลิกบิล']].concat(rows.map(r => [r.name, r.bills, r.rev, r.voided, r.voidBy]),
      [[]], [['วันที่รอบขาย','เวลา','ชื่อ','ตำแหน่ง','เข้า/ออก']], log.map(l => [l.date, fmtDT(l.at), l.name, ROLE_NAME[l.role] || l.role, l.act === 'in' ? 'เข้า' : 'ออก']))
  };
}

function renderSummary(){
  if(!REP.from){ const r = defaultRound(); REP.from = REP.to = r.date; REP.fb = r.fallback; }
  if(!can('pastReports')){ const today = bizDate(new Date()); REP.from = REP.to = today; REP.fb = false; }   // พนักงาน: วันนี้เท่านั้น (ก่อนคำนวณยอด)
  const R = buildReport(REP.from, REP.to);
  const tabs = [['items', 'bowl', 'สินค้า'], ['pay', 'card', 'ชำระเงิน'], ['opts', 'sliders', 'ตัวเลือก'], ['ingr', 'box', 'วัตถุดิบ'], ['bills', 'receipt', 'บิล'], ['staff', 'users', 'พนักงาน']];
  const T = {items:tabItems, pay:tabPay, opts:tabOpts, ingr:tabIngr, bills:tabBills, staff:tabStaff}[REP.tab](R);
  repCsv = {name: `geek-popup-${REP.tab}-${REP.from}_${REP.to}.csv`, rows: T.csv};
  openModal(`
    <h3>${icon('chart', 22)} สรุปยอดขาย</h3>
    ${can('pastReports') ? `<div class="rangebar">
      <input type="date" id="repFrom" value="${REP.from}"><span>ถึง</span><input type="date" id="repTo" value="${REP.to}">
      ${[['today', 'วันนี้'], ['yday', 'เมื่อวาน'], ['7d', '7 วัน'], ['all', 'ทั้งหมด']].map(([k, l]) =>
        `<button class="chip ${REP.range === k ? 'on' : ''}" data-range="${k}" aria-pressed="${REP.range === k}">${l}</button>`).join('')}
    </div>` : `<div class="note2">${icon('lock', 14)} พนักงานดูได้เฉพาะรอบขายวันนี้ · ยอดย้อนหลังให้เจ้าของดู</div>`}
    <div class="note2"><b>${roundLabel(REP.from, REP.to)}</b>${R.voided ? ` · ไม่นับบิลที่ยกเลิก ${R.voided} บิล` : ''}</div>
    ${REP.fb ? `<div class="note2" style="color:var(--orange)">รอบปัจจุบันยังไม่มีบิล จึงแสดงรอบล่าสุดที่มีการขาย</div>` : ''}
    <div class="stats">
      <div class="stat"><small>ยอดขายรวม</small><b>${baht(R.total)}</b></div>
      <div class="stat"><small>จำนวนบิล</small><b>${R.bills}</b></div>
      <div class="stat"><small>จำนวนแก้ว</small><b>${R.cups}</b></div>
      <div class="stat"><small>เฉลี่ยต่อบิล</small><b>${R.bills ? baht(Math.round(R.total / R.bills)) : '–'}</b></div>
    </div>
    ${R.fewCups ? `<div class="note2" style="color:#b45f00">${icon('alert', 16)} Greek Yogurt ท็อปปิ้งฟรีไม่ครบ ${CONFIG.freeToppingCount} อย่าง <b>${R.fewCups} จาก ${R.topCups} แก้ว (${Math.round(R.fewCups / R.topCups * 100)}%)</b> · ดูรายละเอียดที่แท็บตัวเลือก</div>` : ''}
    <div class="tabs">${tabs.map(([k, ic, l]) => `<button class="tab ${REP.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic, 18)} ${l}</button>`).join('')}</div>
    ${T.html}
    <div class="row" style="margin-top:16px">
      ${T.csv.length ? `<button class="ghost" id="csvTab">${icon('download')} ดาวน์โหลด CSV (แท็บนี้)</button>` : ''}${T.extra || ''}
      <button class="ghost" id="closeDay">${icon('cash')} ปิดร้าน / นับเงิน</button>
      <button class="pay" id="closeX">ปิด</button>
    </div>
    <p class="note2">ข้อมูลเก็บในเครื่องนี้เท่านั้น · ปิดร้านทุกวันให้กด "ปิดร้าน / นับเงิน" แล้วสำรองข้อมูล · <span style="${SETTINGS.lastBackup ? '' : 'color:var(--bad)'}">${backupLabel()}</span></p>`, true);
  if(!$('repFrom')) return;
  $('repFrom').onchange = e => { if(e.target.value){ REP.fb = false; REP.range = null; REP.from = e.target.value; if(REP.to < REP.from) REP.to = REP.from; renderSummary(); } };
  $('repTo').onchange = e => { if(e.target.value){ REP.fb = false; REP.range = null; REP.to = e.target.value; if(REP.from > REP.to) REP.from = REP.to; renderSummary(); } };
}
let csvPending = null;

/* เปิดหน้าต่างส่งออกแทนการดาวน์โหลดทันที เพื่อไม่ให้หน้า POS ถูกเปลี่ยนเป็นหน้าว่าง (จอขาว) */
function downloadCsv(filename, rows, back){
  exportFile({filename, text:csvText(rows), type:'text/csv', bom:true, back, title:'ส่งออก CSV', size:`${rows.length - 1} แถว`,
    tip:'ถ้ากดดาวน์โหลดแล้วไม่มีไฟล์ (เช่นบน iPad) ให้ใช้ "แชร์ / บันทึกลง Files" หรือ "คัดลอก" แล้ววางใน Google Sheets / Excel'});
}
/* ส่งออกไฟล์ (CSV / ไฟล์สำรอง JSON) · back = true กลับหน้าสรุป · back = ฟังก์ชัน เรียกตอนกดกลับ · onDone = เรียกเมื่อส่งออกสำเร็จ */
function exportFile(o){
  csvPending = {filename:o.filename, text:o.text, back:o.back || null, type:o.type, bom:!!o.bom, onDone:o.onDone || null};
  const canShare = !!(navigator.canShare && window.File && (() => { try{ return navigator.canShare({files:[new File(['x'], o.filename, {type:o.type})]}); }catch(e){ return false; } })());
  const filename = o.filename;
  openModal(`<h3>${icon('file', 22)} ${esc(o.title)}</h3>
    <p class="note2" style="margin-top:0">${esc(filename)} · ${esc(o.size)}</p>
    <div class="row wrap">
      <button class="opt" id="csvDl">${icon('download')} ดาวน์โหลดไฟล์</button>
      ${canShare ? `<button class="opt" id="csvShare">${icon('share')} แชร์ / บันทึกลง Files</button>` : ''}
      <button class="opt" id="csvCopy">${icon('copy')} คัดลอกข้อความ</button>
    </div>
    <p class="note2">${esc(o.tip)}</p>
    ${o.type === 'text/csv' ? '<textarea class="csvbox" id="csvText" readonly></textarea>' : ''}
    <div class="row"><button class="pay" id="csvBack">${o.back === true ? 'กลับไปหน้าสรุป' : o.back ? 'กลับ' : 'ปิด'}</button></div>`);
  if($('csvText')) $('csvText').value = csvPending.text;   // ไฟล์สำรองอาจใหญ่มาก ไม่แสดงในหน้าจอ
}
const exportDone = () => { const c = csvPending; if(c && c.onDone) c.onDone(); };
function csvDownload(){
  const c = csvPending; if(!c) return;
  try{
    const url = URL.createObjectURL(new Blob([(c.bom ? '﻿' : '') + c.text], {type:c.type + ';charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url; a.download = c.filename; a.target = '_blank'; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    toast('กำลังดาวน์โหลด…'); exportDone();
  }catch(e){ toast('ดาวน์โหลดไม่ได้ ลองใช้ "คัดลอก" แทน'); }
}
async function csvShare(){
  const c = csvPending; if(!c) return;
  try{ await navigator.share({files:[new File([(c.bom ? '﻿' : '') + c.text], c.filename, {type:c.type})], title:c.filename}); exportDone(); }
  catch(e){ if(e && e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ ลองใช้ "คัดลอก" แทน'); }
}
async function csvCopy(){
  const c = csvPending; if(!c) return;
  try{ await navigator.clipboard.writeText(c.text); toast('คัดลอกแล้ว', 'check'); exportDone(); }
  catch(e){
    const t = $('csvText'); if(!t){ toast('คัดลอกไม่ได้ ใช้ "ดาวน์โหลดไฟล์" แทน'); return; }
    t.focus(); t.select(); try{ document.execCommand('copy'); toast('คัดลอกแล้ว', 'check'); exportDone(); }catch(_){ toast('กดค้างที่ข้อความแล้วเลือกคัดลอก'); }
  }
}
function billsCsvRows(list){
  const rows = [['วันที่รอบขาย','เวลา','บิล','รับประทาน','รายการ','ยอดรวม','วิธีจ่าย','สถานะ','ประวัติ','โปรโมชัน','ส่วนลด','พนักงาน']];
  list.forEach(s => {
    const t = new Date(s.ts);
    rows.push([s.date, `${pad(t.getHours())}:${pad(t.getMinutes())}`, pad(s.no, 3), DINE[s.dining].name,
      s.items.map(i => `${itemTitle(i)} x${i.qty} [${itemLines(i).join(' | ')}]`).join(' ; '),
      s.total, METHOD[s.method].name, s.void ? 'ยกเลิก' : 'ปกติ', historyText(s), s.promo ? `${s.promo.name} (${s.promo.detail})` : '', s.promo ? s.promo.discount : 0, s.staff || '']);
  });
  return rows;
}

function exportCsv(){ downloadCsv(`geek-popup-sales-all-${dateKey(new Date())}.csv`, billsCsvRows(loadSales()), true); }
