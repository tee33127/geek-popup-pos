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
  const tops = st.comps.map((n, i) => n === null
    ? {name:m.defaults[i], n:1, extra:0, from:null, removed:true}
    : {name:n, n:1, extra:0, from: n !== m.defaults[i] ? m.defaults[i] : null});
  return {unit:m.price, tops, sizeName:'', freeUsed:0, noTop:false};
}

/* คำนวณราคารายการที่กำลังเลือกอยู่บนหน้าจอ */
const priceSel = () => priceItem(curMenu(), sel);

const menuPriceLabel = m => m.sizes ? (() => { const p = m.sizes.map(s => s.price); const lo = Math.min(...p), hi = Math.max(...p); return lo === hi ? baht(lo) : baht(lo)+'–'+hi; })() : baht(m.price);
