/* ---------- หน้าเลือกออเดอร์ (Tee 2026-10-13 v3: ไม่ยุบขั้น) ----------
   ขั้นที่เปิดแล้วเปิดค้าง เห็นตัวเลือกครบ แก้ได้ด้วยการกดตัวเลือกตรงๆ · ขั้นที่ครบแล้ววงกลมเป็นเครื่องหมายถูกสีเขียว
   ลำดับการเปิด: Greek เมนู → ขนาด → (ท็อปปิ้ง + น้ำผึ้ง พร้อมกัน) · Acai เมนู → (ท็อปปิ้งตามสูตร + น้ำผึ้ง) · Banana Choco เมนู → ท็อปปิ้งตามสูตร
   ขั้นใหม่เลื่อนลงมาต่อท้าย (slide down + fade) แล้วเลื่อนจอให้อยู่ในจอ เฉพาะตอนเพิ่งเปิด · กดท็อปปิ้งไม่เลื่อน
   ปุ่มหลักหน้าที่เดียว "เพิ่มลงออเดอร์" · ยังไม่ครบ = สีเทา (class off) บอกสิ่งที่ขาด กดแล้วพาไปขั้นที่ขาด */
let sel, tallyHad = false, shownKeys = ['menu'], drawnMenu = null;   // tallyHad: ช่องสรุปเคยมีส่วน "คิดเพิ่ม" (กะพริบครั้งเดียวตอนเปลี่ยนจากไม่มีเป็นมี) · shownKeys: ขั้นที่แสดงอยู่ (หาขั้นใหม่) · drawnMenu: เมนูของรอบ render ก่อน (เมนูเปลี่ยน = เล่น menuMove)
function resetSel(){ sel = {menu:null, size:null, picks:[], comps:[], honey:CONFIG.honeyDefault, sep:false, adds:[], note:'', noteOpen:false}; tallyHad = false; }
resetSel();
const curMenu = () => sel.menu ? MENU[sel.menu] : null;
/* ขั้นที่แสดงตอนนี้ · Greek ยังไม่เลือกขนาด = ยังไม่แสดงท็อปปิ้ง/น้ำผึ้ง (ราคาท็อปปิ้งขึ้นกับขนาด) */
const stepsShown = m => !m ? ['menu'] : m.sizes ? (sel.size ? ['menu', 'size', 'tops', 'honey'] : ['menu', 'size']) : ['menu', 'tops', ...(m.noHoney ? [] : ['honey'])];
const lastStep = () => { const s = stepsShown(curMenu()); return s[s.length - 1]; };
/* กลับขั้นเลือกเมนู + เลื่อนหน้าขายขึ้นบนสุด · ใช้หลัง "เพิ่มลงออเดอร์" และ "ออเดอร์ถัดไป" (Tee 2026-10-13)
   เดิมไม่เลื่อนเลย ที่ดูเหมือนขึ้นบนเพราะหน้าสั้นลง · แนวตั้งตะกร้ายาว หน้าค้างกลางจอ และจ่ายเงินแล้วเมนูที่เลือกค้างไว้ยังอยู่ */
function backToMenu(){
  resetSel(); renderBuilder({top:true});   // เลื่อนขึ้นก่อนเล่น menuMove: กล่องเมนูขยายจากที่ที่เห็นอยู่ไปที่ใหม่บนจอ
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
  sel = {menu:id, size:null, picks:[], comps:m.defaults ? [...m.defaults] : [], honey:CONFIG.honeyDefault, sep:false, adds:[], note:'', noteOpen:false};
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
/* เลือก / เปลี่ยน / กลับเมนู: ค่อยๆ ย้ายแทนการกระโดด (Tee 2026-10-24)
   กล่องเมนูย่อ/ขยายไปที่ใหม่แบบ FLIP (วัดก่อน render → วัดหลัง → เล่นจากที่เดิมมาที่ใหม่) · ขั้นใหม่ค่อยๆ โผล่ออกมาจากเมนูที่กด
   ขยับเฉพาะ transform + opacity ด้วย el.animate (ไม่ใช้ View Transitions: ระหว่างเล่น จอเป็นภาพนิ่งที่กดไม่ได้)
   ไม่ล็อกการกด: ปุ่มของ layout ใหม่อยู่ใน DOM แล้ว กดขนาด/เมนูอื่นได้ทันที · กดซ้ำระหว่างเล่น = render ใหม่ทั้งชุด animation เก่าหายไปกับกล่องเก่า
   รอบใหม่เริ่มจากตำแหน่งที่เห็นอยู่ (getBoundingClientRect รวม transform) จึงไม่กระตุก ไม่ซ้อน · reduced motion / ไม่มี el.animate = เปลี่ยนทันทีเหมือนเดิม
   transform-origin 0 0 อยู่ใน pos.css · ลูกในการ์ดหักล้าง scale ของการ์ด: รูปย่อ/ขยายเป็นสี่เหลี่ยมจัตุรัสเสมอ ตัวหนังสือขนาดเดิม ไม่ยืด */
const MOVE_MS = 180, MOVE_AT = [0, .1, .25, .45, .7, 1], MOVE_PARTS = ['.pic', '.nm', 'small'];
const easeOut = t => 1 - Math.pow(1 - t, 3);   // เล่นเป็นช่วงๆ แบบ linear แล้วคำนวณ ease เอง การ์ดกับลูกจึงตรงกันทุกเฟรม
const boxOf = el => { const r = el.getBoundingClientRect(); return {l:r.left, t:r.top, w:r.width, h:r.height}; };
/* ความจางตอนวัด: กำลังเล่นอยู่ = ค่าที่เห็นตอนนี้ (กดซ้ำไม่กะพริบ) · นิ่งอยู่ = 0 (ตัวหนังสือจางเข้าใหม่) */
const fadeOf = el => el.getAnimations && el.getAnimations().length ? Number(getComputedStyle(el).opacity) : 0;
const menuCards = () => [...document.querySelectorAll('#builder .bases > .base')];
function menuRects(){
  if(calm() || !Element.prototype.animate) return null;
  const cards = menuCards(); if(!cards.length || !cards[0].getBoundingClientRect().width) return null;
  return cards.map(c => ({card:boxOf(c), parts:MOVE_PARTS.map(s => { const e = c.querySelector(s); return e && {...boxOf(e), o:fadeOf(e)}; })}));
}
function menuMove(first, freshIds){
  const cards = menuCards(), opt = {duration:MOVE_MS, easing:'linear'};
  /* วัดทุกอย่างก่อนเริ่มเล่น (animation ที่เริ่มแล้วทำให้ getBoundingClientRect ของลูกเพี้ยน) */
  const last = cards.map(c => ({card:boxOf(c), parts:MOVE_PARTS.map(s => { const e = c.querySelector(s); return e && boxOf(e); })}));
  const on = cards.find(c => c.classList.contains('on'));
  const secs = freshIds.map(id => document.querySelector(`#builder [data-step="${id}"]`)).filter(Boolean), secBox = secs.map(boxOf), from = on && boxOf(on);
  let moved = false;
  if(first.length === cards.length) cards.forEach((c, i) => {
    const A = first[i].card, B = last[i].card; if(!B.w || !B.h) return;
    const sx = A.w / B.w, sy = A.h / B.h, dx = A.l - B.l, dy = A.t - B.t;
    if(Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
    moved = true;
    const at = p => ({x:dx * (1 - p), y:dy * (1 - p), sx:sx + (1 - sx) * p, sy:sy + (1 - sy) * p});
    c.animate(MOVE_AT.map(t => { const k = at(easeOut(t)); return {offset:t, transform:`translate(${k.x}px,${k.y}px) scale(${k.sx},${k.sy})`}; }), opt);
    MOVE_PARTS.forEach((s, j) => {
      const e = c.querySelector(s), a = first[i].parts[j], b = last[i].parts[j]; if(!e || !a || !b || !b.w || !b.h) return;
      const pic = s === '.pic', ox = b.l - B.l, oy = b.t - B.t;   // ตำแหน่งในการ์ด (layout ใหม่)
      e.animate(MOVE_AT.map(t => { const p = easeOut(t), k = at(p);
        /* รูป: บินจากที่เดิม ย่อ/ขยายเป็นจัตุรัส · ตัวหนังสือ: อยู่ที่ใหม่ขนาดเดิม จางเข้าครึ่งหลัง (บินข้ามรูปแล้วดูรก) */
        const L = pic ? a.l + (b.l - a.l) * p : b.l, T = pic ? a.t + (b.t - a.t) * p : b.t, W = pic ? a.w + (b.w - a.w) * p : b.w, H = pic ? a.h + (b.h - a.h) * p : b.h;
        const f = {offset:t, transform:`translate(${(L - B.l - k.x) / k.sx - ox}px,${(T - B.t - k.y) / k.sy - oy}px) scale(${W / (k.sx * b.w)},${H / (k.sy * b.h)})`};
        if(!pic) f.opacity = a.o + (1 - a.o) * Math.max(0, (t - .4) / .6);
        return f; }), opt);
    });
  });
  /* ขั้นใหม่: ขยายออกจากใต้เมนูที่กด (scale รอบจุดกึ่งกลางการ์ดที่ขอบบนขั้น) · การ์ดย้าย = จางเข้าหลังการ์ดย่อไปเกือบถึงที่ ไม่ทับกัน
     เปลี่ยนเมนู (การ์ดไม่ย้าย) = จางเข้าทันที ไม่มีช่วงว่าง · จางอยู่ก็กดได้ (opacity ไม่ปิดการกด) */
  secs.forEach((el, i) => {
    const r = secBox[i], px = from ? Math.min(Math.max(from.l + from.w / 2 - r.l, 0), r.w) : r.w / 2, s = .94;
    el.animate([{opacity:0, transform:`translate(${px * (1 - s)}px,-6px) scale(${s})`}, {opacity:0, offset:moved ? .35 : 0, easing:'cubic-bezier(.2,.8,.2,1)'}, {opacity:1, transform:'none'}], {duration:MOVE_MS, easing:'linear'});
  });
}
/* กดปุ่มหลักตอนยังไม่ครบ: พาไปขั้นที่ขาด แล้วกรอบกะพริบ 1 ครั้ง */
function flashStep(id){
  scrollToStep(id);
  const el = document.querySelector(`[data-step="${id}"]`); if(!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

/* หัวขั้น: วงกลมเลขขั้น (ครบแล้ว = ถูกสีเขียว) อยู่แค่ในหัวขั้น · เนื้อหาเต็มความกว้างกล่อง */
function sec(id, n, title, body, enter, inline){
  const done = stepDone(id);
  return `<section class="sec ${done ? 'done' : ''} ${enter ? 'enter' : ''} ${inline ? 'inline' : ''}" data-step="${id}"><div class="sh"><b class="sn" aria-label="${done ? 'ขั้นที่ ' + n + ' เลือกครบแล้ว' : 'ขั้นที่ ' + n}">${done ? icon('check', 18) : n}</b><span class="stitle">${title}</span></div><div class="sb">${body}</div></section>`;
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
/* ปุ่มท็อปปิ้งแบบเดียวทั้งแอป (ตาราง Greek · หน้าต่างเปลี่ยน · หน้าต่างเพิ่มท็อปปิ้ง) (Tee 2026-10-15 เลือกแบบ A บน Redmi จริง)
   ขนาดเท่ากันทุกสถานะ · ข้อความชิดซ้าย ชื่อบรรทัดบน ราคา/จำนวนบรรทัดล่าง · ชื่อบรรทัดเดียว ยาวเกินลดขนาดตัวอักษร (fitNames) ห้ามตัดกลางคำ
   เลือกแล้ว: บรรทัดล่าง = "n ชิ้น · +฿ที่คิด" (ของฟรี "n ชิ้น") + ปุ่ม − เป็นแถบชิดขวาในปุ่ม (44px) มีเส้นคั่น
   ทุกปุ่มเว้นที่ขวาไว้เท่ากันเสมอ ชื่อจึงไม่ขยับตอนเลือก · ไม่มีอะไรยื่นออกนอกขอบปุ่ม (เคยชนวงกลมของปุ่มข้างๆ)
   o = {label, tag (ราคาตอนยังไม่เลือก), cnt, paid (เงินที่คิดของปุ่มนี้), out, over, extra (ของที่คิดเงินตามราคา: ป้ายสีส้มเสมอ), attr (ปุ่มหลัก), minus (ปุ่ม −)} */
function chipHtml(o){
  const tag = o.out ? 'หมด' : o.cnt ? [o.cnt + ' ชิ้น', o.paid ? '+' + o.paid : ''].filter(Boolean).join(' · ') : o.tag;
  return `<div class="topw ${o.cnt ? 'on' : ''} ${o.over ? 'over' : ''} ${o.extra ? 'extra' : ''} ${o.out && !o.cnt ? 'out' : ''}">` +
    `<button class="top" ${o.attr} ${o.out ? 'disabled' : ''} aria-label="${o.label}${o.cnt ? ` เลือก ${o.cnt} ชิ้น` : ''}${o.out ? ' หมด' : ''}"><span class="tn">${o.label}</span><small>${tag}</small></button>` +
    (o.cnt && o.minus ? `<button class="tminus" ${o.minus} aria-label="ลด ${o.label}"><span aria-hidden="true">−</span></button>` : '') + `</div>`;
}
/* ตารางท็อปปิ้งแบบเดียวทั้งแอป (ตาราง Greek · หน้าต่างเพิ่ม · หน้าต่างเปลี่ยน) (Tee 2026-10-15)
   กลุ่มละหมวด หัวข้อหมวดอยู่บนกลุ่ม · ไม่มีหมวด Extra บนจอ: Extra อยู่ในหมวดของมันเอง (cat ใน CONFIG.items) เรียงของฟรีก่อน ของที่คิดเงิน (price > 0) ท้ายหมวด
   เปลี่ยนแค่การแสดงผล ราคา/โควตา/กติกาเปลี่ยนในหมวดเดียวกัน ยังมาจาก cat และ price เหมือนเดิม */
const topRow = (label, list, chip) => `<div class="tcat"><div class="gt">${label}</div><div class="tops">${list.map(chip).join('')}</div></div>`;
function toppingGrid(chip, only){
  const keep = it => !only || only(it);
  return CONFIG.cats.map(c => { const all = CONFIG.items.filter(i => i.cat === c.id && keep(i)), list = [...all.filter(i => !(i.price > 0)), ...all.filter(i => i.price > 0)];
    return list.length ? topRow(esc(c.short || c.th || c.name), list, chip) : ''; }).join('');
}
/* ชื่อยาวเกินปุ่ม → ลดขนาดตัวอักษรของปุ่มนั้นทีละน้อย (ไม่ขึ้นบรรทัดใหม่ ไม่ตัดคำ) */
function fitNames(root){
  (root || document).querySelectorAll('.tops .tn').forEach(el => {
    el.style.fontSize = '';
    if(!el.clientWidth) return;
    let fs = parseFloat(getComputedStyle(el).fontSize);
    while(el.scrollWidth > el.clientWidth + 0.5 && fs > 11){ fs = Math.max(11, fs - 0.5); el.style.fontSize = fs + 'px'; }
  });
}
window.addEventListener('resize', () => fitNames());
/* ท็อปปิ้ง Greek: แตะปุ่ม = เพิ่ม 1 ชิ้น · ปุ่ม − = ลด 1 (ถึง 0 = เอาออก) */
function greekTopsHtml(P){
  const q = CONFIG.freeToppingCount;
  /* ป้ายราคาเหมือนกันทั้งก่อนและหลังเลือก = ราคาถ้าแตะเพิ่มอีก 1 ชิ้น */
  const nextTag = it => P.perTop ? '+' + P.perTop : it.price > 0 ? '+' + it.price : P.freeUsed >= q ? '+' + CONFIG.overToppingPrice : '';
  const chip = it => { const t = P.tops.find(x => x.name === it.name), cnt = t ? t.n : 0, n = esc(it.name);
    return chipHtml({label:esc(topName(it.name)), tag:nextTag(it), cnt, paid: t ? t.extra : 0, out:!!it.out, over:!!(cnt && t.extra), extra: it.price > 0, attr:`data-pick="${n}"`, minus:`data-less="${n}"`}); };
  return toppingGrid(chip) + sepHtml(P);
}
function presetHtml(m, P){
  let h = '<div class="comps">';
  m.defaults.forEach((d, i) => {
    const cur = sel.comps[i], removed = cur === null, ch = !removed && cur !== d, out = !removed && ITEM[cur].out;
    h += `<div class="comp ${ch ? 'changed' : ''} ${removed ? 'removed' : ''} ${out ? 'out' : ''}"><div class="nm">${esc(topName(removed ? d : cur))}<small>${out ? '<b class="outtag">หมด · กดเปลี่ยนหรือไม่รับ</b>' : removed ? 'ไม่รับ' : ch ? 'แทน ' + esc(topName(d)) + (P.tops[i].extra ? ` · <b class="px">+${P.tops[i].extra}</b>` : '') : 'มาพร้อมเมนู'}</small></div>` +
         (ch || removed ? `<button class="skip" data-reset="${i}">${removed ? 'ใส่กลับ' : 'คืนค่า'}</button>` : '') +
         (!removed ? `<button class="skip" data-skip="${i}">ไม่รับ</button>` : '') +
         `<button data-swap="${i}">เปลี่ยน</button></div>`;
  });
  return h + '</div>' + addsHtml(P) + sepHtml(P);
}
/* Acai / Banana Choco: ยังไม่มีของเพิ่ม = ปุ่ม "+ เพิ่มท็อปปิ้ง" · มีแล้ว = บรรทัดสรุปบรรทัดเดียว ไม่มีพื้นสี
   "+ เพิ่มท็อปปิ้ง: เมล็ดแฟลกซ์, ช็อกโกแลตครัมเบิล ×2 · +฿45  [แก้ไข]" แตะทั้งบรรทัด = เปิดหน้าต่างเพิ่มท็อปปิ้ง (ปรับจำนวนในนั้น) (Tee 2026-10-15) */
function addsHtml(P){
  const adds = P.tops.filter(t => t.add), price = CONFIG.addTopPrice;
  if(!adds.length) return `<div class="addrow"><button class="ghost" data-addopen>+ เพิ่มท็อปปิ้ง</button><small class="gt">ชิ้นละ ${price} บาท</small></div>`;
  const list = adds.map(t => esc(topName(t.name)) + (t.n > 1 ? ' ×' + t.n : '')).join(', '), money = adds.reduce((a, t) => a + t.extra, 0);
  return `<button class="addsum" data-addopen><span class="as-t"><span class="as-l">+ เพิ่มท็อปปิ้ง:</span> ${list} · <b>+${baht(money)}</b></span><span class="chg">แก้ไข</span></button>`;
}
/* หน้าต่าง "เปลี่ยน <ชื่อ> เป็น…": ปุ่มแบบเดียวกับตาราง Greek · เลือกซ้ำกับช่องอื่นได้ (Acai กล้วย → สตรอว์เบอร์รี่ = 2 ส่วน) · กดแล้วปิดเอง */
function openSwap(i){
  const m = curMenu(); if(!m || !m.defaults) return;
  const d = m.defaults[i], cur = sel.comps[i], cat = ITEM[d].cat;
  const opts = CONFIG.items.filter(it => it.cat === cat && it.name !== cur);
  const cost = it => it.name !== d && it.price > 0 && !(ITEM[d].price > 0) ? it.price : 0;   // ตรงกับ priceItem
  const chip = it => chipHtml({label:esc(topName(it.name)), tag: cost(it) ? '+' + cost(it) : '', out:!!it.out, extra: it.price > 0, attr:`data-choose="${esc(it.name)}" data-slot="${i}"`});
  const body = opts.length ? `<div class="swapgrid">${toppingGrid(chip, it => opts.includes(it))}</div>` : '<p class="note2">ไม่มีตัวเลือกอื่นในหมวดนี้</p>';
  openModal(body, {title:`เปลี่ยน ${esc(topName(cur === null ? d : cur))} เป็น…`, key:'swap', wide:true});   // กว้างเท่าหน้าต่างเพิ่ม ปุ่มขนาดเดียวกับตาราง Greek
  fitNames($('modal'));
}
/* หน้าต่าง "เพิ่มท็อปปิ้ง": แตะ = เพิ่ม 1 ชิ้น · − = ลด · เพิ่มได้หลายชิ้น แล้วกด "เสร็จ" */
function openAdds(){
  const price = CONFIG.addTopPrice, adds = priceSel().tops.filter(t => t.add);
  const body = toppingGrid(it => { const t = adds.find(x => x.name === it.name), n = esc(it.name);
    return chipHtml({label:esc(topName(it.name)), tag:'+' + price, cnt: t ? t.n : 0, paid: t ? t.extra : 0, out:!!it.out, over:!!t, extra: it.price > 0, attr:`data-add="${n}"`, minus:`data-aless="${n}"`}); });
  openModal(body, {title:`เพิ่มท็อปปิ้ง <small>ชิ้นละ ${price} บาท</small>`, key:'adds', wide:true, foot:'<button class="pay" id="addsDone">เสร็จ</button>'});
  fitNames($('modal'));
}
/* คลิกในหน้าต่างเปลี่ยน / เพิ่มท็อปปิ้ง */
$('modal').addEventListener('click', e => {
  const g = a => e.target.closest(`#modal [data-${a}]`); let el;
  if(el = g('choose')){ sel.comps[Number(el.dataset.slot)] = el.dataset.choose; closeModal(); renderBuilder(); }
  else if(el = g('add')){ sel.adds.push(el.dataset.add); renderBuilder(); openAdds(); }
  else if(el = g('aless')){ const i = sel.adds.lastIndexOf(el.dataset.aless); if(i >= 0) sel.adds.splice(i, 1); renderBuilder(); openAdds(); }
  else if(e.target.closest('#addsDone')) closeModal();
});
/* o.top = เลื่อนหน้าขายขึ้นบนสุด (backToMenu) */
function renderBuilder(o){
  const m = curMenu(), P = priceSel();
  const first = sel.menu !== drawnMenu ? menuRects() : null; drawnMenu = sel.menu;   // เมนูเปลี่ยน = วัดกล่องเมนูก่อนแทนที่ (menuMove)
  const body = {
    menu: () => `<div class="bases ${sel.menu ? 'compact' : ''}">` + CONFIG.menus.map(x =>
      (x.out && sel.menu !== x.id ? `<button class="base out" disabled><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>หมด</small></button>`
        : `<button class="base ${sel.menu === x.id ? 'on':''}" data-menu="${x.id}" aria-pressed="${sel.menu === x.id}"><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>${menuPriceLabel(x)}</small></button>`)).join('') + '</div>',
    size: () => `<div class="sizes ${sel.size ? 'compact' : ''}">` + m.sizes.map(s =>
      `<button class="size ${sel.size === s.id ? 'on':''}" data-size="${s.id}" aria-pressed="${sel.size === s.id}"><span class="sz">${esc(s.name)}</span><small>${esc(s.sub)}</small><small><b>${baht(s.price)}</b></small></button>`).join('') + '</div>',
    tops: () => (m.sizes ? (P.noTop ? '<div class="empty" style="padding:6px 0">ขนาดนี้ไม่มีท็อปปิ้ง</div>' : greekTopsHtml(P)) : presetHtml(m, P)) + (lastStep() === 'tops' ? noteHtml() : ''),
    honey: () => '<div class="honey">' + CONFIG.honey.map(x => `<button class="hon ${sel.honey === x.id ? 'on':''}" data-honey="${x.id}" aria-pressed="${sel.honey === x.id}">${esc(x.name)}</button>`).join('') + '</div>' + noteHtml(),
  };
  /* หัวขั้นสั้น · กติกาย่อไว้ใน <small> (แทนย่อหน้าคำอธิบายใต้ตาราง) */
  const P0 = P || {};
  const title = {menu: sel.menu ? 'เมนู' : 'เลือกเมนู', size: sel.size ? 'ขนาด' : 'เลือกขนาด',
    tops: m && !m.sizes ? 'ท็อปปิ้งที่มากับเมนู <small>เปลี่ยนได้ในหมวดเดียวกัน · ป้ายสีส้ม = คิดเงินเพิ่มตามราคา</small>'
      : `ท็อปปิ้ง <small>${P0.perTop ? `ทุกชิ้น +${P0.perTop} · แตะ = เพิ่ม 1 · − = ลด` : `ฟรี ${CONFIG.freeToppingCount} ชิ้นแรก · ชิ้นต่อไป +${CONFIG.overToppingPrice} · ป้ายสีส้ม = คิดเงินเพิ่มตามราคา · แตะ = เพิ่ม 1 · − = ลด`}</small>`,
    honey:'น้ำผึ้ง <small>(ฟรี)</small>'};
  /* เลือกแล้วย่อเป็นแถวเตี้ย (หัว + ตัวเลือกบรรทัดเดียว) ตัวเลือกยังอยู่ครบ กดเปลี่ยนได้ทันที · น้ำผึ้งเป็นแถวเดียวเสมอ */
  const inline = {menu: !!sel.menu, size: !!sel.size, honey: true};
  /* ขั้นใหม่ = ไม่อยู่ในรอบก่อน · เปลี่ยนเมนู = ขั้นหลังเมนูนับเป็นขั้นใหม่ทั้งหมด (key มีชื่อเมนู) */
  const steps = stepsShown(m), keys = steps.map(id => id === 'menu' ? 'menu' : sel.menu + ':' + id);
  const fresh = steps.filter((id, i) => !shownKeys.includes(keys[i]));
  shownKeys = keys;
  $('builder').innerHTML = steps.map((id, i) => sec(id, i + 1, title[id], body[id](), fresh.includes(id) && !first, inline[id])).join('');   // เล่น menuMove = ไม่ใช้ .enter ซ้อน

  /* ปุ่มหลัก: หน้าที่เดียว · ยังไม่ครบ = สีเทา (ยังกดได้ เพื่อพาไปขั้นที่ขาด) */
  const add = $('btnAdd'), miss = missingStep();
  /* เลือกเมนู (และขนาดสำหรับ Greek) แล้ว ปุ่มเทาก็บอกราคาด้วย ให้พนักงานบอกลูกค้าได้ระหว่างเลือกท็อปปิ้ง (Tee 2026-10-13)
     ยังไม่เลือกเมนู/ขนาด = ยังไม่มีราคา · ราคาจาก P = priceSel() ตัวเดียวกับช่องสรุป */
  const priced = !!m && !needSize();
  add.textContent = miss ? MISSING_TEXT[miss] + (priced ? ` · ${baht(P.unit)}` : '') : `เพิ่มลงออเดอร์ · ${baht(P.unit)}`;
  add.classList.toggle('off', !!miss); add.disabled = false;   // ไม่ใช้ aria-disabled: ปุ่มเทายังทำงาน (พาไปขั้นที่ขาด) ข้อความบนปุ่มบอกสิ่งที่ขาดอยู่แล้ว
  $('tally').innerHTML = cupSummaryHtml(m, P);
  cartMode(); placeActBar(); fitNames($('builder'));   // cartMode ก่อน: ความกว้างกล่องเลือกขึ้นกับกล่องออเดอร์ยุบหรือไม่
  if(o && o.top) (document.scrollingElement || document.documentElement).scrollTop = 0;
  if(first) menuMove(first, fresh);   // หลังจัด layout และเลื่อนจอแล้ว: วัดที่ใหม่ตรงกับที่จะเห็น
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
  else if(el = g('pick')) sel.picks.push(el.dataset.pick);   // แตะ = เพิ่ม 1 ชิ้น (ลดด้วยปุ่ม − มุมปุ่ม)
  else if(el = g('reset')){ const i = Number(el.dataset.reset); sel.comps[i] = MENU[sel.menu].defaults[i]; }
  else if(el = g('skip')){ const i = Number(el.dataset.skip); sel.comps[i] = null; }
  else if(el = g('swap')){ openSwap(Number(el.dataset.swap)); return; }
  else if(g('sep')) sel.sep = !sel.sep;
  else if(g('addopen')){ openAdds(); return; }
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
  cartFlash = item.key;   // บรรทัดนั้นในกล่องออเดอร์ไฮไลต์จางหาย
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
