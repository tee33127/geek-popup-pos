// QA /check-all 2026-10-16 · หน้าเลือกออเดอร์ v3 + ตะกร้าแยกกลุ่ม + หน้าต่างแบบใหม่ (งานหลังรายงาน 12 ต.ค.)
// P30 สุ่มแก้วกดผ่านหน้าจอจริง (ไม่เรียก priceItem) → ราคาในตะกร้า / ยอดบิล / ใบเสร็จ ตรงกับฟังก์ชันอ้างอิงจาก business-rules.md
// C15 ตะกร้าแสดงท็อปปิ้งตรงกับที่สั่ง รวมจำนวนชิ้นที่คิดเงิน (ค่าคาดหวังคิดจากออเดอร์ ไม่ใช่จาก topGroups) และตรงกับใบเสร็จทุกบรรทัด (H20)
// C16 ปิดหน้าต่างด้วย X: ชำระเงิน = ยกเลิก ไม่มีบิล · โปร = ไม่ใช้โปรที่เลือกค้างไว้
const {eq, done, rng, open} = require('./qa-helper');

/* ---------- กติกาจาก business-rules.md §1–5.1 (เขียนแยกจากโค้ดแอป) ---------- */
const ACAI = ['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds'], BANANA = ['Banana', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips'];
const CAT = {dried:['Almonds', 'Cashew', 'Chia', 'Flaxseeds', 'Cherry Jelly', 'Cacao nibs', 'Chocolate Chips', 'Biscoff Crumble', 'Chocolate crumble', 'Marshmallow', 'Granola'],
  fruit:['Banana', 'Mango', 'Kiwi', 'Blueberries', 'Strawberries'], sauce:['Hazelnut spread', 'Original peanut butter', 'Cacao peanut butter', 'Caramel']};
const TH = {Almonds:'อัลมอนด์', Cashew:'เม็ดมะม่วงหิมพานต์', Chia:'เมล็ดเจีย', Flaxseeds:'เมล็ดแฟลกซ์', 'Cherry Jelly':'เยลลี่เชอร์รี่', 'Cacao nibs':'คาเคานิบส์', 'Chocolate Chips':'ช็อกโกแลตชิพ',
  'Biscoff Crumble':'บิสคอฟครัมเบิล', 'Chocolate crumble':'ช็อกโกแลตครัมเบิล', Marshmallow:'มาร์ชเมลโลว์', Banana:'กล้วย', Mango:'มะม่วง', Kiwi:'กีวี', 'Hazelnut spread':'เฮเซลนัทสเปรด',
  'Original peanut butter':'เนยถั่วออริจินัล', 'Cacao peanut butter':'เนยถั่วคาเคา', Caramel:'คาราเมล', Granola:'กราโนล่า', Blueberries:'บลูเบอร์รี่', Strawberries:'สตรอว์เบอร์รี่'};
const EXTRA = {Granola:10, Blueberries:15, Strawberries:15};
const BASE = {g1n:69, g1:89, g2:129, acai:189, banana:149};
const DEF = {acai:ACAI, banana:BANANA};
const catOf = n => Object.keys(CAT).find(c => CAT[c].includes(n));
const ALL = Object.values(CAT).flat();

function refPrice(o){
  if(o.menu === 'greek'){
    let p = BASE[o.size];
    if(o.size === 'g1n') p += 15 * o.picks.length;
    else { const free = o.picks.filter(n => !(n in EXTRA)).length; p += Math.max(0, free - 3) * 15 + o.picks.filter(n => n in EXTRA).reduce((a, n) => a + EXTRA[n], 0); }
    return p + (o.sep && o.picks.length ? 5 : 0);
  }
  let p = BASE[o.menu];
  DEF[o.menu].forEach((d, i) => { const n = o.comps[i]; if(n !== null && n !== d && !(d in EXTRA) && n in EXTRA) p += EXTRA[n]; });
  p += 15 * o.adds.length;
  return p + (o.sep && (o.comps.some(n => n !== null) || o.adds.length) ? 5 : 0);
}
/* ตะกร้าที่ควรเห็น (§2 ชื่อไทย · §4 เปลี่ยน/ไม่รับ/เพิ่ม · Greek แสดงทั้งหมด) · คืน {tag: [ข้อความ]} เรียงแล้ว */
/* ชื่อ ×n + ค่าเพิ่มบอกจำนวนชิ้นที่คิดเงิน (Tee 2026-10-16): ฟรีหมด "กล้วย ×2" · คิดทุกชิ้น "กล้วย ×2 · +30" · คิดบางชิ้น "กล้วย ×2 · เพิ่ม 1 ชิ้น +15"
   pieces = [[ชื่อ, ราคาที่คิดชิ้นนี้]] ตามลำดับที่กด */
const multiset = pieces => { const c = {}; pieces.forEach(([n, x]) => { const t = c[n] = c[n] || {n:0, paid:0, money:0}; t.n++; if(x){ t.paid++; t.money += x; } });
  return Object.entries(c).map(([n, t]) => TH[n] + (t.n > 1 ? ' ×' + t.n : '') + (!t.money ? '' : t.paid >= t.n ? ` · +${t.money}` : ` · เพิ่ม ${t.paid} ชิ้น +${t.money}`)).sort(); };
/* ราคาของแต่ละชิ้นใน Greek ตาม §3 */
const greekPieces = o => { let free = 0; return o.picks.map(n => [n, o.size === 'g1n' ? 15 : n in EXTRA ? EXTRA[n] : (++free > 3 ? 15 : 0)]); };
function refGroups(o){
  const G = {};
  if(o.menu === 'greek'){ G['ท็อปปิ้ง:'] = o.picks.length ? multiset(greekPieces(o)) : ['ไม่มี']; return G; }
  const ch = [], no = [];
  DEF[o.menu].forEach((d, i) => { const n = o.comps[i];
    if(n === null) no.push(TH[d]);
    else if(n !== d) ch.push(`${TH[n]} แทน ${TH[d]}` + (!(d in EXTRA) && n in EXTRA ? ` (+${EXTRA[n]})` : '')); });
  if(ch.length) G['เปลี่ยน:'] = ch.sort();
  if(o.adds.length) G['เพิ่ม:'] = multiset(o.adds.map(n => [n, 15]));
  if(no.length) G['ไม่รับ:'] = no.sort();
  if(!Object.keys(G).length) G['ตามสูตร'] = [];
  return G;
}

(async () => {
  const p = open({now: new Date(2026, 9, 16, 12, 0).getTime()}), {$, $$, click, ev} = p;
  p.signIn('1234'); if($('#floatSkip')) click('#floatSkip'); else ev('closeModal()');

  /* กดแก้วผ่านหน้าจอ แล้วตอบหน้าต่างถาม: 69 แพงกว่า → คงไว้ · ฟรีไม่ครบ → ลูกค้าขอแค่ N อย่าง · 89 ไม่มีท็อปปิ้ง → เปลี่ยนเป็น 69 (§3.6) */
  function addCup(o){
    p.menu(o.menu); if(o.size) p.size(o.size);
    o.picks.forEach(n => click(`[data-pick="${n}"]`));
    o.comps.forEach((n, i) => { const d = DEF[o.menu][i];
      if(n === null) click(`[data-skip="${i}"]`);
      else if(n !== d){ click(`[data-swap="${i}"]`); click(`#modal [data-choose="${n}"][data-slot="${i}"]`); } });
    if(o.adds.length){ click('[data-addopen]'); o.adds.forEach(n => click(`#modal [data-add="${n}"]`)); click('#addsDone'); }
    if(o.sep){ if($('[data-sep]')) click('[data-sep]'); else o.sep = false; }
    if($('[data-honey]')) click(`[data-honey="${o.honey}"]`);
    if($('[data-noteopen]') && o.note) click('[data-noteopen]');
    if(o.note && $('#note')){ const t = $('#note'); t.value = o.note; t.dispatchEvent(new p.w.Event('input', {bubbles:true})); }
    click('#btnAdd');
    for(let k = 0; k < 4 && ev('!!sel.menu'); k++){
      if($('#cheapKeep')) click('#cheapKeep');
      else if($('#fewPlain')){ click('#fewPlain'); o.size = 'g1n'; o.picks = []; o.sep = false; }   // เสนอ 69 ไม่ใส่ท็อปปิ้ง
      else if($('#fewOk')) click('#fewOk');
      else break;
    }
  }

  const r = rng(30), N = 150; let badPrice = null, badCart = null, badRcpt = null, badSale = null, sold = 0;
  for(let n = 0; n < N; n++){
    const menu = r.pick(['greek', 'greek', 'acai', 'banana']);
    const o = {menu, picks:[], comps:[], adds:[], sep: r() < 0.3, honey: r.pick(['none', 'little', 'normal', 'lots', 'side']), note: r() < 0.2 ? 'ไม่ใส่ช้อน, ขอทิชชู่' : ''};
    if(menu === 'greek'){ o.size = r.pick(['g1n', 'g1', 'g2']); const k = r.int(7); for(let i = 0; i < k; i++) o.picks.push(r.pick(ALL)); }
    else {
      o.comps = DEF[menu].map(d => { const x = r(); if(x < 0.55) return d; if(x < 0.7) return null; return r.pick(CAT[catOf(d)]); });
      const k = r() < 0.4 ? r.int(4) : 0; for(let i = 0; i < k; i++) o.adds.push(r.pick(ALL));
    }
    ev('cart = []; promo = null; renderCart()');
    addCup(o);
    const c = ev('cart.map(i => ({unit:i.unit, qty:i.qty}))');
    const exp = refPrice(o);
    if(!badPrice && (c.length !== 1 || c[0].unit !== exp)) badPrice = {seed:30, i:n, order:o, cart:c, exp};

    /* C15 ตะกร้า: แถวละกลุ่ม · เทียบกับออเดอร์ */
    const rows = $$('#cart .line .cg').map(x => x.textContent.trim());
    const got = {};
    rows.forEach(t => { const m = t.match(/^(เปลี่ยน:|ท็อปปิ้ง:|เพิ่ม:|ไม่รับ:) (.*)$/); if(m) got[m[1]] = m[2].split(', ').sort(); else if(t === 'ตามสูตร') got['ตามสูตร'] = []; });
    const noRow = $$('#cart .line .cg.no').map(x => x.textContent.trim());
    const okNo = noRow.length === ('ไม่รับ:' in got ? 1 : 0) && noRow.every(t => t.startsWith('ไม่รับ:'));
    const hasHoney = menu !== 'banana' ? rows.some(t => t.includes('น้ำผึ้ง: ')) : !rows.some(t => t.includes('น้ำผึ้ง'));
    const hasNote = o.note ? rows.includes('หมายเหตุ: ' + o.note) : true;
    if(!badCart && (JSON.stringify(got) !== JSON.stringify(refGroups(o)) || !okNo || !hasHoney || !hasNote)) badCart = {seed:30, i:n, order:o, rows, exp:refGroups(o)};

    /* ชำระเงิน (เงินสดพอดี) แล้วเทียบบิล + ใบเสร็จ */
    if(!c.length){ continue; }
    const s = p.pay('cash'); sold++;
    if(!badSale && (!s || s.total !== exp || s.items.length !== 1 || s.items[0].unit !== exp || s.received !== exp || s.change !== 0)) badSale = {seed:30, i:n, order:o, sale:s && {total:s.total, unit:s.items[0] && s.items[0].unit}, exp};
    if(s){
      const lines = ev(`slipLines(receiptBlocks(lastSale))`);
      const rcpt = lines.filter(t => /^(เปลี่ยน:|ท็อปปิ้ง:|เพิ่ม:|ไม่รับ:) /.test(t));
      const cartG = rows.filter(t => /^(เปลี่ยน:|ท็อปปิ้ง:|เพิ่ม:|ไม่รับ:) /.test(t));
      const totalLine = lines.find(t => t.startsWith('รวม '));
      if(!badRcpt && (JSON.stringify(rcpt) !== JSON.stringify(cartG) || totalLine !== `รวม ฿${exp.toLocaleString('en-US')}`)) badRcpt = {seed:30, i:n, rcpt, cart:cartG, totalLine, exp};
    }
  }
  console.log(`INFO P30 ${N} แก้วสุ่ม ขายได้ ${sold} บิล`);
  eq('P30 สุ่ม 150 แก้วผ่านหน้าเลือกออเดอร์ (seed 30): ราคาในตะกร้า = ฟังก์ชันอ้างอิงจาก business-rules', badPrice, null);
  eq('P30 ยอดบิล / ราคาต่อแก้ว / รับเงิน / ทอน ตรงทุกบิล', badSale, null);
  eq('C15 ตะกร้าแสดงเปลี่ยน / ท็อปปิ้ง / เพิ่ม / ไม่รับ ตรงกับที่สั่ง รวม "เพิ่ม N ชิ้น +฿" · "ตามสูตร" เมื่อไม่แก้ · ไม่รับ ใช้แถว .no · น้ำผึ้ง (ไม่มีใน Banana) · หมายเหตุ', badCart, null);
  eq('C15 ใบเสร็จแสดงกลุ่มท็อปปิ้งเหมือนตะกร้าทุกบรรทัด และยอด "รวม" ถูก', badRcpt, null);
  eq('P30 บิลที่ขายทั้งหมดอยู่ในเครื่อง เลขเรียง 1..N ไม่ซ้ำ', (() => { const no = ev('loadSales().map(s => s.no)'); return [no.length, new Set(no).size, no[no.length - 1]]; })(), [sold, sold, sold]);

  /* ---------- C16 ปิดหน้าต่างด้วย X ---------- */
  ev('cart = []; promo = null; renderCart()');
  p.add({menu:'acai'}); p.add({menu:'banana'});
  const before = ev('loadSales().length');
  click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="cash"]'); click('[data-q]');
  click('#closeX');
  eq('C16 หน้าชำระเงิน: X = ยกเลิก ไม่มีบิล ตะกร้ายังอยู่ · เปิดใหม่ต้องเลือกกินเลย/กลับบ้านใหม่', [ev('loadSales().length') - before, ev('cart.length'), !!$('#modal [data-dine]'), (click('#btnPay'), $$('#modal [data-dine].on').length)], [0, 2, false, 0]);
  click('#closeX');
  click('#promoOpen'); click('#modal [data-pid="b1g1"]'); click('#closeX');
  eq('C16 หน้าต่างโปร: เลือกโปรแล้วกด X = ไม่ใช้โปร ยอดเต็ม', [ev('promo'), ev('cartTotal()')], [null, 338]);
  click('#promoOpen'); click('#modal [data-pid="b1g1"]'); click('#promoOk');
  click('#promoOpen'); click('#modal [data-pid="off30"]') ; click('#closeX');
  eq('C16 มีโปรอยู่แล้ว เปิดหน้าต่างเลือกโปรอื่นแล้วกด X = โปรเดิมยังอยู่', [ev('promo && promo.id'), ev('cartTotal()')], ['b1g1', 189]);

  eq('no runtime errors', p.errors, []);
  p.close(); done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
