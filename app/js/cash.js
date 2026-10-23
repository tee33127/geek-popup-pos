/* เงินในลิ้นชัก (ไม่แตะ DOM): เงินทอนตั้งต้นตอนเปิดร้าน + นับเงินตอนปิดร้าน · เก็บต่อท้ายอย่างเดียว ไม่แก้ของเดิม
   รายการ = {type:'open', date, at, by, float} หรือ {type:'close', date, at, by, float, cashSales, cashBills, expected, counted, diff, note}
   หรือ {type:'drawer', date, at, by, reason, ok, why} แอปสั่งเปิดลิ้นชัก (drawer.js · ไม่มี float จึงไม่กระทบเงินทอนตั้งต้น)
   ใช้ค่าล่าสุดของแต่ละรอบขาย (นับซ้ำได้ เช่นขายต่อหลังนับ) */
const CASH_KEY = SETTINGS_KEY + '_cash';
let CASH_MEM = [];   // เบราว์เซอร์บล็อกที่เก็บข้อมูล
/* เสีย → เก็บของเดิมแยก (keepCorrupt) เริ่มรายการใหม่ + แถบแดง */
function cashLog(){
  const r = readStored(CASH_KEY, []);
  if(r.blocked) return CASH_MEM;
  if(r.corrupt) dataBanner('cashBanner', 'ข้อมูลเงินสด (เงินทอน/นับเงิน) ในเครื่องเสีย เก็บของเดิมไว้แล้ว เริ่มบันทึกใหม่ · ยอดขายไม่กระทบ · แจ้งผู้ดูแล (Tee)');
  return r.value;
}
function saveCashLog(list){
  if(CORRUPT_LOCK.has(CASH_KEY)) return false;   // ของเสียยังคัดลอกไม่ได้ ห้ามทับ
  CASH_MEM = list;
  try{ localStorage.setItem(CASH_KEY, JSON.stringify(list)); return true; }
  catch(e){ try{ localStorage.getItem(CASH_KEY); return false; }catch(_){ return true; } }
}
function addCash(entry){
  const now = new Date();
  return saveCashLog(cashLog().concat({...entry, at:now.toISOString(), date: entry.date || bizDate(now), by: USER ? USER.name : ''}));
}
const lastCash = (date, type) => cashLog().filter(c => c.date === date && c.type === type).pop() || null;
/* เงินทอนตั้งต้นของรอบ: ใช้ที่ตั้งตอนเปิดร้าน หรือที่แก้ตอนนับเงิน (อันหลังสุด) */
const dayFloat = date => { const c = cashLog().filter(x => x.date === date && x.float !== undefined).pop(); return c ? c.float : null; };
/* เงินสดจากการขายของรอบ (ไม่นับบิลที่ยกเลิก) */
function cashSales(date){
  const bills = loadSales().filter(s => s.date === date && !s.void && s.method === 'cash');
  return {total: bills.reduce((a, s) => a + s.total, 0), bills: bills.length};
}
/* สรุปการนับเงิน: ต่าง > 0 = เกิน · < 0 = ขาด */
function cashCount(date, float, counted){
  const cs = cashSales(date), expected = (float || 0) + cs.total;
  return {cashSales:cs.total, cashBills:cs.bills, expected, counted, diff: counted - expected};
}
const diffText = d => d === 0 ? 'เงินตรง' : d > 0 ? `เกิน ${baht(d)}` : `ขาด ${baht(-d)}`;
