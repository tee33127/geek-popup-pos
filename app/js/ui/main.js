/* ---------- เลขออเดอร์ถัดไป + ตัวจัดการคลิกใน modal + เริ่มต้นหน้าจอ (ไฟล์สุดท้าย) ---------- */
function updateNext(){ $('nextNo').textContent = 'ออเดอร์ถัดไป #' + pad(nextNo(), 3); }

/* ---------- Modal click handler (ชำระเงิน / สรุปยอด / พิมพ์) ---------- */
$('modal').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('dine')){ pay.dining = el.dataset.dine; renderPay(); return; }
  if(el = g('method')){ pay.method = el.dataset.method; if(pay.method !== 'cash') pay.received = 0; renderPay(); return; }
  if(el = g('q')){ pay.received = Number(el.dataset.q); renderPay(); return; }
  if(el = g('v') || g('restore')){
    const isVoid = !!el.dataset.v, sid = isVoid ? el.dataset.v : el.dataset.restore;
    const sv = loadSales().find(x => String(x.id) === sid); if(!sv) return;
    askConfirm(isVoid
      ? {msg:`ยกเลิกบิล #${pad(sv.no, 3)}?`, sub:'ระบบจะเก็บประวัติไว้ และนำกลับมาได้ภายหลัง', yes:'ยกเลิกบิล'}
      : {msg:`นำบิล #${pad(sv.no, 3)} กลับมา?`, sub:`ยอด ${baht(sv.total)} จะถูกนับในยอดขายอีกครั้ง`, yes:'นำกลับ', ok:true});
    confirmCb = () => {
      const all = loadSales(), x = all.find(y => String(y.id) === sid);
      if(x){ const at = new Date().toISOString(); x.void = isVoid; (x.log = x.log || []).push({act: isVoid ? 'void' : 'restore', at}); if(isVoid) x.voidAt = at; else delete x.voidAt; saveSales(all); toast(isVoid ? 'ยกเลิกบิลแล้ว' : 'นำบิลกลับแล้ว ✓'); }
      renderSummary();
    };
    confirmNo = renderSummary;
    return;
  }
  if(el = g('prr')){ const s = loadSales().find(x => String(x.id) === el.dataset.prr); if(s) printSale(s, 'receipt'); return; }
  if(el = g('prk')){ const s = loadSales().find(x => String(x.id) === el.dataset.prk); if(s) printSale(s, 'kitchen'); return; }
  if(el = g('tab')){ REP.tab = el.dataset.tab; renderSummary(); return; }
  if(el = g('range')){ setRange(el.dataset.range); renderSummary(); return; }
  const b = e.target.closest('button'); const id = b && b.id;
  if(id === 'payCancel' || id === 'closeX' || id === 'nextOrder' || id === 'pinNo') closeModal();
  else if(id === 'cfYes'){ const cb = confirmCb; confirmCb = confirmNo = null; closeModal(); if(cb) cb(); }
  else if(id === 'cfNo'){ const cb = confirmNo; confirmCb = confirmNo = null; closeModal(); if(cb) cb(); }
  else if(id === 'pinOk') checkPin();
  else if(id === 'csvTab'){ if(repCsv) downloadCsv(repCsv.name, repCsv.rows, true); }
  else if(id === 'csvDl') csvDownload();
  else if(id === 'csvShare') csvShare();
  else if(id === 'csvCopy') csvCopy();
  else if(id === 'csvBack'){ const b = csvPending && csvPending.back; csvPending = null; if(b) renderSummary(); else closeModal(); }
  else if(id === 'csvAll') exportCsv();
  else if(id === 'payOk') confirmPay();
  else if(id === 'prRec' && lastSale) printSale(lastSale, 'receipt');
  else if(id === 'prKit' && lastSale) printSale(lastSale, 'kitchen');
  else if(id === 'prBoth' && lastSale) printSale(lastSale, 'both');
};

/* ---------- Init ---------- */
$('pageStyle').textContent = '@page{size:' + CONFIG.paperMm + 'mm auto;margin:0}';
document.documentElement.style.setProperty('--paper', CONFIG.paperMm + 'mm');
renderBuilder(); renderCart();
storeReady.then(updateNext);   // เลขออเดอร์ต้องรอโหลดบิลจาก IndexedDB ก่อน
