/* ---------- DEMO: ข้อมูลตัวอย่าง 3 รอบขายล่าสุด สร้างใหม่อัตโนมัติเมื่อข้อมูลเก่า (เก็บแยกจากตัวจริง) ---------- */
/* บัญชีตัวอย่าง (เก็บใน settings ของ DEMO เท่านั้น) · รหัสกู้คืน 12345678 */
const DEMO_OWNER = 'เจ้าของร้าน', DEMO_STAFF = 'แพร';
if(!owners().length && !SETTINGS_BROKEN){   // settings เสีย: ไม่สร้างบัญชีทับ ให้เห็นหน้า "ข้อมูลตั้งค่าเสีย" เหมือนตัวจริง
  saveUser({name:DEMO_OWNER, role:'owner'}, '1234'); saveUser({name:DEMO_STAFF, role:'staff'}, '1111');
  const salt = randHex(8); setRecoveryHash({salt, hash:hashCode(salt, '12345678')});
}
LOGIN_HINT = 'DEMO · เจ้าของ 1234 · พนักงาน 1111 · รหัสกู้คืน 12345678';
function seedDemo(force){
  const cur = bizDate(new Date()), SEEDKEY = KEY + '_for';
  let seededFor = null; try{ seededFor = localStorage.getItem(SEEDKEY); }catch(e){}
  if(!force && seededFor === cur && loadSales().length) return;
  let seed = 20261005; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const freeNames = CONFIG.items.filter(i => i.price === 0).map(i => i.name), extraNames = CONFIG.items.filter(i => i.price > 0).map(i => i.name);
  const swapPool = {dried:['Almonds','Chia','Cacao nibs','Granola'], fruit:['Mango','Kiwi'], sauce:['Caramel','Hazelnut spread']};
  const sales = [], now = new Date(), slog = [];
  /* รอบขาย D = (D-1) 23:00 ถึง D 22:59 · ขายจริงช่วง 10:00–21:00 ของวัน D
     ถ้าตอนนี้เลย 23:00 ไปแล้ว รอบปัจจุบันยังไม่เริ่มขาย จึงสร้างให้ 3 รอบก่อนหน้า */
  const lastFull = addDays(cur, now.getHours() >= CONFIG.resetHour ? -1 : 0);
  [2, 1, 0].forEach(back => {
    const D = addDays(lastFull, -back), [y, m, d] = D.split('-').map(Number);
    const n = 14 + Math.floor(rnd() * 8); let no = 0;
    const who = back === 1 ? DEMO_OWNER : DEMO_STAFF, open = new Date(y, m - 1, d, 9, 50);   // รอบกลางเจ้าของเปิดร้านเอง
    if(open <= now) slog.push({at:open.toISOString(), date:D, id:'demo', name:who, role: who === DEMO_OWNER ? 'owner' : 'staff', act:'in'});
    for(let k = 0; k < n; k++){
      const when = new Date(y, m - 1, d, 10 + Math.floor(k * 11 / n), Math.floor(rnd() * 60));
      if(when > now) break;
      const items = [];
      for(let q = rnd() < .25 ? 2 : 1; q > 0; q--){
        const r = rnd(), id = r < .55 ? 'greek' : r < .8 ? 'acai' : 'banana', mm = MENU[id];
        resetSel(); pickMenu(id);
        if(id === 'greek'){
          sel.size = pick(['g1n','g1','g1','g2','g2']);
          if(sel.size === 'g1n'){ if(rnd() < .4) sel.picks.push(pick(freeNames)); }   // แก้ว 69: ส่วนใหญ่ไม่ใส่ บางแก้วใส่ 1 ชิ้น (+15)
          else for(let t = 1 + Math.floor(rnd() * 4); t > 0; t--) sel.picks.push(rnd() < .2 ? pick(extraNames) : (rnd() < .3 && sel.picks.length ? sel.picks[0] : pick(freeNames)));
        } else {
          mm.defaults.forEach((dd, i) => { const x = rnd(); if(x < .08) sel.comps[i] = null; else if(x < .18){ const c = pick(swapPool[ITEM[dd].cat]); if(!sel.comps.includes(c)) sel.comps[i] = c; } });
        }
        sel.sep = rnd() < .12;   // แยกท็อปปิ้ง +5 บางแก้ว
        sel.honey = pick(['normal','normal','normal','lots','little','side','none']);
        const P = priceSel();
        const it = {menu:mm.id, name:mm.name, sizeName:P.sizeName, tops:P.tops, ...(!mm.noHoney && {honey:sel.honey}), note:'', unit:P.unit, qty:1, ...(P.sep && {sep:P.sep})};
        if(mm.sizes && !P.noTop && !P.perTop && P.freeUsed < CONFIG.freeToppingCount) it.fewTops = P.freeUsed;   // เหมือนพนักงานกดยืนยัน "ลูกค้าขอแค่ N อย่าง"
        items.push(it);
      }
      resetSel();
      const total = items.reduce((a, i) => a + i.unit * i.qty, 0), method = pick(['cash','cash','promptpay','promptpay','promptpay','tcp']);
      const sale = {id: when.getTime() + k, no: ++no, date: D, ts: when.toISOString(), dining: pick(['dinein','dinein','takeaway']), items, total, method,
        received: method === 'cash' ? Math.ceil(total / 100) * 100 : total, change: 0, void: false, staff: who};
      sale.change = sale.received - total;
      if(back === 1 && k === 3){ sale.void = true; sale.voidAt = new Date(when.getTime() + 120000).toISOString(); sale.log = [{act:'void', at:sale.voidAt, by:DEMO_OWNER}]; }
      sales.push(sale);
    }
  });
  clearSales(); saveSales(sales);
  try{ localStorage.setItem(STAFFLOG_KEY, JSON.stringify(slog)); }catch(e){}
  /* นับเงินปิดร้านของรอบที่ขายจบแล้ว (เมื่อวานขาด 20) · รอบวันนี้ยังไม่ปิด */
  const cash = [];
  [2, 1].forEach(back => {
    const D = addDays(lastFull, -back), [y, m, d] = D.split('-').map(Number), who = back === 1 ? DEMO_OWNER : DEMO_STAFF;
    cash.push({type:'open', date:D, at:new Date(y, m - 1, d, 9, 52).toISOString(), by:who, float:1000});
    const c = cashCount(D, 1000, 0); c.counted = c.expected - (back === 1 ? 20 : 0); c.diff = c.counted - c.expected;
    cash.push({type:'close', date:D, at:new Date(y, m - 1, d, 21, 40).toISOString(), by:who, float:1000, ...c, note: back === 1 ? 'ทอนเกินลูกค้า 20' : ''});
  });
  saveCashLog(cash);
  try{ localStorage.setItem(SEEDKEY, cur); }catch(e){}
}
storeReady.then(() => seedDemo(false));
$('btnReseed').innerHTML = icon('refresh', 18) + ' ข้อมูลตัวอย่างใหม่';
$('btnReseed').onclick = () => askConfirm({msg:'สร้างข้อมูลตัวอย่างใหม่?', sub:'บิลใน DEMO ทั้งหมดจะถูกแทนที่', yes:'สร้างใหม่', ok:true, onYes:() => { seedDemo(true); updateNext(); toast('สร้างข้อมูลตัวอย่างแล้ว', 'check'); }});
