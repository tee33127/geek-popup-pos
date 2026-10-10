/* ---------- Builder state ---------- */
let sel;
function resetSel(){ sel = {menu:null, size:null, picks:[], comps:[], swapSlot:null, honey:CONFIG.honeyDefault, note:''}; }
resetSel();
const curMenu = () => sel.menu ? MENU[sel.menu] : null;

function pickMenu(id){
  if(sel.menu === id) return;
  const m = MENU[id];
  sel = {menu:id, size:m.sizes ? 'g1' : null, picks:[], comps:m.defaults ? [...m.defaults] : [], swapSlot:null, honey:CONFIG.honeyDefault, note:''};
}

function sec(n, title, body, right=''){ return `<div class="sec"><p class="step"><b>${n}</b> ${title}${right}</p>${body}</div>`; }

function greekTopsHtml(P){
  const chip = it => {
    const t = P.tops.find(x => x.name === it.name), cnt = t ? t.n : 0;
    let tag;
    if(cnt) tag = t.extra ? '+' + t.extra : 'ฟรี';
    else if(it.price > 0) tag = '+' + it.price;
    else tag = P.freeUsed >= CONFIG.freeToppingCount ? '+' + CONFIG.overToppingPrice : 'ฟรี';
    return `<div class="topw"><button class="top ${cnt ? 'on':''} ${cnt && t.extra ? 'over':''}" data-pick="${esc(it.name)}">${esc(it.name)}${cnt > 1 ? ' ×' + cnt : ''}<small>${tag}</small></button>` +
      (cnt ? `<button class="minus" data-less="${esc(it.name)}" aria-label="ลด">−</button>` : '') + `</div>`;
  };
  let h = '';
  CONFIG.cats.forEach(c => {
    const list = CONFIG.items.filter(i => i.cat === c.id && i.price === 0);
    h += `<div class="gt">${c.name} · ฟรี</div><div class="tops">${list.map(chip).join('')}</div>`;
  });
  h += `<div class="gt">Extra · คิดเพิ่มตามราคา</div><div class="tops">${CONFIG.items.filter(i => i.price > 0).map(chip).join('')}</div>`;
  h += `<p class="hint">แตะซ้ำเพื่อเพิ่มจำนวน (เช่น Banana ×3) · กดปุ่ม − เพื่อลด<br>ฟรี ${CONFIG.freeToppingCount} ชิ้นแรก · ชิ้นที่ ${CONFIG.freeToppingCount+1} ขึ้นไป +${CONFIG.overToppingPrice} บาท/ชิ้น · Extra คิดตามราคาต่อชิ้น</p>`;
  return h;
}
function presetHtml(m){
  let h = '<p class="hint" style="margin:0 0 4px">เปลี่ยนท็อปปิ้งได้ฟรีในหมวดเดียวกัน (แต่ไม่แนะนำให้เปลี่ยน)</p>';
  m.defaults.forEach((d, i) => {
    const cur = sel.comps[i], removed = cur === null, ch = !removed && cur !== d;
    h += `<div class="comp ${ch ? 'changed' : ''} ${removed ? 'removed' : ''}"><div class="nm">${esc(removed ? d : cur)}<small>${removed ? 'ไม่รับ' : ch ? 'แทน ' + esc(d) : 'มาพร้อมเมนู'}</small></div>` +
         (ch || removed ? `<button class="skip" data-reset="${i}">${removed ? 'ใส่กลับ' : 'คืนค่า'}</button>` : '') +
         (!removed ? `<button class="skip" data-skip="${i}">ไม่รับ</button>` : '') +
         `<button data-swap="${i}">${sel.swapSlot === i ? 'ปิด' : 'เปลี่ยน'}</button></div>`;
    if(sel.swapSlot === i){
      const cat = ITEM[d].cat, used = sel.comps.filter((c, j) => j !== i && c !== null), banned = m.noSwap || [];
      const opts = CONFIG.items.filter(it => it.cat === cat && it.name !== cur && !used.includes(it.name) && !banned.includes(it.name));
      h += `<div class="tops swapgrid">` + (opts.map(it => `<button class="top" data-choose="${esc(it.name)}" data-slot="${i}">${esc(it.name)}<small>ฟรี</small></button>`).join('') || '<span class="hint">ไม่มีตัวเลือกอื่นในหมวดนี้</span>') + `</div>`;
    }
  });
  return h;
}
function renderBuilder(){
  const m = curMenu(), P = priceSel(); let n = 0;
  let h = sec(++n, 'เลือกเมนู', '<div class="bases">' + CONFIG.menus.map(x =>
    `<button class="base ${sel.menu === x.id ? 'on':''}" data-menu="${x.id}"><img class="pic" src="${x.img}" alt=""><div class="nm">${esc(x.name)}</div><small>${menuPriceLabel(x)}</small></button>`).join('') + '</div>');
  if(m){
    if(m.sizes){
      h += sec(++n, 'เลือกขนาด', '<div class="sizes">' + m.sizes.map(s =>
        `<button class="size ${sel.size === s.id ? 'on':''}" data-size="${s.id}">${esc(s.name)}<small>${esc(s.sub)}</small><small><b>${baht(s.price)}</b></small></button>`).join('') + '</div>');
      if(P.noTop) h += sec(++n, 'ท็อปปิ้ง', '<div class="empty" style="padding:6px 0">ขนาดนี้ไม่มีท็อปปิ้ง</div>');
      else h += sec(++n, 'ท็อปปิ้ง', greekTopsHtml(P), `<span class="cnt">ฟรี ${Math.min(P.freeUsed, CONFIG.freeToppingCount)}/${CONFIG.freeToppingCount}</span>`);
    } else {
      h += sec(++n, 'ท็อปปิ้งที่มากับเมนู', presetHtml(m));
    }
    h += sec(++n, 'น้ำผึ้ง <small>(ฟรี)</small>', '<div class="honey">' + CONFIG.honey.map(x =>
      `<button class="hon ${sel.honey === x.id ? 'on':''}" data-honey="${x.id}">${esc(x.name)}</button>`).join('') + '</div>');
    h += sec(++n, 'หมายเหตุ <small>(ถ้ามี)</small>', `<input class="note" id="note" placeholder="เช่น แพ้ถั่ว / ไม่เอาถ้วยใหญ่" value="${esc(sel.note)}">`);
  }
  $('builder').innerHTML = h;
  const add = $('btnAdd');
  add.disabled = !m;
  add.textContent = m ? `เพิ่มลงออเดอร์ · ${baht(P.unit)}` : 'เลือกเมนูก่อน';
}
$('builder').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('menu')) pickMenu(el.dataset.menu);
  else if(el = g('size')){ sel.size = el.dataset.size; if(MENU[sel.menu].sizes.find(s => s.id === sel.size).noTop) sel.picks = []; }
  else if(el = g('less')){ const i = sel.picks.lastIndexOf(el.dataset.less); if(i >= 0) sel.picks.splice(i, 1); }
  else if(el = g('pick')) sel.picks.push(el.dataset.pick);
  else if(el = g('choose')){ sel.comps[Number(el.dataset.slot)] = el.dataset.choose; sel.swapSlot = null; }
  else if(el = g('reset')){ const i = Number(el.dataset.reset); sel.comps[i] = MENU[sel.menu].defaults[i]; if(sel.swapSlot === i) sel.swapSlot = null; }
  else if(el = g('skip')){ const i = Number(el.dataset.skip); sel.comps[i] = null; if(sel.swapSlot === i) sel.swapSlot = null; }
  else if(el = g('swap')){ const i = Number(el.dataset.swap); sel.swapSlot = sel.swapSlot === i ? null : i; }
  else if(el = g('honey')) sel.honey = el.dataset.honey;
  else return;
  renderBuilder();
};
$('builder').addEventListener('input', e => { if(e.target.id === 'note') sel.note = e.target.value; });

$('btnAdd').onclick = () => {
  const m = curMenu(); if(!m) return;
  const P = priceSel();
  const item = {menu:m.id, name:m.name, sizeName:P.sizeName, tops:P.tops, honey:sel.honey, note:sel.note.trim(), unit:P.unit, qty:1};
  item.key = JSON.stringify([item.menu, item.sizeName, item.tops.map(t => [t.name, t.n, t.removed ? 1 : 0, t.from]), item.honey, item.note]);
  const found = cart.find(i => i.key === item.key);
  if(found) found.qty++; else cart.push(item);
  resetSel(); renderBuilder(); renderCart(); toast('เพิ่มแล้ว ✓');
};
