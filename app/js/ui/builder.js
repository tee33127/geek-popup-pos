/* ---------- Builder state ---------- */
let sel;
function resetSel(){ sel = {menu:null, size:null, picks:[], comps:[], swapSlot:null, honey:CONFIG.honeyDefault, sep:false, adds:[], addOpen:false, note:''}; }
resetSel();
const curMenu = () => sel.menu ? MENU[sel.menu] : null;
/* น้ำผึ้งไม่มีค่าเริ่มต้น ต้องเลือกก่อนเพิ่มลงออเดอร์ (ยกเว้นเมนูที่ไม่มีน้ำผึ้ง) */
const needHoney = () => { const m = curMenu(); return !!m && !m.noHoney && !sel.honey; };

function pickMenu(id){
  if(sel.menu === id) return;
  const m = MENU[id];
  sel = {menu:id, size:m.sizes ? 'g1' : null, picks:[], comps:m.defaults ? [...m.defaults] : [], swapSlot:null, honey:CONFIG.honeyDefault, sep:false, adds:[], addOpen:false, note:''};
}

function sec(n, title, body, right=''){ return `<div class="sec"><p class="step"><b>${n}</b> ${title}${right}</p>${body}</div>`; }

/* ตัวนับโควตาฟรี + ป้ายส้ม "คิดเพิ่ม" รวมทุกชิ้นที่คิดเงิน (กลุ่มฟรีที่เกินโควตา + กลุ่ม Extra) = ยอดที่พนักงานบอกลูกค้า */
function topCounter(P){
  if(P.perTop){ const pcs = P.tops.reduce((a, t) => a + t.n, 0), money = P.tops.reduce((a, t) => a + t.extra, 0);
    return `<span class="cnts"><span class="cnt">ชิ้นละ ${P.perTop}</span>${pcs ? `<span class="cnt over">${pcs} ชิ้น +${baht(money)}</span>` : ''}</span>`; }
  const q = CONFIG.freeToppingCount, over = Math.max(0, P.freeUsed - q);
  const pcs = over + P.tops.filter(t => ITEM[t.name] && ITEM[t.name].price > 0).reduce((a, t) => a + t.n, 0);
  const money = P.tops.reduce((a, t) => a + t.extra, 0);
  return `<span class="cnts"><span class="cnt">ฟรี ${Math.min(P.freeUsed, q)}/${q}</span>` +
    (pcs ? `<span class="cnt over">คิดเพิ่ม ${pcs} ชิ้น +${baht(money)}</span>` : '') + `</span>`;
}

/* ปุ่มแยกท็อปปิ้ง: ท้ายขั้นท็อปปิ้ง ใหญ่เต็มแถว ขอบส้มให้เห็นชัด · แสดงเมื่อแก้วมีท็อปปิ้ง */
function sepHtml(P){
  if(!P.tops.some(t => !t.removed)) return '';
  const on = !!sel.sep;
  return `<button class="sep ${on ? 'on' : ''}" data-sep aria-pressed="${on}"><span class="sepbox">${on ? icon('check', 20) : ''}</span>` +
    `<span>แยกท็อปปิ้ง<small>ใส่ถ้วยแยกจากโยเกิร์ต</small></span><b>+${baht(CONFIG.separateToppingPrice)}</b></button>`;
}
function greekTopsHtml(P){
  const chip = it => {
    const t = P.tops.find(x => x.name === it.name), cnt = t ? t.n : 0;
    /* บรรทัดล่าง: จำนวน (×2) และเงินที่คิดเพิ่ม ไม่เขียนว่า "ฟรี" เพราะเลือกเกินโควตาแล้วจะไม่ฟรี
       ปุ่มสูงคงที่ (CSS) ไม่มีอะไรจะบอกก็ไม่ใส่บรรทัดล่าง ชื่อจึงอยู่กลางปุ่ม */
    /* ของหมด: กดเลือกไม่ได้ (ที่เลือกไว้แล้วยังกดเอาออกได้) */
    if(it.out && !cnt) return `<div class="topw out"><button class="top" disabled><span class="tn">${esc(it.th || it.name)}</span><small>หมด</small></button></div>`;
    let tag = '';
    if(cnt) tag = [cnt > 1 ? '×' + cnt : '', t.extra ? '+' + t.extra : ''].filter(Boolean).join(' · ');
    else if(P.perTop) tag = '+' + P.perTop;
    else if(it.price > 0) tag = '+' + it.price;
    else if(P.freeUsed >= CONFIG.freeToppingCount) tag = '+' + CONFIG.overToppingPrice;
    /* แตะ = เลือก 1 ชิ้น · แตะซ้ำ = เอาออกทั้งหมด · ปรับจำนวนในแถบ "ท็อปปิ้งที่เลือก" ด้านล่าง ปุ่มนี้จึงไม่เปลี่ยนขนาด */
    return `<div class="topw ${cnt ? 'on':''} ${cnt && t.extra ? 'over':''}"><button class="top" data-pick="${esc(it.name)}"><span class="tn">${esc(it.th || it.name)}</span>${tag ? `<small>${tag}</small>` : ''}</button></div>`;
  };
  let h = '';
  CONFIG.cats.forEach(c => {
    const list = CONFIG.items.filter(i => i.cat === c.id && i.price === 0);
    h += `<div class="gt">${c.th || c.name}</div><div class="tops">${list.map(chip).join('')}</div>`;
  });
  h += `<div class="gt">${P.perTop ? 'Extra' : 'Extra · คิดเพิ่มตามราคา'}</div><div class="tops">${CONFIG.items.filter(i => i.price > 0).map(chip).join('')}</div>`;
  /* แถบสรุป: เรียงตามลำดับที่เลือก · − จนเหลือ 0 = เอาออก */
  if(P.tops.length) h += `<div class="gt">ท็อปปิ้งที่เลือก</div><div class="tsel">` + P.tops.map(t => { const nm = esc(t.name);
    return `<div class="trow ${t.extra ? 'over':''}"><span class="nm">${esc(topName(t.name))}</span>${t.extra ? `<span class="px">+${t.extra}</span>` : ''}` +
      `<div class="tqty"><button data-less="${nm}" aria-label="ลด ${esc(topName(t.name))}">−</button><b>${t.n}</b><button data-more="${nm}" aria-label="เพิ่ม ${esc(topName(t.name))}">+</button></div></div>`; }).join('') + `</div>`;
  h += sepHtml(P);
  h += `<p class="hint">แตะเพื่อเลือก แตะอีกครั้งเพื่อเอาออก · เพิ่มหรือลดจำนวนที่ "ท็อปปิ้งที่เลือก"<br>${P.perTop ? `ขนาดนี้ทุกท็อปปิ้ง +${P.perTop} บาท/ชิ้น (รวม Extra) ไม่มีโควตาฟรี</p>` : `ฟรี ${CONFIG.freeToppingCount} ชิ้นแรก · ชิ้นที่ ${CONFIG.freeToppingCount+1} ขึ้นไป +${CONFIG.overToppingPrice} บาท/ชิ้น · Extra คิดตามราคาต่อชิ้น</p>`}`;
  return h;
}
function presetHtml(m){
  const P = priceSel();
  let h = '<p class="hint" style="margin:0 0 4px">เปลี่ยนได้ในหมวดเดียวกัน · เปลี่ยนเป็นของ Extra คิดเงินเพิ่มตามราคา (แต่ไม่แนะนำให้เปลี่ยน)</p>';
  m.defaults.forEach((d, i) => {
    const cur = sel.comps[i], removed = cur === null, ch = !removed && cur !== d, out = !removed && ITEM[cur].out;
    h += `<div class="comp ${ch ? 'changed' : ''} ${removed ? 'removed' : ''} ${out ? 'out' : ''}"><div class="nm">${esc(topName(removed ? d : cur))}<small>${out ? '<b class="outtag">หมด · กดเปลี่ยนหรือไม่รับ</b>' : removed ? 'ไม่รับ' : ch ? 'แทน ' + esc(topName(d)) + (P.tops[i].extra ? ` · <b class="px">+${P.tops[i].extra}</b>` : '') : 'มาพร้อมเมนู'}</small></div>` +
         (ch || removed ? `<button class="skip" data-reset="${i}">${removed ? 'ใส่กลับ' : 'คืนค่า'}</button>` : '') +
         (!removed ? `<button class="skip" data-skip="${i}">ไม่รับ</button>` : '') +
         `<button data-swap="${i}">${sel.swapSlot === i ? 'ปิด' : 'เปลี่ยน'}</button></div>`;
    if(sel.swapSlot === i){
      /* เลือกซ้ำกับช่องอื่นได้ (เช่น Acai กล้วย → สตรอว์เบอร์รี่ = สตรอว์เบอร์รี่ 2 ส่วน) ราคาตามกติกาเดิม */
      const cat = ITEM[d].cat;
      const opts = CONFIG.items.filter(it => it.cat === cat && it.name !== cur);
      const cost = it => it.name !== d && it.price > 0 && !(ITEM[d].price > 0) ? it.price : 0;   // ตรงกับ priceItem
      h += `<div class="tops swapgrid">` + (opts.map(it => it.out ? `<button class="top out" disabled><span class="tn">${esc(it.th || it.name)}</span><small>หมด</small></button>` : `<button class="top" data-choose="${esc(it.name)}" data-slot="${i}"><span class="tn">${esc(it.th || it.name)}</span>${cost(it) ? `<small>+${cost(it)}</small>` : ''}</button>`).join('') || '<span class="hint">ไม่มีตัวเลือกอื่นในหมวดนี้</span>') + `</div>`;
    }
  });
  return h + addsHtml(P) + sepHtml(P);
}
/* Acai / Banana Choco: เพิ่มท็อปปิ้ง ชิ้นละ addTopPrice ทุกอย่าง · ปุ่มเปิดตารางเลือก + แถบจำนวนแบบเดียวกับ Greek */
function addsHtml(P){
  const adds = P.tops.filter(t => t.add), price = CONFIG.addTopPrice;
  let h = `<div class="gt">เพิ่มท็อปปิ้ง <small>ชิ้นละ ${price} บาท</small></div>`;
  if(adds.length) h += `<div class="tsel">` + adds.map(t => { const nm = esc(t.name);
    return `<div class="trow over"><span class="nm">เพิ่ม ${esc(topName(t.name))}</span><span class="px">+${t.extra}</span>` +
      `<div class="tqty"><button data-aless="${nm}" aria-label="ลด ${esc(topName(t.name))}">−</button><b>${t.n}</b><button data-amore="${nm}" aria-label="เพิ่ม ${esc(topName(t.name))}">+</button></div></div>`; }).join('') + `</div>`;
  h += `<button class="ghost wide" data-addopen>${sel.addOpen ? 'ปิดรายการท็อปปิ้ง' : '+ เพิ่มท็อปปิ้ง'}</button>`;
  if(sel.addOpen) CONFIG.cats.forEach(c => {
    h += `<div class="gt">${c.th || c.name}</div><div class="tops">` + CONFIG.items.filter(i => i.cat === c.id).map(it => {
      const t = adds.find(x => x.name === it.name);
      if(it.out && !t) return `<div class="topw out"><button class="top" disabled><span class="tn">${esc(it.th || it.name)}</span><small>หมด</small></button></div>`;
      return `<div class="topw ${t ? 'on over' : ''}"><button class="top" data-add="${esc(it.name)}"><span class="tn">${esc(it.th || it.name)}</span><small>${t ? `×${t.n} · +${t.extra}` : '+' + price}</small></button></div>`;
    }).join('') + '</div>';
  });
  return h;
}
function renderBuilder(){
  const m = curMenu(), P = priceSel(); let n = 0;
  let h = sec(++n, 'เลือกเมนู', '<div class="bases">' + CONFIG.menus.map(x =>
    (x.out && sel.menu !== x.id ? `<button class="base out" disabled><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>หมด</small></button>`
      : `<button class="base ${sel.menu === x.id ? 'on':''}" data-menu="${x.id}"><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>${menuPriceLabel(x)}</small></button>`)).join('') + '</div>');
  if(m){
    if(m.sizes){
      h += sec(++n, 'เลือกขนาด', '<div class="sizes">' + m.sizes.map(s =>
        `<button class="size ${sel.size === s.id ? 'on':''}" data-size="${s.id}">${esc(s.name)}<small>${esc(s.sub)}</small><small><b>${baht(s.price)}</b></small></button>`).join('') + '</div>');
      if(P.noTop) h += sec(++n, 'ท็อปปิ้ง', '<div class="empty" style="padding:6px 0">ขนาดนี้ไม่มีท็อปปิ้ง</div>');
      else h += sec(++n, 'ท็อปปิ้ง', greekTopsHtml(P), topCounter(P));
    } else {
      h += sec(++n, 'ท็อปปิ้งที่มากับเมนู', presetHtml(m));
    }
    if(!m.noHoney) h += sec(++n, 'น้ำผึ้ง <small>(ฟรี)</small>', '<div class="honey">' + CONFIG.honey.map(x =>
      `<button class="hon ${sel.honey === x.id ? 'on':''}" data-honey="${x.id}">${esc(x.name)}</button>`).join('') + '</div>',
      sel.honey ? '' : '<span class="cnts"><span class="cnt need">ต้องเลือก</span></span>');
    h += sec(++n, 'หมายเหตุ <small>(ถ้ามี)</small>', `<input class="note" id="note" placeholder="เช่น แพ้ถั่ว / ไม่เอาถ้วยใหญ่" value="${esc(sel.note)}">`);
  }
  $('builder').innerHTML = h;
  const add = $('btnAdd');
  add.disabled = !m || needHoney();
  add.textContent = !m ? 'เลือกเมนูก่อน' : needHoney() ? `เลือกน้ำผึ้งก่อน · ${baht(P.unit)}` : `เพิ่มลงออเดอร์ · ${baht(P.unit)}`;
}
$('builder').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('menu')) pickMenu(el.dataset.menu);
  else if(el = g('size')){ sel.size = el.dataset.size; if(MENU[sel.menu].sizes.find(s => s.id === sel.size).noTop) sel.picks = []; }
  else if(el = g('less')){ const i = sel.picks.lastIndexOf(el.dataset.less); if(i >= 0) sel.picks.splice(i, 1); }
  else if(el = g('more')) sel.picks.push(el.dataset.more);
  else if(el = g('pick')){ const n = el.dataset.pick; if(sel.picks.includes(n)) sel.picks = sel.picks.filter(x => x !== n); else sel.picks.push(n); }
  else if(el = g('choose')){ sel.comps[Number(el.dataset.slot)] = el.dataset.choose; sel.swapSlot = null; }
  else if(el = g('reset')){ const i = Number(el.dataset.reset); sel.comps[i] = MENU[sel.menu].defaults[i]; if(sel.swapSlot === i) sel.swapSlot = null; }
  else if(el = g('skip')){ const i = Number(el.dataset.skip); sel.comps[i] = null; if(sel.swapSlot === i) sel.swapSlot = null; }
  else if(el = g('swap')){ const i = Number(el.dataset.swap); sel.swapSlot = sel.swapSlot === i ? null : i; }
  else if(el = g('honey')) sel.honey = el.dataset.honey;
  else if(g('sep')) sel.sep = !sel.sep;
  else if(g('addopen')) sel.addOpen = !sel.addOpen;
  else if(el = g('add')){ const n = el.dataset.add; if(sel.adds.includes(n)) sel.adds = sel.adds.filter(x => x !== n); else sel.adds.push(n); }
  else if(el = g('amore')) sel.adds.push(el.dataset.amore);
  else if(el = g('aless')){ const i = sel.adds.lastIndexOf(el.dataset.aless); if(i >= 0) sel.adds.splice(i, 1); }
  else return;
  renderBuilder();
};
$('builder').addEventListener('input', e => { if(e.target.id === 'note') sel.note = e.target.value; });

/* เพิ่มรายการที่เลือกอยู่ลงตะกร้า · fewTops = จำนวนท็อปปิ้งฟรีที่ลูกค้าขอ เมื่อน้อยกว่าโควตาและพนักงานยืนยันแล้ว
   (ใช้พิมพ์เตือนบนตั๋วครัว และนับในรายงานเพื่อเทียบสต็อก) */
function addSel(fewTops){
  const m = curMenu(); if(!m || needHoney()) return;
  const P = priceSel();
  const item = {menu:m.id, name:m.name, sizeName:P.sizeName, tops:P.tops, ...(!m.noHoney && {honey:sel.honey}), note:sel.note.trim(), unit:P.unit, qty:1, ...(P.sep && {sep:P.sep})};
  if(fewTops !== undefined) item.fewTops = fewTops;
  item.key = JSON.stringify([item.menu, item.sizeName, item.tops.map(t => [t.name, t.n, t.removed ? 1 : 0, t.from, t.add ? 1 : 0]), item.honey, item.sep, item.note]);
  const found = cart.find(i => i.key === item.key);
  if(found) found.qty++; else cart.push(item);
  resetSel(); renderBuilder(); renderCart(); toast('เพิ่มแล้ว', 'check');
}
/* Greek: ท็อปปิ้งฟรีไม่ครบโควตา → ต้องยืนยันก่อน (กึ่งบังคับ ไม่บล็อก เพื่อให้บันทึกตรงกับที่ลูกค้าได้จริง)
   ปุ่มหลัก = กลับไปเลือกเพิ่ม · ไม่มีท็อปปิ้งเลยและมีขนาดราคาเริ่มต้น (69) → เสนอเปลี่ยนขนาดแทน (ลูกค้าไม่ต้องจ่ายเกิน) */
let fewPending = null;
function askFewTops(m, P){
  const q = CONFIG.freeToppingCount, n = P.freeUsed;
  const cur = m.sizes.find(s => s.id === sel.size), plain = m.sizes.find(s => (s.perTop || s.noTop) && s.name === cur.name);
  fewPending = {n, plain: !P.tops.length && plain ? plain.id : null};
  openModal(`<h3 class="warn">${icon('alert', 22)} ท็อปปิ้งฟรีเลือกไป ${n} จาก ${q} อย่าง</h3>
    <button class="pay" id="fewBack">กลับไปเลือกเพิ่ม</button>
    ${fewPending.plain
      ? `<button class="ghost wide" id="fewPlain">เปลี่ยนเป็น ${esc(plain.name)} ไม่ใส่ท็อปปิ้ง · ${baht(plain.price)}</button>`
      : `<button class="ghost wide" id="fewOk">${n ? `ลูกค้าขอแค่ ${n} อย่าง` : 'ลูกค้าไม่เอาท็อปปิ้งฟรี'}</button>`}`);
}
function fewTopsAnswer(id){
  const f = fewPending; fewPending = null; closeModal(); if(!f) return;
  if(id === 'fewOk') addSel(f.n);
  else if(id === 'fewPlain'){ sel.size = f.plain; sel.picks = []; addSel(); }
}
/* แก้ว 69 (ท็อปปิ้งชิ้นละ 15) ที่แพงกว่าแก้วขนาดเดียวกันแบบท็อปปิ้งฟรี 3 อย่าง (89) → เสนอเปลี่ยน (ลูกค้าไม่ต้องจ่ายเกิน)
   เทียบราคาจริงทั้งสองแบบด้วยท็อปปิ้งชุดเดียวกัน · ปุ่มหลัก = เปลี่ยน · ปุ่มรอง = คงไว้ */
let cheapPending = null;
function cheaperSize(m, P){
  if(!P.perTop || !P.tops.length) return null;
  const cur = m.sizes.find(s => s.id === sel.size), alt = m.sizes.find(s => !s.perTop && !s.noTop && s.name === cur.name);
  if(!alt) return null;
  const A = priceItem(m, {...sel, size:alt.id});
  return A.unit < P.unit ? {alt, A} : null;
}
function askCheaper(m, P, c){
  cheapPending = c;
  openModal(`<h3 class="warn">${icon('alert', 22)} แบบท็อปปิ้งฟรี ${CONFIG.freeToppingCount} อย่าง ถูกกว่า ${baht(P.unit - c.A.unit)}</h3>
    <p style="color:var(--mute);margin:0 0 6px">ท็อปปิ้งเท่าเดิม · ${esc(c.alt.name)} ${esc(c.alt.sub)} ราคา ${baht(c.A.unit)} แทน ${baht(P.unit)}</p>
    <button class="pay" id="cheapSwitch">เปลี่ยนเป็น ${esc(c.alt.name)} ${esc(c.alt.sub)} · ${baht(c.A.unit)}</button>
    <button class="ghost wide" id="cheapKeep">คงไว้ ชิ้นละ ${P.perTop} · ${baht(P.unit)}</button>`);
}
function cheaperAnswer(id){
  const c = cheapPending; cheapPending = null; closeModal(); if(!c) return;
  if(id === 'cheapKeep') return addSel();
  sel.size = c.alt.id; renderBuilder();
  const m = curMenu(), P = priceSel();
  if(P.freeUsed < CONFIG.freeToppingCount) return askFewTops(m, P);   // ยังเลือกฟรีได้อีก: ถามว่าจะเพิ่มไหม
  addSel();
}
$('btnAdd').onclick = () => {
  const m = curMenu(); if(!m || needHoney()) return;
  const P = priceSel();
  if(m.sizes && !P.noTop && !P.perTop && P.freeUsed < CONFIG.freeToppingCount) return askFewTops(m, P);
  const c = m.sizes && cheaperSize(m, P); if(c) return askCheaper(m, P, c);
  addSel();
};
