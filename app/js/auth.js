/* ผู้ใช้และสิทธิ์ (ไม่แตะ DOM) · รายชื่อเก็บใน SETTINGS.users เฉพาะเครื่อง ไม่อยู่ในโค้ด เพราะ repo เป็น public
   รหัส 4 หลักเก็บเป็น sha256(salt:รหัส) ไม่เก็บตัวเลข · ใส่รหัสใครก็เข้าเป็นคนนั้น รหัสจึงห้ามซ้ำกัน
   ตำแหน่งมี 2 แบบ สิทธิ์กำหนดที่ CAN ในโค้ดเท่านั้น (Tee 2026-10-12) */
const CAN = {
  owner: {pastReports:true,  void:true,  promptpay:true,  users:true,  printMode:true,  drawer:true},
  staff: {pastReports:false, void:false, promptpay:false, users:false, printMode:false, drawer:false},   // drawer = ตั้งค่าลิ้นชัก (ปุ่มเปิดลิ้นชักบนแถบหัว ทุกคนกดได้)
};
const ROLE_NAME = {owner:'เจ้าของ', staff:'พนักงาน'};
const CODE_LEN = 4, RECOVERY_LEN = 8;

/* SHA-256 แบบ sync (crypto.subtle ใช้ไม่ได้เมื่อเปิดจาก file://) */
const sha256 = (() => {
  const K = [], H0 = [];
  for(let n = 2, i = 0; i < 64; n++){
    let prime = true; for(let d = 2; d * d <= n; d++) if(n % d === 0){ prime = false; break; }
    if(!prime) continue;
    if(i < 8) H0[i] = (Math.pow(n, 1 / 2) * 4294967296) | 0;
    K[i++] = (Math.pow(n, 1 / 3) * 4294967296) | 0;
  }
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  return str => {
    const s = unescape(encodeURIComponent(str)), bytes = [];
    for(let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    const bitLen = bytes.length * 8;
    bytes.push(0x80); while(bytes.length % 64 !== 56) bytes.push(0);
    for(let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    const H = H0.slice(), W = new Array(64);
    for(let o = 0; o < bytes.length; o += 64){
      for(let t = 0; t < 16; t++) W[t] = (bytes[o + t * 4] << 24) | (bytes[o + t * 4 + 1] << 16) | (bytes[o + t * 4 + 2] << 8) | bytes[o + t * 4 + 3];
      for(let t = 16; t < 64; t++){
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for(let t = 0; t < 64; t++){
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();

const randHex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
const hashCode = (salt, code) => sha256(salt + ':' + code);
const codeOk = c => new RegExp(`^\\d{${CODE_LEN}}$`).test(c);
const users = () => SETTINGS.users || [];
const owners = () => users().filter(u => u.role === 'owner');
const userByCode = code => users().find(u => u.hash === hashCode(u.salt, code)) || null;
const codeTaken = (code, exceptId) => users().some(u => u.id !== exceptId && u.hash === hashCode(u.salt, code));

/* สร้าง/แก้ผู้ใช้ · code ว่าง = ไม่เปลี่ยนรหัส · คืนข้อความปัญหา หรือ '' ถ้าบันทึกได้ */
function saveUser(u, code){
  const list = users().map(x => ({...x})), name = (u.name || '').trim();
  if(!name) return 'ใส่ชื่อก่อน';
  if(name.length > 20) return 'ชื่อยาวเกิน 20 ตัวอักษร';
  if(list.some(x => x.id !== u.id && x.name === name)) return 'มีชื่อนี้แล้ว';
  if(!u.id && !code) return 'ตั้งรหัสก่อน';
  if(code && !codeOk(code)) return `รหัสต้องเป็นตัวเลข ${CODE_LEN} หลัก`;
  if(code && codeTaken(code, u.id)) return 'รหัสนี้มีคนใช้แล้ว';
  let x = list.find(y => y.id === u.id);
  if(x && x.role === 'owner' && u.role !== 'owner' && list.filter(y => y.role === 'owner').length === 1) return 'ต้องมีเจ้าของอย่างน้อย 1 คน';
  if(!x){ x = {id: 'u' + Date.now().toString(36) + randHex(2)}; list.push(x); }
  x.name = name; x.role = u.role === 'owner' ? 'owner' : 'staff';
  if(code){ x.salt = randHex(8); x.hash = hashCode(x.salt, code); }
  return saveSettings({...SETTINGS, users:list}) ? '' : 'บันทึกไม่สำเร็จ';
}
function deleteUser(id){
  const u = users().find(x => x.id === id); if(!u) return 'ไม่พบผู้ใช้';
  if(USER && USER.id === id) return 'ลบตัวเองไม่ได้';
  if(u.role === 'owner' && owners().length === 1) return 'ต้องมีเจ้าของอย่างน้อย 1 คน';
  return saveSettings({...SETTINGS, users:users().filter(x => x.id !== id)}) ? '' : 'บันทึกไม่สำเร็จ';
}

/* รหัสกู้คืน 8 หลัก: ใช้ตั้งรหัสเจ้าของใหม่เมื่อลืม · แสดงครั้งเดียวตอนสร้าง เก็บแค่ hash */
function newRecovery(){
  let c = ''; const a = new Uint8Array(RECOVERY_LEN); crypto.getRandomValues(a); a.forEach(x => { c += x % 10; });
  const salt = randHex(8);
  return setRecoveryHash({salt, hash:hashCode(salt, c)}) ? c : null;
}
const recoveryOk = c => { const r = recoveryHash(); return !!r && r.hash === hashCode(r.salt, c); };
const fmtRecovery = c => c.replace(/(\d{4})(?=\d)/g, '$1 ');

/* ---------- ผู้ใช้ที่เข้าระบบอยู่ ----------
   คนเดียวทั้งวัน: เข้าแล้วอยู่จนกดออก หรือขึ้นรอบขายใหม่ (23:00) ต้องเข้าใหม่ · รีเฟรชหน้าไม่หลุด */
const SESSION_KEY = SETTINGS_KEY + '_session', STAFFLOG_KEY = SETTINGS_KEY + '_staff_log';
let USER = null, SESSION = null;   // SESSION สำรองในหน่วยความจำ (เบราว์เซอร์บล็อกที่เก็บข้อมูล)
const can = p => !!USER && !!(CAN[USER.role] || {})[p];
function loadSession(){
  let s = SESSION; try{ s = JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){}
  const u = s && s.date === bizDate(new Date()) && (users().find(x => x.id === s.id) || (USER && USER.id === s.id && USER));
  USER = u || null;
  return USER;
}
/* เสีย → เก็บของเดิมแยก (keepCorrupt) เริ่มรายการใหม่ + แถบแดง */
function staffLog(){
  const r = readStored(STAFFLOG_KEY, []);
  if(r.corrupt) dataBanner('staffLogBanner', 'ข้อมูลเข้า/ออกระบบในเครื่องเสีย เก็บของเดิมไว้แล้ว เริ่มบันทึกใหม่ · ยอดขายไม่กระทบ · แจ้งผู้ดูแล (Tee)');
  return r.value;
}
function addStaffLog(act, u){
  const now = new Date(), log = staffLog();
  if(CORRUPT_LOCK.has(STAFFLOG_KEY)) return;   // ของเสียยังคัดลอกไม่ได้ ห้ามทับ
  log.push({at:now.toISOString(), date:bizDate(now), id:u.id, name:u.name, role:u.role, act});
  try{ localStorage.setItem(STAFFLOG_KEY, JSON.stringify(log.slice(-3000))); }catch(e){ console.warn('staff log', e); }
}
function signIn(u){
  USER = u; SESSION = {id:u.id, date:bizDate(new Date())};
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); }catch(e){}
  addStaffLog('in', u);
}
function signOut(){
  if(USER) addStaffLog('out', USER);
  USER = null; SESSION = null; try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
}
