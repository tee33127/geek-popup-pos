/* ---------- เลขออเดอร์ที่กำลังคีย์ + ตัวจัดการคลิกใน modal + เริ่มต้นหน้าจอ (ไฟล์สุดท้าย) ---------- */
function updateNext(){ $('nextNo').innerHTML = 'ออเดอร์ <b>#' + pad(nextNo(), 3) + '</b>'; }

/* ---------- Modal click handler (ชำระเงิน / สรุปยอด / พิมพ์) ---------- */
$('modal').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('dine')){ pay.dining = el.dataset.dine; renderPay(); return; }
  if(el = g('method')){ if(!pay.dining) return; pay.method = el.dataset.method; if(pay.method !== 'cash') pay.received = 0; renderPay(); return; }
  if(el = g('q')){ pay.received = Number(el.dataset.q); renderPay(); return; }
  if(el = g('pid')){ promoPick(el.dataset.pid); return; }
  if(el = g('ptarget')){ promoTarget(Number(el.dataset.ptarget)); return; }
  if(el = g('v') || g('restore')){
    const isVoid = !!el.dataset.v, sid = isVoid ? el.dataset.v : el.dataset.restore;
    const sv = loadSales().find(x => String(x.id) === sid); if(!sv) return;
    askConfirm(isVoid
      ? {msg:`ยกเลิกบิล #${pad(sv.no, 3)}?`, sub:'ระบบจะเก็บประวัติไว้ และนำกลับมาได้ภายหลัง', yes:'ยกเลิกบิล'}
      : {msg:`นำบิล #${pad(sv.no, 3)} กลับมา?`, sub:`ยอด ${baht(sv.total)} จะถูกนับในยอดขายอีกครั้ง`, yes:'นำกลับ', ok:true});
    confirmCb = () => {
      const all = loadSales(), x = all.find(y => String(y.id) === sid);
      if(x){ const at = new Date().toISOString(); x.void = isVoid; (x.log = x.log || []).push({act: isVoid ? 'void' : 'restore', at}); if(isVoid) x.voidAt = at; else delete x.voidAt; saveSales(all); toast(isVoid ? 'ยกเลิกบิลแล้ว' : 'นำบิลกลับแล้ว', isVoid ? null : 'check'); }
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
  else if(id === 'fewBack' || id === 'fewOk' || id === 'fewPlain') fewTopsAnswer(id);
  else if(id === 'cheapSwitch' || id === 'cheapKeep') cheaperAnswer(id);
  else if(id === 'promoOk') promoApply();
  else if(id === 'promoNone') promoClear();
  else if(id === 'promoCancel'){ promoDraft = null; closeModal(); }
  else if(id === 'csvTab'){ if(repCsv) downloadCsv(repCsv.name, repCsv.rows, true); }
  else if(id === 'csvDl') csvDownload();
  else if(id === 'csvShare') csvShare();
  else if(id === 'csvCopy') csvCopy();
  else if(id === 'csvBack'){ const b = csvPending && csvPending.back; csvPending = null; if(b) renderSummary(); else closeModal(); }
  else if(id === 'csvAll') exportCsv();
  else if(id === 'payOk') confirmPay();
  else if(id === 'prBoth' && lastSale) printSale(lastSale, 'both');
  else if(id === 'prTest') printTest();
  else if(id === 'setOpen') openSettings();
  else if(id === 'setSave') settingsSave();
  else if(id === 'setBack') renderSummary();
  else if(id === 'prOff') disconnectPrinter();
};

/* ---------- Init ---------- */
$('pageStyle').textContent = '@page{size:' + CONFIG.paperMm + 'mm auto;margin:0}';
document.documentElement.style.setProperty('--paper', CONFIG.paperMm + 'mm');
$('btnSummary').innerHTML = icon('chart', 18) + ' สรุปยอด';
renderBuilder(); renderCart();
storeReady.then(updateNext);   // เลขออเดอร์ต้องรอโหลดบิลจาก IndexedDB ก่อน
/* PWA: ใช้งานออฟไลน์ได้ (ต้องเปิดผ่าน https หรือ localhost · ต้นแบบไฟล์เดียวไม่มี manifest จึงข้าม) */
if('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker', e));
