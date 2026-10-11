/* คิดราคา: ฟังก์ชันล้วน ไม่แตะ DOM และไม่อ่าน state ของหน้าจอ (เทสต์ได้ตรงๆ)
   m = เมนูจาก CONFIG.menus · st = {size, picks, comps} แบบเดียวกับ sel */
function priceItem(m, st){
  if(!m) return null;
  if(m.sizes){
    const s = m.sizes.find(x => x.id === st.size);
    let unit = s.price, free = 0; const tops = [];
    if(!s.noTop) st.picks.forEach(n => {           // เลือกซ้ำได้ (Banana ×3) นับทีละชิ้น
      const it = ITEM[n]; let extra = 0;
      if(it.price > 0) extra = it.price;
      else { free++; if(free > CONFIG.freeToppingCount) extra = CONFIG.overToppingPrice; }
      unit += extra;
      let t = tops.find(x => x.name === n);
      if(!t){ t = {name:n, n:0, extra:0, from:null}; tops.push(t); }
      t.n++; t.extra += extra;
    });
    return {unit, tops, sizeName: s.name + (s.noTop ? ' · ไม่มีท็อปปิ้ง' : ''), freeUsed:free, noTop:!!s.noTop};
  }
  /* Acai / Banana Choco: เปลี่ยนในหมวดเดียวกัน · ของฟรี → ของ Extra คิดตามราคาของ Extra
     ของ Extra → อย่างอื่น (รวมถึง Extra ด้วยกัน) ฟรี และไม่ลดราคา · ไม่รับ ก็ไม่ลดราคา */
  const tops = st.comps.map((n, i) => {
    const d = m.defaults[i];
    if(n === null) return {name:d, n:1, extra:0, from:null, removed:true};
    const extra = n !== d && ITEM[n].price > 0 && !(ITEM[d].price > 0) ? ITEM[n].price : 0;
    return {name:n, n:1, extra, from: n !== d ? d : null};
  });
  return {unit: m.price + tops.reduce((a, t) => a + t.extra, 0), tops, sizeName:'', freeUsed:0, noTop:false};
}

/* คำนวณราคารายการที่กำลังเลือกอยู่บนหน้าจอ */
const priceSel = () => priceItem(curMenu(), sel);

const menuPriceLabel = m => m.sizes ? (() => { const p = m.sizes.map(s => s.price); const lo = Math.min(...p), hi = Math.max(...p); return lo === hi ? baht(lo) : baht(lo)+'–'+hi; })() : baht(m.price);
