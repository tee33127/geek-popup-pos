/* ฟังก์ชันพื้นฐาน: จัดรูปแบบ วันที่ รอบขาย ป้ายข้อความ (ไม่แตะ DOM) */
const baht = n => '฿' + Number(n).toLocaleString('th-TH');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = (n, l=2) => String(n).padStart(l, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDT = ts => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
const ITEM = Object.fromEntries(CONFIG.items.map(x => [x.name, x]));
/* ชื่อท็อปปิ้งที่แสดง (ภาษาไทย) จากรหัสอังกฤษที่เก็บในบิล · ไม่รู้จักก็แสดงตามที่เก็บ */
const topName = n => (ITEM[n] && ITEM[n].th) || n;
const MENU = byId(CONFIG.menus), METHOD = byId(CONFIG.methods), HONEY = byId(CONFIG.honey), DINE = byId(CONFIG.dining);

/* รอบขายเปลี่ยนวันตอน 23:00 น. */
function bizDate(d){ const x = new Date(d); if(x.getHours() >= CONFIG.resetHour) x.setDate(x.getDate()+1); return dateKey(x); }

const addDays = (k, n) => { const [y, m, d] = k.split('-').map(Number); return dateKey(new Date(y, m - 1, d + n)); };

const itemTitle = i => i.name + (i.sizeName ? ' · ' + i.sizeName : '');
const topLabel = t => t.removed ? 'ไม่รับ ' + topName(t.name) : topName(t.name) + (t.n > 1 ? ' ×' + t.n : '') + (t.from ? ` (แทน ${topName(t.from)})` : '') + (t.extra ? ` (+${t.extra})` : '');
function itemLines(i){
  const L = [];
  if(i.tops.length) L.push(i.tops.map(topLabel).join(', '));
  else if(i.menu === 'greek') L.push('ไม่มีท็อปปิ้ง');
  L.push('น้ำผึ้ง: ' + HONEY[i.honey].name);
  if(i.note) L.push('หมายเหตุ: ' + i.note);
  return L;
}

function historyText(s){ return (s.log || []).map(l => `${l.act === 'void' ? 'ยกเลิก' : 'นำกลับ'} ${fmtDT(l.at)}`).join(' / '); }

function csvText(rows){ const q = v => `"${String(v).replace(/"/g, '""')}"`; return rows.map(r => r.map(q).join(',')).join('\r\n'); }
