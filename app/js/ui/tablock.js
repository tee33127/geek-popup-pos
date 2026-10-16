/* ---------- เปิดแอปซ้อนหลายหน้า (Tee 2026-10-16 · D03) ----------
   ขายได้ทีละหน้า: หน้าที่ถือ Web Lock (navigator.locks) ชื่อ geek-pos-<KEY> เท่านั้นที่ขายได้ (DEMO ใช้ KEY แยก จึงไม่ชนกับของจริง)
   หน้าที่สองขึ้นจอ "แอปเปิดอยู่อีกหน้าแล้ว" + ปุ่ม "ใช้หน้านี้แทน" → แย่ง lock (steal) หน้าเก่าหยุดขายทันทีและขึ้นจอเดียวกัน
   แล้วหน้านี้โหลดใหม่ ให้ได้บิลล่าสุดที่หน้าเก่าขายไป (ไม่งั้นเลขออเดอร์ซ้ำ)
   รีเฟรช / แอปค้างแล้วเปิดใหม่: lock ของหน้าเก่าคืนเองเมื่อหน้าเก่าปิด · ถ้ายังไม่คืนทันที รอได้ถึง TAB_WAIT ก่อนตัดสินว่ามีหน้าอื่นจริง
   ไม่มี navigator.locks หรือใช้ไม่ได้ (เบราว์เซอร์เก่า, jsdom) = ทำงานแบบเดิม */
const TAB_LOCK = 'geek-pos-' + KEY, TAB_WAIT = 2500;
let TAB_STATE = 'free';   // free = ไม่มี API ขายได้ · wait = กำลังขอ lock · own = ถือ lock ขายได้ · other = หน้าอื่นขายอยู่
const tabCanSell = () => TAB_STATE === 'free' || TAB_STATE === 'own';

/* ขอ lock แล้วถือไว้จนหน้านี้ปิด · คืน true เมื่อได้ · ถูกแย่ง (AbortError) → หยุดขาย */
function holdTab(opts){
  return new Promise(done => {
    navigator.locks.request(TAB_LOCK, opts, lock => {
      if(!lock){ done(false); return; }
      TAB_STATE = 'own'; hideTabLock(); done(true);
      return new Promise(() => {});
    }).catch(() => {
      if(TAB_STATE === 'own'){ TAB_STATE = 'other'; showTabLock(); }   // หน้าอื่นกด "ใช้หน้านี้แทน"
      done(false);
    });
  });
}
async function startTabLock(){
  if(!(navigator.locks && typeof navigator.locks.request === 'function')) return;
  TAB_STATE = 'wait';
  try{
    if(await holdTab({ifAvailable:true})) return;
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), TAB_WAIT);
    const ok = await holdTab({signal:ac.signal}); clearTimeout(t);
    if(!ok && TAB_STATE === 'wait'){ TAB_STATE = 'other'; showTabLock(); }
  }catch(e){ console.warn('tab lock', e); TAB_STATE = 'free'; hideTabLock(); }
}
function takeTab(){
  const b = $('tabTake'); if(b) b.disabled = true;
  navigator.locks.request(TAB_LOCK, {steal:true}, () => { location.reload(); return new Promise(() => {}); })
    .catch(e => { console.warn('tab steal', e); if(b) b.disabled = false; });
}
function showTabLock(){
  let el = $('tabLock');
  if(!el){ el = document.createElement('div'); el.id = 'tabLock'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
  el.innerHTML = `<div class="lgbox"><div class="lgtitle">${icon('alert', 26)} แอปเปิดอยู่อีกหน้าแล้ว</div>
    <p class="lgsub">ขายได้ทีละหน้า เพื่อไม่ให้เลขออเดอร์ซ้ำ · ถ้าอีกหน้าปิดไปแล้วหรือค้าง กดปุ่มด้านล่าง หน้านั้นจะหยุดขาย</p>
    <button class="pay" id="tabTake">ใช้หน้านี้แทน</button></div>`;
  el.classList.add('show');
  $('tabTake').onclick = takeTab;
}
function hideTabLock(){ const el = $('tabLock'); if(el) el.classList.remove('show'); }
startTabLock();
