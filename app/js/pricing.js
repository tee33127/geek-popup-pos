/* คิดราคา: ฟังก์ชันล้วน ไม่แตะ DOM และไม่อ่าน state ของหน้าจอ (เทสต์ได้ตรงๆ)
   m = เมนูจาก CONFIG.menus · st = {size, picks, comps, adds, sep} แบบเดียวกับ sel */
function priceBase(m, st){
  if(!m) return null;
  if(m.sizes){
    const s = m.sizes.find(x => x.id === st.size);
    let unit = s.price, free = 0; const tops = [];
    if(!s.noTop) st.picks.forEach(n => {           // เลือกซ้ำได้ (Banana ×3) นับทีละชิ้น
      const it = ITEM[n]; let extra = 0;
      if(s.perTop) extra = s.perTop;                 // ขนาดคิดท็อปปิ้งราคาเดียว (69: ชิ้นละ 15 ทุกอย่าง)
      else if(it.price > 0) extra = it.price;
      else { free++; if(free > CONFIG.freeToppingCount) extra = CONFIG.overToppingPrice; }
      unit += extra;
      let t = tops.find(x => x.name === n);
      if(!t){ t = {name:n, n:0, extra:0, from:null}; tops.push(t); }
      t.n++; t.extra += extra; if(extra) t.each = extra;   // each = ราคาต่อชิ้นที่คิด (ใช้กับโปรฟรี 1 ท็อปปิ้ง)
    });
    return {unit, tops, sizeName: sizeLabel(s), freeUsed:free, noTop:!!s.noTop, perTop:s.perTop || 0};
  }
  /* Acai / Banana Choco: เปลี่ยนในหมวดเดียวกัน · ของฟรี → ของ Extra คิดตามราคาของ Extra
     ของ Extra → อย่างอื่น (รวมถึง Extra ด้วยกัน) ฟรี และไม่ลดราคา · ไม่รับ ก็ไม่ลดราคา */
  const tops = st.comps.map((n, i) => {
    const d = m.defaults[i];
    if(n === null) return {name:d, n:1, extra:0, from:null, removed:true};
    const extra = n !== d && ITEM[n].price > 0 && !(ITEM[d].price > 0) ? ITEM[n].price : 0;
    return {name:n, n:1, extra, from: n !== d ? d : null};
  });
  /* เพิ่มท็อปปิ้ง (st.adds) ชิ้นละ addTopPrice ทุกอย่าง · เลือกซ้ำได้ */
  (st.adds || []).forEach(n => {
    let t = tops.find(x => x.add && x.name === n);
    if(!t){ t = {name:n, n:0, extra:0, from:null, add:true, each:CONFIG.addTopPrice}; tops.push(t); }
    t.n++; t.extra += CONFIG.addTopPrice;
  });
  return {unit: m.price + tops.reduce((a, t) => a + t.extra, 0), tops, sizeName:'', freeUsed:0, noTop:false, perTop:0};
}

/* + แยกท็อปปิ้ง (st.sep) ต่อแก้ว · คิดเฉพาะเมื่อมีท็อปปิ้งในแก้วจริง (ไม่นับช่องที่ไม่รับ) */
function priceItem(m, st){
  const P = priceBase(m, st); if(!P) return P;
  P.sep = st.sep && P.tops.some(t => !t.removed) ? CONFIG.separateToppingPrice : 0;
  P.unit += P.sep;
  return P;
}

/* ชื่อขนาดที่เก็บในบิล (ห้ามเปลี่ยนข้อความโดยไม่จำเป็น รายงานจัดกลุ่มตามชื่อนี้) */
const sizeLabel = s => s.name + (s.perTop ? ` · ท็อปปิ้งชิ้นละ ${s.perTop}` : s.noTop ? ' · ไม่มีท็อปปิ้ง' : '');
/* แก้วขนาดคิดท็อปปิ้งทีละชิ้น / ไม่มีท็อปปิ้ง (บิลเก่า) ไม่มีโควตาฟรี · ดูจากชื่อขนาดในบิล */
const noFreeQuota = i => /ไม่มีท็อปปิ้ง|ชิ้นละ/.test(i.sizeName || '');

/* คำนวณราคารายการที่กำลังเลือกอยู่บนหน้าจอ */
const priceSel = () => priceItem(curMenu(), sel);

const menuPriceLabel = m => m.sizes ? (() => { const p = m.sizes.map(s => s.price); const lo = Math.min(...p), hi = Math.max(...p); return lo === hi ? baht(lo) : baht(lo)+'–'+hi; })() : baht(m.price);
