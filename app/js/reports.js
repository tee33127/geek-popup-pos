/* ====== รายงานสรุป: คำนวณตัวเลข (ไม่แตะ DOM) ====== */
const REP = {from:null, to:null, tab:'items', fb:false};

const thDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'2-digit'}); };
function roundLabel(from, to){
  const start = k => `${thDate(addDays(k, -1))} ${pad(CONFIG.resetHour)}:00`, end = k => `${thDate(k)} ${pad(CONFIG.resetHour - 1)}:59`;
  return from === to ? `รอบขาย ${thDate(from)} (${start(from)} – ${end(from)})` : `รอบขาย ${thDate(from)} – ${thDate(to)} (${start(from)} – ${end(to)})`;
}
/* รอบที่จะเปิดให้ดู: รอบปัจจุบัน ถ้ายังไม่มีบิลให้ใช้รอบล่าสุดที่มีการขาย */
function defaultRound(){
  const cur = bizDate(new Date()), sales = loadSales();
  if(sales.some(x => x.date === cur)) return {date:cur, fallback:false};
  const past = sales.map(x => x.date).filter(d => d < cur).sort();
  return past.length ? {date:past[past.length - 1], fallback:true} : {date:cur, fallback:false};
}

function setRange(k){
  const today = bizDate(new Date());
  REP.fb = false;
  if(k === 'yday') REP.from = REP.to = addDays(today, -1);
  else if(k === '7d'){ REP.from = addDays(today, -6); REP.to = today; }
  else if(k === 'all'){ const ds = loadSales().map(x => x.date).sort(); REP.from = ds[0] || today; REP.to = ds[ds.length - 1] || today; }
  else REP.from = REP.to = today;
}
const pct = (v, t) => t ? Math.round(v * 1000 / t) / 10 : 0;

/* รวมตัวเลขทั้งหมดจากบิลที่ไม่ถูกยกเลิก */
function buildReport(from, to){
  const all = loadSales().filter(x => x.date >= from && x.date <= to);
  const ok = all.filter(x => !x.void);
  const R = {all, ok, voided: all.length - ok.length, total: ok.reduce((a, x) => a + x.total, 0), bills: ok.length, cups: 0,
             items: {}, methods: {}, groups: {}, ingr: {}, topCups: 0, fewCups: 0, discount: 0};
  const grp = (g, unit, o, qty, rev) => { const G = R.groups[g] || (R.groups[g] = {unit, rows:{}}); const r = G.rows[o] || (G.rows[o] = {qty:0, rev:0}); r.qty += qty; r.rev += rev; };
  const ing = (sec, name, qty) => { const k = sec + '|' + name; (R.ingr[k] = R.ingr[k] || {sec, name, qty:0}).qty += qty; };
  CONFIG.methods.forEach(m => R.methods[m.id] = {bills:0, rev:0});
  ok.forEach(sale => {
    if(R.methods[sale.method]){ R.methods[sale.method].bills++; R.methods[sale.method].rev += sale.total; }
    if(sale.promo){ R.discount += sale.promo.discount; grp('โปรโมชัน', 'บิล', sale.promo.name, 1, sale.promo.discount); }
    grp('กินเลย / กลับบ้าน', 'บิล', DINE[sale.dining] ? DINE[sale.dining].name : String(sale.dining), 1, sale.total);
    sale.items.forEach(i => {
      const rev = i.unit * i.qty; R.cups += i.qty;
      /* Greek ที่มีโควตาท็อปปิ้งฟรี · fewTops = ลูกค้าขอน้อยกว่าโควตา (ไว้เทียบสต็อก) */
      if(i.menu === 'greek' && !noFreeQuota(i)) R.topCups += i.qty;
      if(i.fewTops !== undefined){ R.fewCups += i.qty; grp('ท็อปปิ้งฟรีไม่ครบ ' + CONFIG.freeToppingCount + ' อย่าง', 'แก้ว', i.fewTops ? `เลือก ${i.fewTops} อย่าง` : 'ไม่เอาท็อปปิ้งฟรี', i.qty, rev); }
      const key = itemTitle(i);
      const it = R.items[key] || (R.items[key] = {menu:i.menu, name:key, qty:0, rev:0}); it.qty += i.qty; it.rev += rev;
      if(i.sizeName) grp('ขนาด', 'แก้ว', i.sizeName, i.qty, rev);
      if(i.sep) grp('แยกท็อปปิ้ง', 'แก้ว', i.name, i.qty, i.sep * i.qty);
      if(i.honey !== undefined) grp('น้ำผึ้ง', 'แก้ว', HONEY[i.honey] ? HONEY[i.honey].name : String(i.honey), i.qty, rev);
      if(i.menu === 'greek') ing('base', 'Greek Yogurt (สกู๊ป)', (parseInt(i.sizeName, 10) || 1) * i.qty);
      else ing('base', i.name + ' base (ถ้วย)', i.qty);
      i.tops.forEach(t => {
        const n = (t.n || 1) * i.qty;
        if(t.removed){ grp('การปรับท็อปปิ้ง', 'แก้ว', `${i.name}: ไม่รับ ${topName(t.name)}`, i.qty, 0); return; }
        if(t.from) grp('การปรับท็อปปิ้ง', 'แก้ว', `${i.name}: เปลี่ยน ${topName(t.from)} → ${topName(t.name)}`, i.qty, 0);
        if(t.add) grp('การปรับท็อปปิ้ง', 'แก้ว', `${i.name}: เพิ่ม ${topName(t.name)}`, i.qty, 0);
        ing(ITEM[t.name] ? ITEM[t.name].cat : 'other', topName(t.name), n);
        if(t.extra){
          const isExtra = ITEM[t.name] && ITEM[t.name].price > 0, perTop = i.menu === 'greek' && noFreeQuota(i);
          const pcs = isExtra || perTop || t.add ? n : Math.round(t.extra / CONFIG.overToppingPrice) * i.qty;
          grp('ท็อปปิ้งที่คิดเงินเพิ่ม', 'ชิ้น', t.add ? `${topName(t.name)} (เพิ่มใน ${i.name})` : perTop ? `${topName(t.name)} (แก้วคิดทีละชิ้น)` : isExtra ? topName(t.name) : `${topName(t.name)} (เกิน ${CONFIG.freeToppingCount} ชิ้น)`, pcs, t.extra * i.qty);
        }
      });
      if(i.honey !== undefined && i.honey !== 'none') ing('honey', 'น้ำผึ้ง · ' + (HONEY[i.honey] ? HONEY[i.honey].name : i.honey), i.qty);
    });
  });
  return R;
}
