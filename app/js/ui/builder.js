/* ---------- หน้าเลือกออเดอร์แบบทีละขั้น (Tee 2026-10-13) ----------
   ลำดับ: เมนู → ขนาด (Greek) → ท็อปปิ้ง → น้ำผึ้ง (ไม่มีใน Banana Choco) → เพิ่มลงออเดอร์
   sel.at = ขั้นที่ทำค้างอยู่ (ไกลสุดที่ไปถึง) · sel.open = ขั้นที่กางอยู่ (กางได้ทีละขั้น) · ขั้นก่อนหน้ายุบเป็นแถวสรุป แตะเพื่อแก้
   ขั้นที่เลือกได้อย่างเดียว (เมนู ขนาด น้ำผึ้ง) เลือกแล้วไปต่อเอง · ท็อปปิ้งไปต่อด้วยปุ่มหลัก "ถัดไป: น้ำผึ้ง"
   ขั้นใหม่เพิ่งเปิด → เลื่อนจอให้อยู่บนสุด (smooth) · กดท็อปปิ้งทีละชิ้นไม่เลื่อน */
let sel, tallyHad = false;   // tallyHad: ตัวนับเคยมี "คิดเพิ่ม" แล้ว (กะพริบครั้งเดียวตอนเปลี่ยนจากไม่มีเป็นมี)
function resetSel(){ sel = {menu:null, size:null, picks:[], comps:[], swapSlot:null, honey:CONFIG.honeyDefault, sep:false, adds:[], addOpen:false, note:'', noteOpen:false, at:'menu', open:'menu', topsOk:null, fewTops:undefined}; tallyHad = false; }
resetSel();
const curMenu = () => sel.menu ? MENU[sel.menu] : null;
const stepsOf = m => !m ? ['menu'] : ['menu', ...(m.sizes ? ['size'] : []), 'tops', ...(m.noHoney ? [] : ['honey'])];
const stepNo = id => stepsOf(curMenu()).indexOf(id) + 1;
const lastStep = () => { const s = stepsOf(curMenu()); return s[s.length - 1]; };
/* กลับขั้นเลือกเมนู + เลื่อนหน้าขายขึ้นบนสุด · ใช้หลัง "เพิ่มลงออเดอร์" และ "ออเดอร์ถัดไป" (Tee 2026-10-13)
   เดิมไม่เลื่อนเลย ที่ดูเหมือนขึ้นบนเพราะหน้าสั้นลง · แนวตั้งตะกร้ายาว หน้าค้างกลางจอ และจ่ายเงินแล้วเมนูที่เลือกค้างไว้ยังอยู่ */
function backToMenu(){
  resetSel(); renderBuilder();
  (document.scrollingElement || document.documentElement).scrollTop = 0;
}
/* น้ำผึ้งไม่มีค่าเริ่มต้น ต้องเลือกก่อนเพิ่มลงออเดอร์ (ยกเว้นเมนูที่ไม่มีน้ำผึ้ง)
   ขนาดก็ไม่มีค่าเริ่มต้น (Tee 2026-10-13 กันพนักงานลืมถามขนาด) · ยังไม่เลือกขนาด = ไม่แสดงท็อปปิ้ง */
const needHoney = () => { const m = curMenu(); return !!m && !m.noHoney && !sel.honey; };
const needSize = () => { const m = curMenu(); return !!m && !!m.sizes && !sel.size; };

/* เลือกเมนูใหม่ = เริ่มแก้วใหม่ · เลือกเมนูเดิมตอนแก้ขั้นเมนู = ยุบกลับ ไม่ล้างอะไร */
function pickMenu(id){
  if(sel.menu === id){ sel.open = sel.at; return; }
  const m = MENU[id];
  sel = {menu:id, size:null, picks:[], comps:m.defaults ? [...m.defaults] : [], swapSlot:null, honey:CONFIG.honeyDefault, sep:false, adds:[], addOpen:false, note:'', noteOpen:false, at:'menu', open:'menu', topsOk:null, fewTops:undefined};
  tallyHad = false;
  advance();
}
/* ไปขั้นถัดจากขั้นที่ทำค้าง (หรือเปิดขั้นที่ไปถึงแล้วถัดจากขั้นท็อปปิ้ง) แล้วเลื่อนจอไปที่ขั้นนั้นหลังวาดเสร็จ */
let scrollTo_ = null;
function advance(){
  const s = stepsOf(curMenu()), from = s.indexOf(sel.open === sel.at ? sel.at : sel.open), next = s[from + 1];
  if(!next) return;
  if(s.indexOf(next) > s.indexOf(sel.at)) sel.at = next;
  sel.open = next; scrollTo_ = next;
}
/* ขั้นที่เลือกได้อย่างเดียว: ถ้าเป็นขั้นที่ทำค้าง → ไปต่อ · ถ้ากางมาแก้ → ยุบกลับไปขั้นที่ทำค้าง ไม่เลื่อนจอ */
function picked(step){ if(sel.at === step) advance(); else sel.open = sel.at; }
function scrollToStep(id){
  const el = document.querySelector(`[data-step="${id}"]`); if(!el || !el.scrollIntoView) return;
  const hd = document.querySelector('header');
  el.style.scrollMarginTop = ((hd ? hd.offsetHeight : 0) + 12) + 'px';   // แถบหัวติดจอ ไม่ให้บังหัวขั้น
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({behavior: calm ? 'auto' : 'smooth', block:'start'});
}

/* ทุกขั้นใช้โครงเดียวกัน (กล่อง + ระยะเว้นเท่ากัน) วงกลม/หัวขั้นจึงตรงแนวเดียวกันทุกสถานะ (Tee 2026-10-13)
   กาง = พื้นขาว วงกลมน้ำเงิน · เสร็จแล้ว (ยุบ) = วงกลมเขียว · ยังไม่เสร็จแต่ยุบอยู่ (กางขั้นอื่นมาแก้) = วงกลมเทา
   เนื้อหาในขั้นที่กาง (.sb) เริ่มแนวเดียวกับข้อความหัวขั้น */
function sec(id, title, body){
  return `<div class="sec open" data-step="${id}"><div class="sh"><b class="sn">${stepNo(id)}</b><span class="st">${title}</span></div><div class="sb">${body}</div></div>`;
}
function secDone(id, label, text, complete){
  return `<button class="sec ${complete ? 'done' : 'pending'}" data-step="${id}" data-open="${id}" aria-expanded="false"><span class="sh"><b class="sn">${stepNo(id)}</b>` +
    `<span class="st"><span class="lbl">${label}</span> ${text}</span><span class="chg">เปลี่ยน</span></span></button>`;
}
const stepComplete = id => id === 'menu' ? !!sel.menu : id === 'size' ? !!sel.size : id === 'honey' ? !!sel.honey : stepsOf(curMenu()).indexOf(id) < stepsOf(curMenu()).indexOf(sel.at);
/* ข้อความในแถวสรุป */
function summaryOf(id, P){
  const m = curMenu();
  if(id === 'menu') return esc(m.name) + (m.sizes ? '' : ` <span class="px">${baht(m.price)}</span>`);
  if(id === 'size'){ const s = m.sizes.find(x => x.id === sel.size); return s ? `${esc(s.name)} · ${esc(s.sub)} <span class="px">${baht(s.price)}</span>` : '<span class="need">ยังไม่เลือก</span>'; }
  if(id === 'tops'){
    const list = (m.defaults ? P.tops.filter(t => t.from || t.removed || t.add) : P.tops).map(t => m.defaults ? topLabel(t).replace(/ \(\+\d+\)$/, '') : topName(t.name) + (t.n > 1 ? ' ×' + t.n : ''));
    if(P.sep) list.push('แยกถ้วย');
    const money = P.tops.reduce((a, t) => a + t.extra, 0) + P.sep;
    return `${esc(list.join(', ') || (m.defaults ? 'ตามสูตร' : 'ไม่ใส่'))}${money ? ` · <span class="xtra">+${baht(money)}</span>` : ''}`;
  }
  if(id === 'honey') return sel.honey ? esc(HONEY[sel.honey].name) : '<span class="need">ยังไม่เลือก</span>';
}
const STEP_LABEL = {menu:'เมนู', size:'ขนาด', tops:'ท็อปปิ้ง', honey:'น้ำผึ้ง'};

/* ตัวนับท็อปปิ้งในแถบปุ่มหลัก (แสดงเฉพาะขั้นท็อปปิ้ง) · ทุกตัวเลขมาจาก P = priceSel() ตัวเดียวกับราคาบนปุ่ม
   Greek 89/129: ฟรี ●●○ 2/3 + คิดเพิ่ม N ชิ้น (ชิ้นฟรีที่เกินโควตา + Extra) · Greek 69: ชิ้นละ 15 · N ชิ้น · Acai/Banana: เปลี่ยน/เพิ่ม · แยก +5
   data-extra / data-sep ให้เทสต์เทียบกับราคาบนปุ่ม */
function tallyHtml(m, P){
  const money = P.tops.reduce((a, t) => a + t.extra, 0);
  let base = '', extra = '';
  if(m.sizes && P.perTop){
    const pcs = P.tops.reduce((a, t) => a + t.n, 0);
    base = `<span class="tq">ชิ้นละ ${P.perTop}</span>`;
    if(pcs) extra = `${pcs} ชิ้น +${baht(money)}`;
  } else if(m.sizes && !P.noTop){
    const q = CONFIG.freeToppingCount, used = Math.min(P.freeUsed, q), over = Math.max(0, P.freeUsed - q);
    const pcs = over + P.tops.filter(t => ITEM[t.name] && ITEM[t.name].price > 0).reduce((a, t) => a + t.n, 0);
    /* "ฟรี ●●○" ไม่มีตัวเลข (Tee 2026-10-13) · เต็ม = วงทึบ ว่าง = เส้นขอบ (ต่างกันที่รูปทรง ไม่ใช่แค่สี) */
    base = `<span class="tq" role="img" aria-label="ใช้ท็อปปิ้งฟรีแล้ว ${used} จาก ${q}">ฟรี <span class="fdots" aria-hidden="true">${Array.from({length:q}, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('')}</span></span>`;
    if(pcs) extra = `คิดเพิ่ม ${pcs} ชิ้น +${baht(money)}`;
  } else if(money) extra = `เปลี่ยน/เพิ่ม +${baht(money)}`;
  const flash = !!extra && !tallyHad; tallyHad = !!extra;
  return `<div class="tally" data-extra="${money}" data-sep="${P.sep}">${base}${extra ? `<span class="xtra ${flash ? 'flash' : ''}">${extra}</span>` : ''}${P.sep ? `<span class="tq">แยก +${baht(P.sep)}</span>` : ''}</div>`;
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
  let h = '';
  const body = {
    menu: () => '<div class="bases">' + CONFIG.menus.map(x =>
      (x.out && sel.menu !== x.id ? `<button class="base out" disabled><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>หมด</small></button>`
        : `<button class="base ${sel.menu === x.id ? 'on':''}" data-menu="${x.id}"><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>${menuPriceLabel(x)}</small></button>`)).join('') + '</div>',
    size: () => '<div class="sizes">' + m.sizes.map(s =>
      `<button class="size ${sel.size === s.id ? 'on':''}" data-size="${s.id}">${esc(s.name)}<small>${esc(s.sub)}</small><small><b>${baht(s.price)}</b></small></button>`).join('') + '</div>',
    tops: () => (m.sizes ? (P.noTop ? '<div class="empty" style="padding:6px 0">ขนาดนี้ไม่มีท็อปปิ้ง</div>' : greekTopsHtml(P)) : presetHtml(m, P)) + (lastStep() === 'tops' ? noteHtml() : ''),
    honey: () => '<div class="honey">' + CONFIG.honey.map(x => `<button class="hon ${sel.honey === x.id ? 'on':''}" data-honey="${x.id}">${esc(x.name)}</button>`).join('') + '</div>' + noteHtml(),
  };
  const title = {menu:'เลือกเมนู', size:'เลือกขนาด', tops: m && !m.sizes ? 'ท็อปปิ้งที่มากับเมนู' : 'ท็อปปิ้ง', honey:'น้ำผึ้ง <small>(ฟรี)</small>'};
  const steps = stepsOf(m), reached = steps.slice(0, steps.indexOf(sel.at) + 1);
  reached.forEach(id => { h += id === sel.open ? sec(id, title[id], body[id]()) : secDone(id, STEP_LABEL[id], summaryOf(id, P), stepComplete(id)); });
  $('builder').innerHTML = h;

  /* ปุ่มหลักตามขั้น · ขั้นเลือกอย่างเดียวที่กางมาแก้ (เลือกไว้แล้ว) ใช้ปุ่มของขั้นที่ทำค้าง */
  let cur = sel.open;
  if((cur === 'menu' && sel.menu) || (cur === 'size' && sel.size)) cur = sel.at;
  const add = $('btnAdd'), price = ` · ${baht(P ? P.unit : 0)}`;
  const st = cur === 'menu' ? ['เลือกเมนูก่อน', false] : cur === 'size' ? ['เลือกขนาดก่อน', false]
    : cur === 'tops' ? [(m.noHoney ? 'เพิ่มลงออเดอร์' : 'ถัดไป: น้ำผึ้ง') + price, true]
    : !sel.honey ? ['เลือกน้ำผึ้งก่อน', false] : ['เพิ่มลงออเดอร์' + price, true];
  add.textContent = st[0]; add.disabled = !st[1]; add.dataset.act = cur;
  const tally = cur === 'tops' ? tallyHtml(m, P) : '';
  $('tally').innerHTML = tally; $('actBar').classList.toggle('with-tally', !!tally);

  if(scrollTo_){ const id = scrollTo_; scrollTo_ = null; scrollToStep(id); }
}
$('builder').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('open')){ sel.open = el.dataset.open; sel.swapSlot = null; }
  else if(el = g('menu')) pickMenu(el.dataset.menu);
  else if(el = g('size')){ sel.size = el.dataset.size; if(MENU[sel.menu].sizes.find(s => s.id === sel.size).noTop) sel.picks = []; picked('size'); }
  else if(el = g('honey')){ sel.honey = el.dataset.honey; picked('honey'); }
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

/* ชุดท็อปปิ้ง Greek ที่ผ่านการถาม (ฟรีไม่ครบ / แก้ว 69 แพงกว่า) แล้ว · เปลี่ยนขนาดหรือท็อปปิ้ง = ต้องถามใหม่ */
const topsSig = () => JSON.stringify([sel.size, [...sel.picks].sort()]);

/* เพิ่มรายการที่เลือกอยู่ลงตะกร้า · fewTops = จำนวนท็อปปิ้งฟรีที่ลูกค้าขอ เมื่อน้อยกว่าโควตาและพนักงานยืนยันแล้ว
   (ใช้พิมพ์เตือนบนตั๋วครัว และนับในรายงานเพื่อเทียบสต็อก) */
function addSel(fewTops){
  const m = curMenu(); if(!m || needSize() || needHoney()) return;
  const P = priceSel();
  if(fewTops === undefined && sel.topsOk === topsSig()) fewTops = sel.fewTops;
  const item = {menu:m.id, name:m.name, sizeName:P.sizeName, tops:P.tops, ...(!m.noHoney && {honey:sel.honey}), note:sel.note.trim(), unit:P.unit, qty:1, ...(P.sep && {sep:P.sep})};
  if(fewTops !== undefined) item.fewTops = fewTops;
  item.key = JSON.stringify([item.menu, item.sizeName, item.tops.map(t => [t.name, t.n, t.removed ? 1 : 0, t.from, t.add ? 1 : 0]), item.honey, item.sep, item.note]);
  const found = cart.find(i => i.key === item.key);
  if(found) found.qty++; else cart.push(item);
  backToMenu(); renderCart(); toast('เพิ่มแล้ว', 'check');
}
/* Greek: ถามตอนกด "ถัดไป: น้ำผึ้ง" (ยังอยู่ในจังหวะคุยเรื่องท็อปปิ้ง) · ผ่านแล้ว → then() · ถ้าแก้ท็อปปิ้งทีหลังแล้วไม่ได้กดถัดไป จะถามอีกครั้งตอนเพิ่มลงออเดอร์
   ท็อปปิ้งฟรีไม่ครบโควตา → ต้องยืนยันก่อน (กึ่งบังคับ ไม่บล็อก) · แก้ว 69 แพงกว่า 89 → เสนอเปลี่ยน */
let topsThen = null;
function checkTops(then){
  const m = curMenu(), P = priceSel();
  if(!m.sizes || sel.topsOk === topsSig()) return then();
  topsThen = then;
  if(!P.noTop && !P.perTop && P.freeUsed < CONFIG.freeToppingCount) return askFewTops(m, P);
  const c = cheaperSize(m, P); if(c) return askCheaper(m, P, c);
  topsPassed(undefined);
}
function topsPassed(few){ sel.topsOk = topsSig(); sel.fewTops = few; const t = topsThen; topsThen = null; if(t) t(); }
/* ปุ่มหลัก: ขั้นท็อปปิ้ง → ถัดไป (หรือเพิ่ม ถ้าไม่มีน้ำผึ้ง) · ขั้นน้ำผึ้ง → เพิ่มลงออเดอร์ */
$('btnAdd').onclick = () => {
  const m = curMenu(), act = $('btnAdd').dataset.act; if(!m || $('btnAdd').disabled) return;
  if(act === 'tops' && !m.noHoney) return checkTops(() => { advance(); renderBuilder(); });
  if(needSize() || needHoney()) return;
  checkTops(() => addSel());
};
/* ท็อปปิ้งฟรีไม่ครบ: ปุ่มหลัก = กลับไปเลือกเพิ่ม (อยู่ขั้นท็อปปิ้งต่อ) · ไม่มีท็อปปิ้งเลยและมีขนาดราคาเริ่มต้น (69) → เสนอเปลี่ยนขนาดแทน */
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
  if(id === 'fewOk') return topsPassed(f.n);
  if(id === 'fewPlain'){ sel.size = f.plain; sel.picks = []; return topsPassed(undefined); }
  topsThen = null; sel.open = 'tops'; renderBuilder();   // กลับไปเลือกเพิ่ม
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
  if(id === 'cheapKeep') return topsPassed(undefined);
  sel.size = c.alt.id; renderBuilder();
  const m = curMenu(), P = priceSel();
  if(P.freeUsed < CONFIG.freeToppingCount) return askFewTops(m, P);   // ยังเลือกฟรีได้อีก: ถามว่าจะเพิ่มไหม
  topsPassed(undefined);
}
