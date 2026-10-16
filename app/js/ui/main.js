/* ---------- เลขออเดอร์ที่กำลังคีย์ + ตัวจัดการคลิกใน modal + เริ่มต้นหน้าจอ (ไฟล์สุดท้าย) ---------- */
function updateNext(){ $('nextNo').innerHTML = 'ออเดอร์ <b>#' + pad(nextNo(), 3) + '</b>'; }

/* ---------- Modal click handler (ชำระเงิน / สรุปยอด / พิมพ์) ---------- */
$('modal').onclick = e => {
  const g = a => e.target.closest(`[data-${a}]`); let el;
  if(el = g('dine')){ pay.dining = el.dataset.dine; renderPay(); return; }
  if(el = g('method')){ if(!pay.dining) return; pay.method = el.dataset.method; if(pay.method !== 'cash') pay.received = 0; renderPay(); return; }
  if(el = g('q')){ pay.received = Number(el.dataset.q); renderPay(); return; }
  if(el = g('fq')){ $('floatIn').value = el.dataset.fq; floatInput(); return; }
  if(el = g('pid')){ promoPick(el.dataset.pid); return; }
  if(el = g('ptarget')){ promoTarget(Number(el.dataset.ptarget)); return; }
  if(el = g('v') || g('restore')){
    const isVoid = !!el.dataset.v, sid = isVoid ? el.dataset.v : el.dataset.restore;
    const sv = loadSales().find(x => String(x.id) === sid); if(!sv) return;
    /* เจ้าของเท่านั้น · พนักงานเข้าอยู่ → ให้เจ้าของใส่รหัสตรงนั้น · บันทึกชื่อคนยกเลิกใน log */
    const run = owner => {
      askConfirm(isVoid
        ? {msg:`ยกเลิกบิล #${pad(sv.no, 3)}?`, sub:'ระบบจะเก็บประวัติไว้ และนำกลับมาได้ภายหลัง', yes:'ยกเลิกบิล'}
        : {msg:`นำบิล #${pad(sv.no, 3)} กลับมา?`, sub:`ยอด ${baht(sv.total)} จะถูกนับในยอดขายอีกครั้ง`, yes:'นำกลับ', ok:true});
      confirmCb = () => {
        const all = loadSales(), x = all.find(y => String(y.id) === sid);
        if(x){ const at = new Date().toISOString(); x.void = isVoid; (x.log = x.log || []).push({act: isVoid ? 'void' : 'restore', at, by:owner.name}); if(isVoid) x.voidAt = at; else delete x.voidAt; saveSales(all); toast(isVoid ? 'ยกเลิกบิลแล้ว' : 'นำบิลกลับแล้ว', isVoid ? null : 'check'); }
        renderSummary();
      };
      confirmNo = renderSummary;
    };
    if(can('void')) run(USER);
    else askOwner(run, `${isVoid ? 'ยกเลิก' : 'นำกลับ'}บิล #${pad(sv.no, 3)} ต้องใช้รหัสเจ้าของ`);
    return;
  }
  if(el = g('prr')){ const s = loadSales().find(x => String(x.id) === el.dataset.prr); if(s) printSale(s, 'receipt'); return; }
  if(el = g('prk')){ const s = loadSales().find(x => String(x.id) === el.dataset.prk); if(s) printSale(s, 'kitchen'); return; }
  if(el = g('tab')){ REP.tab = el.dataset.tab; renderSummary(); return; }
  if(el = g('range')){ setRange(el.dataset.range); renderSummary(); return; }
  const b = e.target.closest('button'); const id = b && b.id;
  if(id === 'payCancel') closeModal();
  else if(id === 'closeX') modalClose();   // ปุ่ม X บนหัวหน้าต่าง (หรือปุ่ม "ปิด" ในหน้าต่างที่ไม่มีหัว)
  else if(id === 'nextOrder'){ closeModal(); backToMenu(); }
  else if(id === 'pendBack'){ closeModal(); closeCart(); const miss = missingStep(); if(miss) flashStep(miss); }   // แก้วค้าง: กลับไปทำต่อ ตัวเลือกยังอยู่
  else if(id === 'pendDrop'){ closeModal(); backToMenu(); openPay(); }
  else if(id === 'pinNo'){ pinCb = null; renderSummary(); }   // ใช้จากแท็บบิลเท่านั้น
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
  else if(id === 'csvBack'){ const b = csvPending && csvPending.back; csvPending = null; if(typeof b === 'function') b(); else if(b) renderSummary(); else closeModal(); }
  else if(id === 'csvAll') exportCsv();
  else if(id === 'payOk') confirmPay();
  else if(id === 'prBoth' && lastSale) reprint(lastSale, true);   // เฉพาะใบที่ยังไม่ออก หรือให้เลือก
  else if(id === 'prTest') printTest();
  else if(id === 'ppOpen') openPromptPay();
  else if(id === 'setSave') settingsSave();
  else if(id === 'setBack') openSettings();
  else if(id === 'floatOk') floatSave();
  else if(id === 'floatSkip') closeModal();
  else if(id === 'closeDay') openClose();
  else if(id === 'clBack'){ closeDraft = null; renderSummary(); }
  else if(id === 'clSave') closeSave();
  else if(id === 'clLogout') $('btnUser').onclick();
  else if(id === 'bkNow') openBackup(null);
  else if(id === 'bkSet') openBackup(openSettings);
  else if(id === 'rsOpen') openRestore(false);
  else if(id === 'rsApply') restoreApply();
  else if(id === 'rsCancel'){ RS = null; openSettings(); }
  else if(id === 'usrAdd') openUserForm(null);
  else if(id === 'usrSave') userFormSave();
  else if(id === 'usrCancel') openSettings();
  else if(id === 'rcNew') recoveryNew();
  else if(id === 'prOff') disconnectPrinter();
};

/* ---------- Init ---------- */
$('pageStyle').textContent = '@page{size:' + CONFIG.paperMm + 'mm auto;margin:0}';
document.documentElement.style.setProperty('--paper', CONFIG.paperMm + 'mm');
$('btnSummary').innerHTML = icon('chart', 18) + ' สรุปยอด';
$('btnSettings').innerHTML = icon('settings', 18) + ' ตั้งค่า';
renderBuilder(); renderCart();
storeReady.then(updateNext);   // เลขออเดอร์ต้องรอโหลดบิลจาก IndexedDB ก่อน
/* PWA: ใช้งานออฟไลน์ได้ (ต้องเปิดผ่าน https หรือ localhost · ต้นแบบไฟล์เดียวไม่มี manifest จึงข้าม) */
if('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker', e));
