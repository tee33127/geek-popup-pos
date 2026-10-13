/* ---------- หน้าเลือกออเดอร์ (Tee 2026-10-13 v3: ไม่ยุบขั้น) ----------
   ขั้นที่เปิดแล้วเปิดค้าง เห็นตัวเลือกครบ แก้ได้ด้วยการกดตัวเลือกตรงๆ · ขั้นที่ครบแล้ววงกลมเป็นเครื่องหมายถูกสีเขียว
   ลำดับการเปิด: Greek เมนู → ขนาด → (ท็อปปิ้ง + น้ำผึ้ง พร้อมกัน) · Acai เมนู → (ท็อปปิ้งตามสูตร + น้ำผึ้ง) · Banana Choco เมนู → ท็อปปิ้งตามสูตร
   ขั้นใหม่เลื่อนลงมาต่อท้าย (slide down + fade) แล้วเลื่อนจอให้อยู่ในจอ เฉพาะตอนเพิ่งเปิด · กดท็อปปิ้งไม่เลื่อน
   ปุ่มหลักหน้าที่เดียว "เพิ่มลงออเดอร์" · ยังไม่ครบ = สีเทา (class off) บอกสิ่งที่ขาด กดแล้วพาไปขั้นที่ขาด */
let sel, tallyHad = false, shownKeys = ['menu'];   // tallyHad: ช่องสรุปเคยมีส่วน "คิดเพิ่ม" (กะพริบครั้งเดียวตอนเปลี่ยนจากไม่มีเป็นมี) · shownKeys: ขั้นที่แสดงอยู่ (หาขั้นใหม่)
function resetSel(){ sel = {menu:null, size:null, picks:[], comps:[], swapSlot:null, honey:CONFIG.honeyDefault, sep:false, adds:[], addOpen:false, note:'', noteOpen:false}; tallyHad = false; }
resetSel();
const curMenu = () => sel.menu ? MENU[sel.menu] : null;
/* ขั้นที่แสดงตอนนี้ · Greek ยังไม่เลือกขนาด = ยังไม่แสดงท็อปปิ้ง/น้ำผึ้ง (ราคาท็อปปิ้งขึ้นกับขนาด) */
const stepsShown = m => !m ? ['menu'] : m.sizes ? (sel.size ? ['menu', 'size', 'tops', 'honey'] : ['menu', 'size']) : ['menu', 'tops', ...(m.noHoney ? [] : ['honey'])];
const lastStep = () => { const s = stepsShown(curMenu()); return s[s.length - 1]; };
/* กลับขั้นเลือกเมนู + เลื่อนหน้าขายขึ้นบนสุด · ใช้หลัง "เพิ่มลงออเดอร์" และ "ออเดอร์ถัดไป" (Tee 2026-10-13)
   เดิมไม่เลื่อนเลย ที่ดูเหมือนขึ้นบนเพราะหน้าสั้นลง · แนวตั้งตะกร้ายาว หน้าค้างกลางจอ และจ่ายเงินแล้วเมนูที่เลือกค้างไว้ยังอยู่ */
function backToMenu(){
  resetSel(); renderBuilder();
  (document.scrollingElement || document.documentElement).scrollTop = 0;
}
/* น้ำผึ้งไม่มีค่าเริ่มต้น ต้องเลือกก่อนเพิ่มลงออเดอร์ (ยกเว้นเมนูที่ไม่มีน้ำผึ้ง)
   ขนาดก็ไม่มีค่าเริ่มต้น (Tee 2026-10-13 กันพนักงานลืมถามขนาด) */
const needHoney = () => { const m = curMenu(); return !!m && !m.noHoney && !sel.honey; };
const needSize = () => { const m = curMenu(); return !!m && !!m.sizes && !sel.size; };
/* ขั้นที่ยังขาด (เรียงตามลำดับ) · null = เพิ่มลงออเดอร์ได้ */
const missingStep = () => !sel.menu ? 'menu' : needSize() ? 'size' : needHoney() ? 'honey' : null;
const MISSING_TEXT = {menu:'เลือกเมนูก่อน', size:'เลือกขนาดก่อน', honey:'เลือกน้ำผึ้งก่อน'};
/* ขั้นนี้เลือกครบแล้วหรือยัง (วงกลม → เครื่องหมายถูก) · ท็อปปิ้งตามสูตร = ครบตั้งแต่แรก · Greek ครบเมื่อเลือกอย่างน้อย 1 อย่าง */
const stepDone = id => id === 'menu' ? !!sel.menu : id === 'size' ? !!sel.size : id === 'honey' ? !!sel.honey : !!(curMenu() && (curMenu().defaults || sel.picks.length));

/* เลือกเมนูใหม่ = ขั้นหลังจากนั้นเริ่มใหม่ · กดเมนูเดิมซ้ำ = ไม่ล้างอะไร */
function pickMenu(id){
  if(sel.menu === id) return;
  const m = MENU[id];
  sel = {menu:id, size:null, picks:[], comps:m.defaults ? [...m.defaults] : [], swapSlot:null, honey:CONFIG.honeyDefault, sep:false, adds:[], addOpen:false, note:'', noteOpen:false};
  tallyHad = false;
}
const calm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* เลื่อนจอให้ขั้นอยู่ใต้แถบหัว (smooth · reduced motion = กระโดด) */
function scrollToStep(id){
  const el = document.querySelector(`[data-step="${id}"]`); if(!el || !el.scrollIntoView) return;
  const hd = document.querySelector('header');
  el.style.scrollMarginTop = ((hd ? hd.offsetHeight : 0) + 12) + 'px';   // แถบหัวติดจอ ไม่ให้บังหัวขั้น
  el.scrollIntoView({behavior: calm() ? 'auto' : 'smooth', block:'start'});
}
/* กดปุ่มหลักตอนยังไม่ครบ: พาไปขั้นที่ขาด แล้วกรอบกะพริบ 1 ครั้ง */
function flashStep(id){
  scrollToStep(id);
  const el = document.querySelector(`[data-step="${id}"]`); if(!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

/* หัวขั้น: วงกลมเลขขั้น (ครบแล้ว = ถูกสีเขียว) อยู่แค่ในหัวขั้น · เนื้อหาเต็มความกว้างกล่อง */
function sec(id, n, title, body, enter){
  const done = stepDone(id);
  return `<section class="sec ${done ? 'done' : ''} ${enter ? 'enter' : ''}" data-step="${id}"><div class="sh"><b class="sn" aria-label="${done ? 'ขั้นที่ ' + n + ' เลือกครบแล้ว' : 'ขั้นที่ ' + n}">${done ? icon('check', 18) : n}</b><span class="stitle">${title}</span></div><div class="sb">${body}</div></section>`;
}

/* ช่องสรุปแก้วที่กำลังเลือก (ซ้ายของแถบล่าง) · ทุกตัวเลขมาจาก P = priceSel() ตัวเดียวกับราคาบนปุ่ม
   Greek 89/129: ฟรี ●●○ + คิดเพิ่ม +฿X · Greek 69: ชิ้นละ 15 · N ชิ้น +฿X · Acai/Banana: ตามสูตร หรือ เปลี่ยน/เพิ่ม +฿X · แยก +฿5
   data-extra / data-sep ให้เทสต์เทียบกับราคาบนปุ่ม */
function cupSummaryHtml(m, P){
  if(!m) return `<div class="cupsum none">ยังไม่ได้เลือกเมนู</div>`;
  const money = P.tops.reduce((a, t) => a + t.extra, 0);
  let name = esc(m.name), mid = '', extra = '';
  if(m.sizes){
    const s = m.sizes.find(x => x.id === sel.size);
    if(s){
      name = esc((m.short || m.name) + ' ' + s.name);
      if(P.perTop){ const pcs = P.tops.reduce((a, t) => a + t.n, 0); mid = `ชิ้นละ ${P.perTop}`; if(pcs) extra = `${pcs} ชิ้น +${baht(money)}`; }
      else if(!P.noTop){
        /* "ฟรี ●●○" ไม่มีตัวเลข · เต็ม = วงทึบ ว่าง = เส้นขอบ (ต่างกันที่รูปทรง ไม่ใช่แค่สี) */
        const q = CONFIG.freeToppingCount, used = Math.min(P.freeUsed, q);
        mid = `<span class="tq" role="img" aria-label="ใช้ท็อปปิ้งฟรีแล้ว ${used} จาก ${q}">ฟรี <span class="fdots" aria-hidden="true">${Array.from({length:q}, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('')}</span></span>`;
        if(money) extra = `คิดเพิ่ม +${baht(money)}`;
      }
    }
  } else if(money) extra = `เปลี่ยน/เพิ่ม +${baht(money)}`;
  else mid = 'ตามสูตร';
  const flash = !!extra && !tallyHad; tallyHad = !!extra;
  const parts = [`<b class="cs-name">${name}</b>`, mid && `<span class="cs-mid">${mid}</span>`, extra && `<span class="xtra ${flash ? 'flash' : ''}">${extra}</span>`, P.sep && `<span class="cs-sep">แยก +${baht(P.sep)}</span>`].filter(Boolean);
  return `<div class="cupsum" data-extra="${money}" data-sep="${P.sep}">${parts.join('<span class="dot" aria-hidden="true">·</span>')}</div>`;
}

/* "+ หมายเหตุ" ลิงก์เล็กในขั้นสุดท้าย · มีข้อความแล้วแสดงช่องเลย */
function noteHtml(){
  if(!sel.noteOpen && !sel.note) return `<button class="linkbtn notelink" data-noteopen>+ หมายเหตุ</button>`;
  return `<div class="gt">หมายเหตุ</div><input class="note" id="note" placeholder="เช่น แพ้ถั่ว / ไม่เอาถ้วยใหญ่" value="${esc(sel.note)}">`;
}
/* แยกท็อปปิ้ง: แถวมีสวิตช์ เปิด/ปิด แบบหน้าตั้งค่า (แตะได้ทั้งแถว) ท้ายขั้นท็อปปิ้ง · แสดงเมื่อแก้วมีท็อปปิ้ง
   ปิด = แถวเรียบ ไม่แย่งสายตา · เปิด = พื้นส้มอ่อน (Tee 2026-10-13 เลิกกรอบเส้นประ) */
function sepHtml(P){
  if(!P.tops.some(t => !t.removed)) return '';
  const on = !!sel.sep;
  return `<button class="sep ${on ? 'on' : ''}" data-sep role="switch" aria-checked="${on}">` +
    `<span class="nm">แยกท็อปปิ้ง · ใส่ถ้วยแยก <b>+${baht(CONFIG.separateToppingPrice)}</b></span><span class="sw ${on ? 'on' : ''}"><span></span></span></button>`;
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
function presetHtml(m, P){
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
  const m = curMenu(), P = priceSel();
  const body = {
    menu: () => '<div class="bases">' + CONFIG.menus.map(x =>
      (x.out && sel.menu !== x.id ? `<button class="base out" disabled><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>หมด</small></button>`
        : `<button class="base ${sel.menu === x.id ? 'on':''}" data-menu="${x.id}" aria-pressed="${sel.menu === x.id}"><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>${menuPriceLabel(x)}</small></button>`)).join('') + '</div>',
    size: () => '<div class="sizes">' + m.sizes.map(s =>
      `<button class="size ${sel.size === s.id ? 'on':''}" data-size="${s.id}" aria-pressed="${sel.size === s.id}">${esc(s.name)}<small>${esc(s.sub)}</small><small><b>${baht(s.price)}</b></small></button>`).join('') + '</div>',
    tops: () => (m.sizes ? (P.noTop ? '<div class="empty" style="padding:6px 0">ขนาดนี้ไม่มีท็อปปิ้ง</div>' : greekTopsHtml(P)) : presetHtml(m, P)) + (lastStep() === 'tops' ? noteHtml() : ''),
    honey: () => '<div class="honey">' + CONFIG.honey.map(x => `<button class="hon ${sel.honey === x.id ? 'on':''}" data-honey="${x.id}" aria-pressed="${sel.honey === x.id}">${esc(x.name)}</button>`).join('') + '</div>' + noteHtml(),
  };
  const title = {menu:'เลือกเมนู', size:'เลือกขนาด', tops: m && !m.sizes ? 'ท็อปปิ้งที่มากับเมนู' : 'ท็อปปิ้ง', honey:'น้ำผึ้ง <small>(ฟรี)</small>'};
  /* ขั้นใหม่ = ไม่อยู่ในรอบก่อน · เปลี่ยนเมนู = ขั้นหลังเมนูนับเป็นขั้นใหม่ทั้งหมด (key มีชื่อเมนู) */
  const steps = stepsShown(m), keys = steps.map(id => id === 'menu' ? 'menu' : sel.menu + ':' + id);
  const fresh = steps.filter((id, i) => !shownKeys.includes(keys[i]));
  shownKeys = keys;
  $('builder').innerHTML = steps.map((id, i) => sec(id, i + 1, title[id], body[id](), fresh.includes(id))).join('');

  /* ปุ่มหลัก: หน้าที่เดียว · ยังไม่ครบ = สีเทา (ยังกดได้ เพื่อพาไปขั้นที่ขาด) */
  const add = $('btnAdd'), miss = missingStep();
  /* เลือกเมนู (และขนาดสำหรับ Greek) แล้ว ปุ่มเทาก็บอกราคาด้วย ให้พนักงานบอกลูกค้าได้ระหว่างเลือกท็อปปิ้ง (Tee 2026-10-13)
     ยังไม่เลือกเมนู/ขนาด = ยังไม่มีราคา · ราคาจาก P = priceSel() ตัวเดียวกับช่องสรุป */
  const priced = !!m && !needSize();
  add.textContent = miss ? MISSING_TEXT[miss] + (priced ? ` · ${baht(P.unit)}` : '') : `เพิ่มลงออเดอร์ · ${baht(P.unit)}`;
  add.classList.toggle('off', !!miss); add.disabled = false;   // ไม่ใช้ aria-disabled: ปุ่มเทายังทำงาน (พาไปขั้นที่ขาด) ข้อความบนปุ่มบอกสิ่งที่ขาดอยู่แล้ว
  $('tally').innerHTML = cupSummaryHtml(m, P);
  placeActBar();
  if(fresh.length) scrollToStep(fresh[0]);
}
/* แถบล่าง (position fixed) วางตรงกับกล่องเลือก · หน้าตา/ความสูงเดียวทุกขั้น */
function placeActBar(){
  const bar = $('actBar'), card = bar && bar.parentElement; if(!card || !card.getBoundingClientRect) return;
  const r = card.getBoundingClientRect(); if(!r.width) return;
  bar.style.left = r.left + 'px'; bar.style.width = r.width + 'px';
}
window.addEventListener('resize', placeActBar);
$('builder').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('menu')) pickMenu(el.dataset.menu);
  else if(el = g('size')){ sel.size = el.dataset.size; if(MENU[sel.menu].sizes.find(s => s.id === sel.size).noTop) sel.picks = []; }
  else if(el = g('honey')) sel.honey = el.dataset.honey;
  else if(g('noteopen')){ sel.noteOpen = true; renderBuilder(); const n = $('note'); if(n) n.focus(); return; }
  else if(el = g('less')){ const i = sel.picks.lastIndexOf(el.dataset.less); if(i >= 0) sel.picks.splice(i, 1); }
  else if(el = g('more')) sel.picks.push(el.dataset.more);
  else if(el = g('pick')){ const n = el.dataset.pick; if(sel.picks.includes(n)) sel.picks = sel.picks.filter(x => x !== n); else sel.picks.push(n); }
  else if(el = g('choose')){ sel.comps[Number(el.dataset.slot)] = el.dataset.choose; sel.swapSlot = null; }
  else if(el = g('reset')){ const i = Number(el.dataset.reset); sel.comps[i] = MENU[sel.menu].defaults[i]; if(sel.swapSlot === i) sel.swapSlot = null; }
  else if(el = g('skip')){ const i = Number(el.dataset.skip); sel.comps[i] = null; if(sel.swapSlot === i) sel.swapSlot = null; }
  else if(el = g('swap')){ const i = Number(el.dataset.swap); sel.swapSlot = sel.swapSlot === i ? null : i; }
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
  const m = curMenu(); if(!m || needSize() || needHoney()) return;
  const P = priceSel();
  const item = {menu:m.id, name:m.name, sizeName:P.sizeName, tops:P.tops, ...(!m.noHoney && {honey:sel.honey}), note:sel.note.trim(), unit:P.unit, qty:1, ...(P.sep && {sep:P.sep})};
  if(fewTops !== undefined) item.fewTops = fewTops;
  item.key = JSON.stringify([item.menu, item.sizeName, item.tops.map(t => [t.name, t.n, t.removed ? 1 : 0, t.from, t.add ? 1 : 0]), item.honey, item.sep, item.note]);
  const found = cart.find(i => i.key === item.key);
  if(found) found.qty++; else cart.push(item);
  backToMenu(); renderCart(); toast('เพิ่มแล้ว', 'check');
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
  else scrollToStep('tops');   // กลับไปเลือกเพิ่ม
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
/* ปุ่มหลัก: ยังไม่ครบ → พาไปขั้นที่ขาด (ไม่เพิ่ม) · ครบ → ถามเรื่องท็อปปิ้ง (Greek) แล้วเพิ่มลงออเดอร์ */
$('btnAdd').onclick = () => {
  const miss = missingStep(); if(miss) return flashStep(miss);
  const m = curMenu(), P = priceSel();
  if(m.sizes && !P.noTop && !P.perTop && P.freeUsed < CONFIG.freeToppingCount) return askFewTops(m, P);
  const c = m.sizes && cheaperSize(m, P); if(c) return askCheaper(m, P, c);
  addSel();
};
