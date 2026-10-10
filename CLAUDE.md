# CLAUDE.md — Geek Pop-up POS

ไฟล์นี้คือคำแนะนำสำหรับ Claude Code อ่านก่อนเริ่มงานทุกครั้ง

## โปรเจกต์คืออะไร
POS เขียนเองสำหรับร้าน **Geek Yogurt & Smoothie Bar สาขา pop-up** (มี 3 เมนู: Greek Yogurt, Acai, Banana Choco) ใช้แทนการจดออเดอร์ด้วยมือ
- ผู้ใช้หลัก: **พนักงานใหม่** ต้องใช้ง่าย เรียนรู้ได้ในไม่กี่นาที
- อุปกรณ์: แท็บเล็ต **Android** (Redmi Pad 2 9.7") + ปริ้นเตอร์ความร้อน **Xprinter XP-Q807K (USB, 80 มม., ESC/POS)** ผ่านหัวแปลง OTG — รายละเอียดใน `docs/hardware.md`
- เจ้าของโปรเจกต์: Tee (พื้นหลัง UX/HCI) สื่อสารเป็น **ภาษาไทย** ตอบเป็นภาษาไทย ใช้ศัพท์เทคนิคภาษาอังกฤษได้
- ร้านหลักมี POS ของตัวเองอยู่แล้ว ระบบนี้ใช้เฉพาะ pop-up ไม่ต้องเชื่อมกับร้านหลัก

## สถานะตอนนี้
- **ขั้น 0 — เตรียมตัว** (ดู `docs/project-plan.md`) ฮาร์ดแวร์ยืนยันแล้ว รอซื้อ
- ซอร์สอยู่ใน `app/` แยกเป็นโมดูลแล้ว (ขั้น 0 ข้อ 1 เสร็จ) และ build เป็น `prototype/pos.html` ไฟล์เดียว ผ่านเทสต์ทั้งหมด: หน้าขาย, กติกาท็อปปิ้ง, ชำระเงิน, เลขออเดอร์, พิมพ์ผ่าน `window.print()`, สรุปยอด 5 แท็บ, ยกเลิก/นำกลับบิล, CSV
- ยังไม่มี: พิมพ์ตรงผ่าน USB (ESC/POS), เปิดลิ้นชัก, QR PromptPay, IndexedDB, PWA/offline, หน้าตั้งค่าเมนู

## งานถัดไป (ขั้น 0 → 1)
1. ~~แยกต้นแบบเป็นโมดูล~~ เสร็จแล้ว อยู่ใน `app/`
2. ~~ทำ `printer-test/`~~ เสร็จแล้ว ยังต้องโฮสต์ผ่าน https (เช่น GitHub Pages) ก่อนวันได้ของ เพราะ WebUSB ใช้ได้เฉพาะ https หรือ localhost
3. รอผลเช็กลิสต์ขั้น 1 แล้วตัดสินใจ PWA vs แอป Android (Capacitor)

## โครงสร้างโฟลเดอร์
```
CLAUDE.md                 ← ไฟล์นี้
README.md                 ← ภาพรวมสำหรับคน
docs/
  business-rules.md       ← แหล่งความจริงของเมนู ราคา กติกา (+ คำถามที่ยังเปิด)
  project-plan.md         ← แผน 6 ขั้น เช็กลิสต์ทดสอบฮาร์ดแวร์ ความเสี่ยง
  hardware.md             ← อุปกรณ์ที่ยืนยันแล้ว + คำสั่ง ESC/POS
  purchasing/*.pdf        ← shopping list และงบที่เสนอเจ้าของร้าน (อยู่ใน .gitignore ห้าม commit เพราะ repo เป็น public)
app/                      ← ซอร์สจริง (แก้ที่นี่) เปิด app/index.html ได้เลย
  index.html              ← markup + ลำดับ <script> (ลำดับสำคัญ ดูด้านล่าง)
  css/pos.css
  img/*.jpg               ← รูปเมนูย่อแล้ว 420×420 (ต้นฉบับอยู่ assets/menu/)
  js/config.js            ← CONFIG: เมนู ราคา ท็อปปิ้ง PIN
  js/core.js              ← baht/esc/pad, bizDate, addDays, ป้ายข้อความรายการ, csvText (ไม่แตะ DOM)
  js/pricing.js           ← priceItem(menu, state) ฟังก์ชันล้วน + priceSel() สำหรับหน้าจอ
  js/store.js             ← loadSales/saveSales (localStorage + โหมดหน่วยความจำ), nextNo
  js/reports.js           ← buildReport, รอบขาย/ช่วงวันที่ (REP)
  js/ui/modal.js          ← $, toast, openModal, askConfirm, askPin
  js/ui/print.js          ← ใบเสร็จ + ตั๋วครัว ผ่าน window.print()
  js/ui/builder.js, cart.js, pay.js, summary.js
  js/ui/main.js           ← updateNext, ตัวจัดการคลิกใน modal, เริ่มต้นหน้าจอ (ต้องโหลดเป็นไฟล์สุดท้าย)
  js/printer.js           ← ESC/POS, แปลงภาพเป็น raster (GS v 0), renderSlip วาดตั๋วลง canvas, UsbPrinter (WebUSB) · ยังไม่ได้ใส่ในแอป ใช้ใน printer-test ก่อน
printer-test/index.html   ← หน้าทดสอบฮาร์ดแวร์วันแรก (ใช้ ../app/js/printer.js) มีเช็กลิสต์ + log ให้คัดลอกส่งกลับ
tools/build-prototype.js  ← รวม app/ เป็น prototype/pos.html + pos-demo.html (ฝัง CSS/JS/รูป)
prototype/
  pos.html                ← ไฟล์ build (ห้ามแก้ตรง) ไฟล์เดียว เปิดได้เลย
  pos-demo.html           ← เหมือน pos.html + ข้อมูลตัวอย่าง 3 รอบขาย (เก็บข้อมูลแยก key)
  demo-seed.js            ← โค้ดสร้างข้อมูลตัวอย่าง (ใส่เฉพาะ pos-demo.html)
assets/menu/              ← รูปเมนูจริง (ต้นฉบับ)
tests/
  run-tests.js            ← รันทุกเทสต์
  app/pricing.test.js     ← คิดราคาใน vm เปล่า ไม่มี DOM
  app/app-files.test.js   ← เปิด app/index.html แบบแยกไฟล์ แล้วขาย 1 บิล
  app/printer.test.js     ← byte ESC/POS + raster ใน vm เปล่า
  app/printer-test-page.test.js ← หน้า printer-test กับปริ้นเตอร์ปลอม (jsdom ไม่มี canvas จึงไม่ได้เทสต์ภาพตั๋ว)
  prototype/*.test.js     ← เทสต์ pos.html ด้วย jsdom (กติการาคา, รายงาน, void/restore/CSV, รอบ 23:00)
```

**วิธีแยกไฟล์ใน `app/`**: ใช้ `<script src>` ธรรมดา (ไม่ใช่ ES module) เพื่อให้เปิดจาก `file://` ได้ ทุกไฟล์แชร์ตัวแปร global ร่วมกัน (`sel`, `cart`, `REP` ฯลฯ) และเทสต์เรียกผ่าน `w.eval` ได้ · โค้ดที่รันตอนโหลดไฟล์ (เช่น `$('x').onclick = fn`) ใช้ได้เฉพาะของที่ประกาศในไฟล์ก่อนหน้าหรือไฟล์เดียวกัน ถ้าเพิ่มไฟล์ใหม่ต้องใส่ใน `index.html` ตามลำดับ

### ส่วนที่ยังไม่ได้สร้าง (เพิ่มใน app/ ตามขั้นถัดไป)
```
app/
  manifest.webmanifest, sw.js
  js/store.js       ← เปลี่ยนเป็น IndexedDB + migration จาก localStorage ของต้นแบบ
  js/printer.js     ← มีแล้ว เหลือต่อเข้ากับ ui/print.js (ตั๋วจากบิลจริง + fallback window.print())
  js/promptpay.js   ← สร้าง payload EMVCo + CRC16 + QR
```

## คำสั่ง
```bash
npm install                 # ครั้งแรก (jsdom สำหรับเทสต์)
npm test                    # build prototype/ จาก app/ แล้วรันเทสต์ทั้งหมด
npm run build:prototype     # build อย่างเดียว (ใช้แค่ Node ไม่ต้องมี Python)
```
เปิดดูต้นแบบ: เปิด `prototype/pos-demo.html` ในเบราว์เซอร์ → 📊 สรุปยอด → PIN `1234`

## กฎการทำงาน
- **กติกาเงิน**: แก้เมนู/ราคา/กติกาเมื่อไร ต้องแก้ `docs/business-rules.md` + config + เทสต์ ให้ตรงกันในคราวเดียว และรันเทสต์ก่อนบอกว่าเสร็จ ห้ามเดาราคา ถ้าไม่ชัดให้ถาม Tee
- **ข้อมูลยอดขาย**: ห้ามลบบิล ใช้ `void` + `log` เสมอ · เปลี่ยนรูปแบบข้อมูลต้องมี migration และห้ามทำให้ข้อมูลเก่าหาย · ห้าม commit ไฟล์ CSV ยอดขายจริง
- **ออฟไลน์ก่อน**: ทุกฟีเจอร์ขายและพิมพ์ต้องทำงานได้โดยไม่มีเน็ต ห้ามโหลด font/สคริปต์จาก CDN ตอนใช้งานจริง
- **UI สำหรับพนักงานใหม่**: ปุ่มใหญ่ (≥ 48px), ข้อความไทยสั้นชัด, ปุ่มหลักเด่นกว่าปุ่มรอง (เช่น "เปลี่ยน" เด่นกว่า "ไม่รับ"), การกระทำที่ย้อนไม่ได้ต้องยืนยันก่อน
- **ห้ามใช้ `alert/confirm/prompt`** ของเบราว์เซอร์ (ถูกบล็อกในบางโหมด) ใช้ modal ของระบบเอง (`askConfirm`, `askPin`)
- **ส่งออกไฟล์** ห้ามพาออกจากหน้า POS (เคยเกิดจอขาว) ใช้หน้าต่างเลือก ดาวน์โหลด/แชร์/คัดลอก
- **ภาษาไทยบนตั๋ว**: render เป็นภาพเสมอ ไม่พึ่งฟอนต์ในปริ้นเตอร์
- **รอบขาย** เปลี่ยนวันเวลา 23:00 — ใช้ `bizDate()` เสมอ ห้ามใช้วันที่ปฏิทินตรงๆ ในรายงานหรือเลขออเดอร์
- สีแบรนด์: น้ำเงิน `#1A00B8`, ส้ม `#F7941D`, ขาว
- ทำงานเป็นขั้นเล็กๆ บอก Tee ว่าจะทำอะไรก่อนเริ่มงานใหญ่ และสรุปสั้นๆ ว่าเปลี่ยนอะไรหลังทำเสร็จ

## สมมติฐานที่ยังรอยืนยัน
ดูรายการ "คำถามที่ยังเปิดอยู่" ท้าย `docs/business-rules.md` — ถ้างานไหนขึ้นกับข้อเหล่านี้ ให้ถาม Tee ก่อน
