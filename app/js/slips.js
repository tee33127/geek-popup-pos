/* เนื้อหาตั๋ว: ใบเสร็จลูกค้า + ตั๋วครัว (ไม่แตะ DOM)
   ชุดเดียวใช้ 3 ที่: พิมพ์ USB (renderSlip ใน printer.js) · หน้าพิมพ์ของระบบ (slipHtml → window.print) · printer-test/
   รูปแบบบล็อกดูที่ renderSlip · ขนาดเป็นจุดบนกระดาษ 576 จุด (8 จุด = 1 มม.) */

/* ท็อปปิ้งของแก้วบนใบเสร็จ แยกกลุ่มละบรรทัด: เปลี่ยน · ที่ได้ (ท็อปปิ้ง/เพิ่ม) · ไม่รับ ปิดท้าย
   แต่ละกลุ่มมีป้ายของตัวเอง "ไม่รับ:" จึงไม่มีทางอ่านว่าครอบคลุมรายการกลุ่มอื่น */
function topGroups(i){
  const tops = printTops(i), each = t => topName(t.name) + (t.n > 1 ? ' ×' + t.n : '') + (t.extra ? ` (+${t.extra})` : '');
  const G = [
    ['เปลี่ยน:', tops.filter(t => t.from && !t.removed).map(t => `${topName(t.name)} แทน ${topName(t.from)}` + (t.extra ? ` (+${t.extra})` : ''))],
    ['ท็อปปิ้ง:', tops.filter(t => !t.from && !t.removed && !t.add).map(each)],
    ['เพิ่ม:', tops.filter(t => t.add && !t.removed).map(each)],
    ['ไม่รับ:', tops.filter(t => t.removed).map(t => topName(t.name))],
  ].filter(g => g[1].length);
  if(!tops.length && i.menu === 'greek') G.push(['ท็อปปิ้ง:', ['ไม่มี']]);
  return G;
}

const RCPT = {base:26, sub:25, head:34, total:36, ind:14};   // ใบเสร็จ
function receiptBlocks(s){
  const b = [{text:CONFIG.shopName, size:RCPT.head, bold:true, align:'center'}, {text:CONFIG.shopSub, align:'center'}, {rule:'dash'},
    {left:`ออเดอร์ #${pad(s.no, 3)}`, right:DINE[s.dining].name, bold:true}, {text:fmtDT(s.ts)}];
  if(s.staff) b.push({text:'พนักงาน: ' + s.staff});
  if(s.void) b.push({text:'*** ยกเลิกบิล ***', bold:true, align:'center'});
  b.push({rule:'dash'});
  const sub = (tag, text) => b.push({tag, text, size:RCPT.sub, indent:RCPT.ind, col:'auto', tagBold:true});
  s.items.forEach(i => {
    b.push(i.qty > 1 ? {left:`${itemTitle(i)} ×${i.qty}`, mid:`${i.unit} × ${i.qty}`, right:String(i.unit * i.qty)} : {left:itemTitle(i), right:String(i.unit)});
    topGroups(i).forEach(([tag, list]) => sub(tag, list));
    if(i.sep) sub('แยก:', `แยกท็อปปิ้ง ใส่ถ้วยแยก (+${i.sep})`);
    if(i.honey !== undefined) sub('น้ำผึ้ง:', HONEY[i.honey].name);   // Banana Choco ไม่มีน้ำผึ้ง
    if(i.note) sub('หมายเหตุ:', i.note);
  });
  b.push({rule:'dash'});
  if(s.promo) b.push({left:'โปร: ' + s.promo.name, right:'-' + baht(s.promo.discount), bold:true}, {text:s.promo.detail, size:RCPT.sub, indent:RCPT.ind});
  b.push({left:'รวม', right:baht(s.total), size:RCPT.total, bold:true}, {left:'ชำระด้วย', right:METHOD[s.method].name});
  if(s.method === 'cash') b.push({left:'รับเงิน', right:baht(s.received)}, {left:'เงินทอน', right:baht(s.change)});
  b.push({rule:'dash'}, {text:'ขอบคุณที่อุดหนุนครับ/ค่ะ', align:'center'});
  return b;
}

/* ตั๋วครัว: เลขใหญ่ · กินเลย = กรอบเส้นหนา · กลับบ้าน = กรอบเส้นคู่ + ข้อความนำ (CONFIG.dining[].lead) · ไม่มีพื้นดำทึบ
   ทุกบรรทัดของแก้วเยื้องคอลัมน์เดียวกัน (ป้าย - / + ที่ KIT.ind ข้อความที่ KIT.ind + KIT.col) ไม่ว่าตัวหนาหรือปกติ
   หมายเหตุลูกค้าเป็นกรอบเด่นที่สุดในใบ อยู่ท้ายแก้วของมันเอง แก้วถัดไปคั่นด้วยเส้น */
const KIT = {base:28, title:36, no:110, dine:52, note:34, ind:8, col:30};
function kitchenBlocks(s){
  const d = DINE[s.dining];
  const b = [{text:'#' + pad(s.no, 3), size:KIT.no, bold:true, align:'center'},
    {box:d.box || 'single', text:d.name, lead:d.lead || '', size:KIT.dine, bold:true}, {text:fmtDT(s.ts), align:'center'}];
  if(s.void) b.push({text:'*** ยกเลิกบิล ***', bold:true, align:'center'});
  b.push({rule:'solid'});
  const line = (tag, text, bold) => b.push({tag, text, size:KIT.base, bold:!!bold, tagBold:true, indent:KIT.ind, col:KIT.col});
  const plain = (text, bold) => b.push({text, size:KIT.base, bold:!!bold, indent:KIT.ind + KIT.col});
  s.items.forEach((i, k) => {
    if(k) b.push({rule:'dash'});
    b.push({text:`${i.qty} × ${itemTitle(i)}`, size:KIT.title, bold:true});
    if(i.sep) plain('** แยกท็อปปิ้ง ใส่ถ้วยแยก **', true);
    if(i.tops.length) printTops(i).forEach(t => t.removed ? line('-', `ไม่รับ ${topName(t.name)}`, true)
      : t.add ? line('+', `เพิ่ม ${topName(t.name)}${t.n > 1 ? ` ×${t.n}` : ''}`, true)
      : line('-', `${topName(t.name)}${t.n > 1 ? ` ×${t.n}` : ''}${t.from ? ` (เปลี่ยนจาก ${topName(t.from)})` : ''}${t.extra ? ` (+${t.extra})` : ''}`, t.n > 1 || !!t.from));
    else if(i.menu === 'greek') line('-', 'ไม่มีท็อปปิ้ง');
    if(i.fewTops !== undefined) plain(`** ${i.fewTops ? `ลูกค้าเลือก ${i.fewTops} อย่าง` : 'ลูกค้าไม่เอาท็อปปิ้งฟรี'} · ตักปริมาณปกติ **`, true);
    if(i.honey !== undefined) plain(`น้ำผึ้ง: ${HONEY[i.honey].name}`, true);
    if(i.note) b.push({note:i.note, label:'หมายเหตุ', size:KIT.note});
  });
  return b;
}

/* ข้อความทีละบรรทัดของบล็อก (ไว้เทียบ/ค้นในเทสต์ และเป็นข้อความของหน้าพิมพ์ HTML) */
const slipJoin = t => Array.isArray(t) ? t.join(', ') : String(t);
function slipLines(blocks){
  return blocks.filter(x => !x.gap).map(x => x.rule ? '---'
    : 'note' in x ? `${x.label || 'หมายเหตุ'} ${x.note}`
    : 'box' in x ? [x.lead, x.text].filter(Boolean).join(' ')
    : 'left' in x ? [x.left, x.mid, x.right].filter(Boolean).join(' ')
    : 'tag' in x ? `${x.tag} ${slipJoin(x.text)}` : slipJoin(x.text)).map(t => t.replace(/\s+/g, ' ').trim());
}

/* บล็อก → HTML สำหรับหน้าพิมพ์ของระบบ (window.print) · ขนาดเป็น มม. = จุด / 8 หน้าตาจึงเหมือนพิมพ์ USB */
function slipHtml(blocks){
  const mm = n => (n / 8).toFixed(2) + 'mm', st = (b, more = '') => `style="font-size:${mm(b.size || 26)}${more}"`, B = b => b.bold ? ' b' : '';
  return '<div class="slip">' + blocks.map(x => {
    if(x.gap) return `<div style="height:${mm(x.gap)}"></div>`;
    if(x.rule) return x.rule === 'solid' ? '<hr class="solid">' : '<hr>';
    if('note' in x) return `<div class="note" ${st(x)}><div class="nl"><span class="tri"></span>${esc(x.label || 'หมายเหตุ')}</div> <div class="b">${esc(x.note)}</div></div>`;
    if('box' in x) return `<div class="box ${x.box === 'double' ? 'dbl' : ''}${B(x)}" ${st(x)}>${x.lead ? `<div class="ld">${esc(x.lead)}</div> ` : ''}<div>${esc(x.text)}</div></div>`;
    if('left' in x) return `<div class="r${B(x)}" ${st(x)}><span>${esc(x.left)}</span> <span class="m">${esc(x.mid || '')}</span> <span>${esc(x.right || '')}</span></div>`;
    const ind = x.indent ? `;padding-left:${mm(x.indent)}` : '';
    if('tag' in x) return `<div class="g${B(x)}" ${st(x, ind + (typeof x.col === 'number' ? `;grid-template-columns:${mm(x.col)} 1fr` : x.col === 'auto' ? ';grid-template-columns:minmax(5.4em, max-content) 1fr' : ''))}><span class="${(x.tagBold ?? x.bold) ? 'b' : ''}">${esc(x.tag)}</span> <span>${esc(slipJoin(x.text))}</span></div>`;
    return `<div class="t${B(x)}${x.align === 'center' ? ' c' : x.align === 'right' ? ' rt' : ''}" ${st(x, ind)}>${esc(slipJoin(x.text))}</div>`;
  }).join('') + '</div>';
}
