/* โปรโมชัน: คำนวณจากรายการในตะกร้า (ฟังก์ชันล้วน ไม่แตะ DOM)
   1 บิลใช้ได้ 1 โปร · ค่าที่บวกเพิ่ม (เปลี่ยน/เพิ่มท็อปปิ้ง, แยกท็อปปิ้ง) คิดตามปกติ โปรลดเฉพาะราคาเมนูหรือท็อปปิ้ง 1 ชิ้น
   promoEval(p, items, want) → {ok:false, why} หรือ {ok:true, discount, detail, target, targets}
   want = {key, top} เป้าหมายที่พนักงานเลือก (ลด 30 / ฟรี 1 ท็อปปิ้ง) ถ้าไม่มีหรือหาไม่เจอ ใช้รายการแรก */
const PROMO = byId(CONFIG.promos);
const menuNames = ids => ids.map(id => MENU[id] ? MENU[id].name : id).join(' หรือ ');
function promoEval(p, items, want){
  const pickTarget = targets => targets.find(t => want && t.key === want.key && (t.top || null) === (want.top || null)) || targets[0];
  if(p.type === 'b1g1'){
    /* แก้วที่ราคาเมนูถูกที่สุดฟรี 1 แก้ว (ถ้ามี 149 ฟรี 149 เสมอ) · ต้องมีอย่างน้อย 2 แก้ว */
    const el = items.filter(i => p.menus.includes(i.menu));
    if(el.reduce((a, i) => a + i.qty, 0) < 2) return {ok:false, why:`ต้องมี ${menuNames(p.menus)} อย่างน้อย 2 แก้ว`};
    const base = i => MENU[i.menu].price;
    const free = el.reduce((a, i) => base(i) < base(a) ? i : a);
    const t = {key:free.key, label:itemTitle(free), discount:base(free)};
    return {ok:true, discount:t.discount, detail:`${itemTitle(free)} ฟรี 1 แก้ว`, target:t, targets:[t]};
  }
  if(p.type === 'off'){
    const targets = items.filter(i => p.menus.includes(i.menu)).map(i => ({key:i.key, label:[itemTitle(i), ...itemLines(i)].join(' · '), discount:Math.min(p.amount, i.unit)}));
    if(!targets.length) return {ok:false, why:`ต้องมี ${menuNames(p.menus)} อย่างน้อย 1 แก้ว`};
    const t = pickTarget(targets);
    return {ok:true, discount:t.discount, detail:`${itemTitle(items.find(i => i.key === t.key))} 1 แก้ว`, target:t, targets};
  }
  if(p.type === 'freetop'){
    /* ท็อปปิ้งที่ต้องจ่าย (มี each) 1 ชิ้น ไม่รวมรายการที่ยกเว้น */
    const targets = [];
    items.forEach(i => i.tops.forEach(t => {
      if(t.removed || !t.each || p.exclude.includes(t.name)) return;
      targets.push({key:i.key, top:t.name, label:`${topName(t.name)} · ${itemTitle(i)}`, discount:t.each});
    }));
    if(!targets.length) return {ok:false, why:'ยังไม่มีท็อปปิ้งที่ต้องจ่าย (ไม่นับ กราโนล่า บลูเบอร์รี่ สตรอว์เบอร์รี่)'};
    const t = pickTarget(targets);
    return {ok:true, discount:t.discount, detail:`${topName(t.top)} ฟรี 1 ชิ้น (${itemTitle(items.find(i => i.key === t.key))})`, target:t, targets};
  }
  return {ok:false, why:'ไม่รู้จักโปรนี้'};
}
