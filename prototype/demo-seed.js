/* ---------- DEMO: ข้อมูลตัวอย่าง 3 รอบขายล่าสุด สร้างใหม่อัตโนมัติเมื่อข้อมูลเก่า (เก็บแยกจากตัวจริง) ---------- */
function seedDemo(force){
  const cur = bizDate(new Date()), SEEDKEY = KEY + '_for';
  let seededFor = null; try{ seededFor = localStorage.getItem(SEEDKEY); }catch(e){}
  if(!force && seededFor === cur && loadSales().length) return;
  let seed = 20261005; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const freeNames = CONFIG.items.filter(i => i.price === 0).map(i => i.name), extraNames = CONFIG.items.filter(i => i.price > 0).map(i => i.name);
  const swapPool = {dried:['Almonds','Chia','Cacao nibs','Granola'], fruit:['Mango','Kiwi'], sauce:['Caramel','Hazelnut spread']};
  const sales = [], now = new Date();
  /* รอบขาย D = (D-1) 23:00 ถึง D 22:59 · ขายจริงช่วง 10:00–21:00 ของวัน D
     ถ้าตอนนี้เลย 23:00 ไปแล้ว รอบปัจจุบันยังไม่เริ่มขาย จึงสร้างให้ 3 รอบก่อนหน้า */
  const lastFull = addDays(cur, now.getHours() >= CONFIG.resetHour ? -1 : 0);
  [2, 1, 0].forEach(back => {
    const D = addDays(lastFull, -back), [y, m, d] = D.split('-').map(Number);
    const n = 14 + Math.floor(rnd() * 8); let no = 0;
    for(let k = 0; k < n; k++){
      const when = new Date(y, m - 1, d, 10 + Math.floor(k * 11 / n), Math.floor(rnd() * 60));
      if(when > now) break;
      const items = [];
      for(let q = rnd() < .25 ? 2 : 1; q > 0; q--){
        const r = rnd(), id = r < .55 ? 'greek' : r < .8 ? 'acai' : 'banana', mm = MENU[id];
        resetSel(); pickMenu(id);
        if(id === 'greek'){
          sel.size = pick(['g1n','g1','g1','g2','g2']);
          if(sel.size !== 'g1n') for(let t = 1 + Math.floor(rnd() * 4); t > 0; t--) sel.picks.push(rnd() < .2 ? pick(extraNames) : (rnd() < .3 && sel.picks.length ? sel.picks[0] : pick(freeNames)));
        } else {
          mm.defaults.forEach((dd, i) => { const x = rnd(); if(x < .08) sel.comps[i] = null; else if(x < .18){ const c = pick(swapPool[ITEM[dd].cat]); if(!sel.comps.includes(c)) sel.comps[i] = c; } });
        }
        sel.honey = pick(['normal','normal','normal','lots','little','side','none']);
        const P = priceSel();
        const it = {menu:mm.id, name:mm.name, sizeName:P.sizeName, tops:P.tops, ...(!mm.noHoney && {honey:sel.honey}), note:'', unit:P.unit, qty:1};
        if(mm.sizes && !P.noTop && P.freeUsed < CONFIG.freeToppingCount) it.fewTops = P.freeUsed;   // เหมือนพนักงานกดยืนยัน "ลูกค้าขอแค่ N อย่าง"
        items.push(it);
      }
      resetSel();
      const total = items.reduce((a, i) => a + i.unit * i.qty, 0), method = pick(['cash','cash','promptpay','promptpay','promptpay','tcp']);
      const sale = {id: when.getTime() + k, no: ++no, date: D, ts: when.toISOString(), dining: pick(['dinein','dinein','takeaway']), items, total, method,
        received: method === 'cash' ? Math.ceil(total / 100) * 100 : total, change: 0, void: false};
      sale.change = sale.received - total;
      if(back === 1 && k === 3){ sale.void = true; sale.voidAt = new Date(when.getTime() + 120000).toISOString(); sale.log = [{act:'void', at:sale.voidAt}]; }
      sales.push(sale);
    }
  });
  clearSales(); saveSales(sales);
  try{ localStorage.setItem(SEEDKEY, cur); }catch(e){}
}
storeReady.then(() => seedDemo(false));
$('btnReseed').innerHTML = icon('refresh', 18) + ' ข้อมูลตัวอย่างใหม่';
$('btnReseed').onclick = () => askConfirm({msg:'สร้างข้อมูลตัวอย่างใหม่?', sub:'บิลใน DEMO ทั้งหมดจะถูกแทนที่', yes:'สร้างใหม่', ok:true, onYes:() => { seedDemo(true); updateNext(); toast('สร้างข้อมูลตัวอย่างแล้ว', 'check'); }});
