/* ---------- Print: ใบเสร็จลูกค้า + ตั๋วครัว ---------- */
function receiptHtml(s){
  const lines = s.items.map(i =>
    `<div class="r"><span>${esc(itemTitle(i))}${i.qty > 1 ? ' ×' + i.qty : ''}</span><span>${i.unit * i.qty}</span></div>` +
    itemLines(i).map(l => `<div class="sm">${esc(l)}</div>`).join('')).join('');
  return `<div class="slip">
    <div class="c b lg">${esc(CONFIG.shopName)}</div><div class="c">${esc(CONFIG.shopSub)}</div><hr>
    <div class="r b"><span>ออเดอร์ #${pad(s.no, 3)}</span><span>${esc(DINE[s.dining].name)}</span></div>
    <div>${fmtDT(s.ts)}</div>${s.void ? '<div class="c b">*** ยกเลิกบิล ***</div>' : ''}<hr>
    ${lines}<hr>
    <div class="r b lg"><span>รวม</span><span>${baht(s.total)}</span></div>
    <div class="r"><span>ชำระด้วย</span><span>${esc(METHOD[s.method].name)}</span></div>
    ${s.method === 'cash' ? `<div class="r"><span>รับเงิน</span><span>${baht(s.received)}</span></div><div class="r"><span>เงินทอน</span><span>${baht(s.change)}</span></div>` : ''}
    <hr><div class="c">ขอบคุณที่อุดหนุนครับ/ค่ะ</div></div>`;
}
function kitchenHtml(s){
  const items = s.items.map(i => {
    let l = '';
    if(i.tops.length) i.tops.forEach(t => { l += t.removed ? `<div class="kl"><b>- ไม่รับ ${esc(topName(t.name))}</b></div>` : `<div class="kl">- ${esc(topName(t.name))}${t.n > 1 ? ` <b>×${t.n}</b>` : ''}${t.from ? ` <b>(เปลี่ยนจาก ${esc(topName(t.from))})</b>` : ''}${t.extra ? ` (+${t.extra})` : ''}</div>`; });
    else if(i.menu === 'greek') l += '<div class="kl">- ไม่มีท็อปปิ้ง</div>';
    if(i.fewTops !== undefined) l += `<div class="kl"><b>** ${i.fewTops ? `ลูกค้าเลือก ${i.fewTops} อย่าง` : 'ลูกค้าไม่เอาท็อปปิ้งฟรี'} · ตักปริมาณปกติ **</b></div>`;
    l += `<div class="kl">น้ำผึ้ง: <b>${esc(HONEY[i.honey].name)}</b></div>`;
    if(i.note) l += `<div class="kl"><b>หมายเหตุ: ${esc(i.note)}</b></div>`;
    return `<div class="kt">${i.qty} × ${esc(itemTitle(i))}</div>${l}`;
  }).join('');
  return `<div class="slip">
    <div class="no">#${pad(s.no, 3)}</div>
    <div class="dine">${esc(DINE[s.dining].name)}</div>
    <div class="c">${fmtDT(s.ts)}</div>${s.void ? '<div class="c b">*** ยกเลิกบิล ***</div>' : ''}<hr>${items}</div>`;
}
function printSale(s, which){
  let h = '';
  if(which !== 'kitchen') h += receiptHtml(s);
  if(which !== 'receipt') h += kitchenHtml(s);
  $('printArea').innerHTML = h;
  setTimeout(() => window.print(), 80);
}
