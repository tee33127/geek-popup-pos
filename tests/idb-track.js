// IndexedDB จำลอง (fake-indexeddb): นับ transaction ที่ยังไม่จบ ให้เทสต์รอ "เขียนเสร็จจริง" (complete / abort / error) แทนการรอเวลา
// (Tee 2026-10-18 · เทสต์ต้องผลนิ่ง) · ใช้ได้กับทุก IDBFactory ของ fake-indexeddb ในโปรเซสนี้
const {IDBDatabase} = require('fake-indexeddb');
const {flush} = require('./vclock');
const PENDING = new Set();
const tx0 = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function(...a){
  const tx = tx0.apply(this, a);
  const p = new Promise(r => ['complete', 'abort', 'error'].forEach(e => tx.addEventListener(e, r)));
  PENDING.add(p); p.then(() => PENDING.delete(p));
  return tx;
};
/* รอจนไม่มี transaction ค้าง (รวมที่เกิดต่อจากอันก่อน) */
async function idbIdle(){ await flush(); while(PENDING.size){ await Promise.all([...PENDING]); await flush(); } }
module.exports = {idbIdle};
