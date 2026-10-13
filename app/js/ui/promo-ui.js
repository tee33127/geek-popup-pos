/* ---------- โปรโมชัน: ปุ่มในกล่องออเดอร์ + หน้าต่างเลือกโปร (1 บิล 1 โปร) ---------- */
function renderPromoBox(){
  const box = $('promoBox');
  if(!cart.length || !CONFIG.promos.length){ box.innerHTML = ''; return; }
  let r = promoNow();
  if(promo && (!r || !r.ok)){   // ตะกร้าเปลี่ยนจนไม่เข้าเงื่อนไข → ยกเลิกโปร และบอกพนักงาน
    const name = PROMO[promo.id] ? PROMO[promo.id].name : promo.id;
    toast(`ยกเลิกโปร ${name} · ${r ? r.why : 'ไม่มีโปรนี้แล้ว'}`, 'alert'); promo = null; r = null;
  }
  if(promo && r){ promo.key = r.target.key; promo.top = r.target.top || null; }   // เป้าหมายเดิมหายไป → ใช้รายการแรก
  /* ยังไม่เข้าเงื่อนไขโปรไหนเลย → ปุ่มเทา กดไม่ได้ (Tee 2026-10-13) · เข้าเงื่อนไขเมื่อไรกลับมาปกติเอง เพราะวาดใหม่ทุกครั้งที่ตะกร้าเปลี่ยน */
  const any = !!promo || CONFIG.promos.some(p => promoEval(p, cart, null).ok);
  box.innerHTML = promo
    ? `<button class="promo on" id="promoOpen">${icon('tag', 20)}<span><b>${esc(PROMO[promo.id].name)}</b><small>${esc(r.detail)}</small></span><b class="px">-${baht(r.discount)}</b></button>`
    : `<button class="promo" id="promoOpen" ${any ? '' : 'disabled'}>${icon('tag', 20)}<span><b>ใช้โปรโมชัน</b><small>${any ? '1 บิลใช้ได้ 1 โปร' : 'ยังไม่มีโปรที่ใช้ได้'}</small></span></button>`;
}
let promoDraft = null;
function openPromo(){ promoDraft = promo ? {...promo} : null; renderPromo(); }
function renderPromo(){
  const d = promoDraft, rd = d ? promoEval(PROMO[d.id], cart, d) : null;
  let h = `<p class="note2" style="margin:0 0 10px">1 บิลใช้ได้ 1 โปร · ค่าที่บวกเพิ่ม (เปลี่ยน/เพิ่มท็อปปิ้ง, แยกท็อปปิ้ง) คิดตามปกติ</p><div class="popts">`;
  CONFIG.promos.forEach(p => {
    const r = promoEval(p, cart, d && d.id === p.id ? d : null);
    h += `<button class="popt ${d && d.id === p.id ? 'on' : ''}" data-pid="${p.id}" ${r.ok ? '' : 'disabled'}><span><b>${esc(p.name)}</b><small>${esc(p.sub)}</small>${r.ok ? '' : `<small class="why">${icon('alert', 14)} ${esc(r.why)}</small>`}</span>${r.ok ? `<b class="px">-${baht(r.discount)}</b>` : ''}</button>`;
  });
  h += '</div>';
  if(rd && rd.ok && rd.targets.length > 1){
    h += `<div class="q2">ใช้กับ</div><div class="ptargets">` + rd.targets.map((t, i) =>
      `<button class="opt ${t.key === rd.target.key && (t.top || null) === (rd.target.top || null) ? 'on' : ''}" data-ptarget="${i}">${esc(t.label)}</button>`).join('') + '</div>';
  }
  const foot = `<div class="row payrow">${promo ? '<button class="ghost" id="promoNone">ไม่ใช้โปร</button>' : '<button class="ghost" id="promoCancel">กลับ</button>'}` +
    `<button class="pay" id="promoOk" ${rd && rd.ok ? '' : 'disabled'}>${rd && rd.ok ? `ใช้โปรนี้ · -${baht(rd.discount)}` : 'เลือกโปรก่อน'}</button></div>`;
  openModal(h, {title:`${icon('tag', 22)} โปรโมชัน`, key:'promo', foot, onClose: () => { promoDraft = null; closeModal(); }});
}
function promoPick(id){ promoDraft = {id, key:null, top:null}; renderPromo(); }
function promoTarget(i){
  const r = promoEval(PROMO[promoDraft.id], cart, promoDraft), t = r.targets[i]; if(!t) return;
  promoDraft.key = t.key; promoDraft.top = t.top || null; renderPromo();
}
function promoApply(){
  const r = promoDraft && promoEval(PROMO[promoDraft.id], cart, promoDraft); if(!r || !r.ok) return;
  promo = {id:promoDraft.id, key:r.target.key, top:r.target.top || null}; promoDraft = null;
  closeModal(); renderCart(); toast(`ใช้โปร ${PROMO[promo.id].name} แล้ว`, 'check');
}
function promoClear(){ promo = null; promoDraft = null; closeModal(); renderCart(); toast('ไม่ใช้โปรแล้ว'); }
$('promoBox').onclick = e => { if(e.target.closest('#promoOpen')) openPromo(); };
