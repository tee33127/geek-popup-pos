// บัญชีทดสอบสำหรับเทสต์หน้าจอ: เจ้าของ 1234 · พนักงาน "แพร" 1111 (hash แบบเดียวกับ app/js/auth.js)
const crypto = require('crypto');
const mk = (id, name, role, code) => { const salt = 'salt-' + id; return {id, name, role, salt, hash: crypto.createHash('sha256').update(salt + ':' + code).digest('hex')}; };
const USERS = [mk('u1', 'เจ้าของ', 'owner', '1234'), mk('u2', 'แพร', 'staff', '1111')];
/* ใส่ใน beforeParse: เพิ่มบัญชีทดสอบลง settings (เก็บค่าอื่นไว้) */
function seed(w, extra = {}, key = 'geek_popup_settings'){
  let cur = {}; try{ cur = JSON.parse(w.localStorage.getItem(key)) || {}; }catch(e){ return; }
  w.localStorage.setItem(key, JSON.stringify({...cur, users: USERS, ...extra}));
}
/* เข้าระบบโดยไม่ผ่านหน้าจอ (เทสต์หน้าเข้าใช้งานเองอยู่ใน login.test.js)
   localStorage ถูกบล็อก → ไม่มีบัญชี จึงใส่ผู้ใช้ลงหน่วยความจำตรงๆ */
function signIn(w, code = '1234'){
  w.eval(`(() => { const u = userByCode(${JSON.stringify(code)}) || {id:'t', name:'ทดสอบ', role:'owner'}; signIn(u); USER = u; hideLogin(); })()`);
}
module.exports = {USERS, seed, signIn};
