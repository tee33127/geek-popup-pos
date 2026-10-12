// รันชุดทดสอบทั้งหมด: npm test (build prototype/pos.html จาก app/ ก่อนทุกครั้ง)
const { execFileSync } = require('child_process');
const path = require('path');
const runs = [
  // app/ แบบแยกไฟล์
  ['app/pricing.test.js'],
  ['app/app-files.test.js'],
  ['app/store.test.js'],
  ['app/pwa.test.js'],
  ['app/printer.test.js'],
  ['app/printer-usb.test.js'],
  ['app/promptpay.test.js'],
  ['app/promptpay-ui.test.js'],
  ['app/promo.test.js'],
  ['app/printer-test-page.test.js'],
  // ต้นแบบไฟล์เดียวที่ build แล้ว
  ['prototype/toppings-and-cart.test.js'],
  ['prototype/reports.test.js'],
  ['prototype/void-restore-csv.test.js'],
  ['prototype/promo-ui.test.js'],
  ['prototype/settings.test.js'],
  // รอบขายเปลี่ยนวันเวลา 23:00 — ทดสอบด้วยเวลาจำลองหลายช่วง
  ['prototype/demo-business-round.test.js', '2026,10,5,23,58'],
  ['prototype/demo-business-round.test.js', '2026,10,6,9,0'],
  ['prototype/demo-business-round.test.js', '2026,10,6,14,30'],
  ['prototype/demo-business-round.test.js', '2026,10,6,14,30', 'block'],
];
let failed = 0;
for (const [file, ...args] of runs) {
  const label = [file, ...args].join(' ');
  try {
    const out = execFileSync('node', [path.join(__dirname, file), ...args], { encoding: 'utf8' });
    const bad = /FAIL|CRASH|TEST CRASH/.test(out);
    console.log(`${bad ? '✗' : '✓'} ${label}`);
    if (bad) { failed++; console.log(out); }
  } catch (e) { failed++; console.log(`✗ ${label}\n${e.stdout || e.message}`); }
}
console.log(failed ? `\n${failed} run(s) failed` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
