/* สำรอง / นำข้อมูลกลับ (ไม่แตะ DOM) · ไฟล์ JSON เดียว: บิล + ตั้งค่า (พนักงาน รหัสแบบ hash PromptPay ของหมด) + เข้า/ออกระบบ + นับเงิน
   นำกลับ = รวมกับของเดิม ไม่ลบอะไร · บิลเดียวกัน (id ตรง) ใช้ฉบับที่ log ยาวกว่า (newerSale ใน store.js) */
const BACKUP_APP = 'geek-popup-pos', BACKUP_VER = 1;
const SETTINGS_FROM_FILE = ['users', 'recovery', 'promptpay', 'out'];

function backupData(){
  return {app:BACKUP_APP, ver:BACKUP_VER, at:new Date().toISOString(), by: USER ? USER.name : '',
    sales:loadSales(), settings:{...SETTINGS, ...(recoveryHash() && {recovery:recoveryHash()})}, staffLog:staffLog(), cash:cashLog()};   // recovery อยู่ใน settings ของไฟล์ (รูปแบบเดิม)
}
const backupName = () => { const d = new Date(); return `geek-popup-backup-${dateKey(d)}-${pad(d.getHours())}${pad(d.getMinutes())}.json`; };
function markBackup(){ saveSettings({...SETTINGS, lastBackup:new Date().toISOString()}); }

/* อ่านไฟล์ → {ok:false, why} หรือ {ok:true, data, info} (ยังไม่เปลี่ยนอะไรในเครื่อง) */
function parseBackup(text){
  let d; try{ d = JSON.parse(text); }catch(e){ return {ok:false, why:'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป (อ่านไม่ได้)'}; }
  if(!d || d.app !== BACKUP_APP || !Array.isArray(d.sales)) return {ok:false, why:'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป'};
  if(d.ver > BACKUP_VER) return {ok:false, why:'ไฟล์มาจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน'};
  /* ช่องที่หน้าสรุป/พิมพ์ต้องใช้ · ขาดแล้วรับเข้าเครื่อง หน้าสรุปของรอบนั้นจะเปิดไม่ได้ */
  const itemOk = i => i && typeof i.menu === 'string' && Array.isArray(i.tops) && typeof i.unit === 'number' && typeof i.qty === 'number';
  const bad = d.sales.find(s => !s || typeof s.id !== 'number' || typeof s.date !== 'string' || !s.date || !Array.isArray(s.items) || !s.items.every(itemOk)
    || typeof s.total !== 'number' || typeof s.dining !== 'string' || typeof s.method !== 'string' || typeof s.ts !== 'string');
  if(bad) return {ok:false, why:'ข้อมูลบิลในไฟล์ไม่ครบ'};
  const have = new Set(loadSales().map(s => s.id)), dates = d.sales.map(s => s.date).sort();
  const st = d.settings || {};
  return {ok:true, data:d, info:{at:d.at, by:d.by || '', bills:d.sales.length, newBills:d.sales.filter(s => !have.has(s.id)).length,
    from:dates[0] || null, to:dates[dates.length - 1] || null, users:(st.users || []).length, promptpay:!!st.promptpay}};
}
/* รวมเข้าเครื่อง · withSettings = ใช้พนักงาน/รหัส/PromptPay/ของหมดจากไฟล์แทนของเครื่อง */
function applyBackup(d, withSettings){
  const cur = new Map(loadSales().map(s => [s.id, s]));
  let added = 0, updated = 0;
  const list = d.sales.slice().sort((a, b) => a.id - b.id).map(s => {
    if(!cur.has(s.id)){ added++; return s; }
    const n = newerSale(cur.get(s.id), s); if(n !== cur.get(s.id)) updated++; return n;
  });
  saveSales(list);
  /* เข้า/ออกระบบ และนับเงิน: รวมแบบไม่ซ้ำ (เวลา + ชื่อ + ชนิด) */
  const merge = (a, b, k) => { const seen = new Set(a.map(k)); return a.concat((b || []).filter(x => !seen.has(k(x)))).sort((x, y) => x.at.localeCompare(y.at)); };
  if(!CORRUPT_LOCK.has(STAFFLOG_KEY)) try{ localStorage.setItem(STAFFLOG_KEY, JSON.stringify(merge(staffLog(), d.staffLog, x => x.at + x.name + x.act))); }catch(e){}
  saveCashLog(merge(cashLog(), d.cash, x => x.at + x.type + x.by));
  if(withSettings && d.settings){
    const next = {...SETTINGS};
    SETTINGS_FROM_FILE.forEach(k => { if(k === 'recovery') return; if(d.settings[k] !== undefined) next[k] = d.settings[k]; else delete next[k]; });
    setRecoveryHash(d.settings.recovery || null);   // รหัสกู้คืนเก็บแยก key
    saveSettings(next); applyOut();
  }
  return {added, updated};
}
