# CLAUDE.md — Geek Pop-up POS

ไฟล์นี้คือคำแนะนำสำหรับ Claude Code อ่านก่อนเริ่มงานทุกครั้ง

**เริ่มงานใหม่ให้อ่าน `docs/handoff.md` ก่อน** (VERSION ล่าสุด เรื่องค้าง รอทดสอบ รอตัดสินใจ)

## โปรเจกต์คืออะไร
POS เขียนเองสำหรับร้าน **Geek Yogurt & Smoothie Bar สาขา pop-up** (มี 3 เมนู: Greek Yogurt, Acai, Banana Choco) ใช้แทนการจดออเดอร์ด้วยมือ
- ผู้ใช้หลัก: **พนักงานใหม่** ต้องใช้ง่าย เรียนรู้ได้ในไม่กี่นาที
- อุปกรณ์: แท็บเล็ต **Android** (Redmi Pad 2 9.7") + ปริ้นเตอร์ความร้อน **Xprinter XP-Q807K (USB, 80 มม., ESC/POS)** ผ่านหัวแปลง OTG — รายละเอียดใน `docs/hardware.md`
- เจ้าของโปรเจกต์: Tee (พื้นหลัง UX/HCI) สื่อสารเป็น **ภาษาไทย** ตอบเป็นภาษาไทย ใช้ศัพท์เทคนิคภาษาอังกฤษได้
- ร้านหลักมี POS ของตัวเองอยู่แล้ว ระบบนี้ใช้เฉพาะ pop-up ไม่ต้องเชื่อมกับร้านหลัก

## สถานะตอนนี้
- **ขั้น 0 — เตรียมตัว** (ดู `docs/project-plan.md`) ฮาร์ดแวร์ยืนยันแล้ว รอซื้อ
- ซอร์สอยู่ใน `app/` แยกเป็นโมดูลแล้ว (ขั้น 0 ข้อ 1 เสร็จ) และ build เป็น `prototype/pos.html` ไฟล์เดียว ผ่านเทสต์ทั้งหมด: หน้าขาย, กติกาท็อปปิ้ง, ชำระเงิน, เลขออเดอร์, พิมพ์ผ่าน `window.print()`, สรุปยอด 5 แท็บ, ยกเลิก/นำกลับบิล, CSV
- **ขั้น 2 เริ่มแล้ว**: เก็บยอดขายใน IndexedDB เสร็จ (ย้ายข้อมูลจาก localStorage อัตโนมัติ + สำรองใน localStorage)
- PWA เสร็จ: ติดตั้งบนแท็บเล็ตได้ เปิดได้แม้ออฟไลน์ (`app/manifest.webmanifest`, `app/sw.js`) วิธีติดตั้งอยู่ใน README
- พิมพ์ตรงผ่าน USB ในแอปแล้ว: ปุ่ม "เชื่อมปริ้นเตอร์" บนแถบหัว (แสดงเฉพาะเบราว์เซอร์ที่มี WebUSB) · เครื่องที่เคยอนุญาตจะเชื่อมเองตอนเปิดแอป/เสียบสายใหม่ · หลังชำระเงิน (Tee 2026-10-17): ตั๋วครัวพิมพ์เองทุกบิล ใบเสร็จตามตั้งค่า `receiptMode()` (ทุกบิล / เมื่อลูกค้าขอ) · ไม่ได้เชื่อมหรือส่งไม่สำเร็จ → แจ้งบนหน้าสำเร็จ + แถบส้ม **ห้ามเด้ง `window.print()` เองโดยพนักงานไม่ได้กด** (ใช้เฉพาะตอนกดปุ่มพิมพ์บนเบราว์เซอร์ที่ไม่มี WebUSB) · **ทดสอบเครื่องจริงแล้ว 2026-10-15** (XP-Q807K + Redmi Pad 2 ผ่าน printer-test ครบ 9 ข้อ · vendor 0x0483 product 0x5743 · interface 0 class 7 · ep1 OUT bulk 64B · 109 KB ≈ 2.1 วิ)
- QR PromptPay ใส่ยอดเสร็จแล้ว: เลข PromptPay ตั้งในแอป (ตั้งค่า → เลข PromptPay) เก็บใน localStorage ของเครื่อง (`geek_popup_settings`) **ห้ามใส่เลขจริงในโค้ดหรือเทสต์** · เทสต์เทียบ payload กับ `promptpay-qr` และสแกนกลับด้วย `jsqr`
- โปรโมชัน 3 แบบ (1 แถม 1, ลด 30, ฟรี 1 ท็อปปิ้ง) 1 บิล 1 โปร: `js/promo.js` คำนวณ, `js/ui/promo-ui.js` ปุ่ม+หน้าต่าง, ตั้งค่าโปรใน `CONFIG.promos` · `cartTotal()` = ยอดหลังหักโปร, ราคาในรายการ (`unit`) เป็นราคาเต็มเสมอ
- เข้าใช้งานด้วยรหัส (`js/auth.js` + `js/ui/login.js`): ครั้งแรกตั้งเจ้าของ + รหัสกู้คืน · ผู้ใช้เก็บใน `SETTINGS.users` (รหัสเป็น sha256(salt:รหัส) ห้ามเก็บตัวเลข) · สิทธิ์อยู่ที่ `CAN` เช็กด้วย `can('void')` ฯลฯ · `USER` = คนที่เข้าอยู่ · บิลเก็บ `staff`, `staffId` · log ยกเลิกเก็บ `by` · เข้า/ออกเก็บใน `<SETTINGS_KEY>_staff_log` · ตารางสิทธิ์อยู่ใน business-rules.md §6.5 · ไม่มี PIN ในโค้ดแล้ว
- ตั้งค่า (ปุ่มบนแถบหัว): สวิตช์ มี/หมด ของเมนูและท็อปปิ้ง กดแล้วใช้ทันที + เลข PromptPay · ของหมดเก็บใน `SETTINGS.out = {menus, items}` แล้ว `applyOut` ใส่ `out:true` ใน CONFIG · **ราคาแก้ในแอปไม่ได้โดยตั้งใจ** (Tee 2026-10-12 กลัวกดผิด) แก้ราคาที่ CONFIG เท่านั้น
- เปิด/ปิดร้าน (`js/cash.js` + `js/ui/close-ui.js`): เข้าระบบด้วยรหัสแล้วรอบนี้ยังไม่มีเงินทอนตั้งต้น → ถาม (ข้ามได้) · สรุปยอด → ปิดร้าน / นับเงิน เทียบ นับได้ กับ ตั้งต้น + ขายเงินสด · เก็บใน `<SETTINGS_KEY>_cash` ต่อท้ายอย่างเดียว ใช้ครั้งล่าสุดของรอบ · ตารางอยู่แท็บชำระเงิน
- สำรอง/นำข้อมูลกลับ (`js/backup.js`): ไฟล์ JSON เดียว (บิล + settings + staff log + cash) · นำกลับ = รวม ไม่ลบ บิลซ้ำใช้ `newerSale` · ใช้พนักงาน/รหัสจากไฟล์เมื่อเลือก หรือเมื่อทำจากหน้าตั้งค่าครั้งแรก (เครื่องใหม่) · ทุกคนสำรองได้ นำกลับได้เฉพาะเจ้าของ · `SETTINGS.lastBackup`
- ฟอนต์ทั้งระบบ (Tee 2026-10-15): **IBM Plex Sans Thai Looped** (ไทยมีหัว) ใน `app/fonts/` + `app/css/fonts.css` ใช้ `var(--font)` · 400/600/700 subset · ห้ามใช้ฟอนต์อื่นหรือโหลดจากเน็ต · line-height ข้อความไทย ≥ 1.4
- ตั๋ว (Tee 2026-10-15): เนื้อหาอยู่ `js/slips.js` ชุดเดียว (USB + window.print + printer-test) · ใบเสร็จแยกกลุ่มท็อปปิ้งมีป้าย (ไม่รับ: แยกบรรทัด) · ตั๋วครัวไม่มีพื้นดำทึบ (กรอบเส้นหนา/เส้นคู่) หมายเหตุเป็นกรอบเด่น
- ขายได้ทีละหน้า (Tee 2026-10-16 · `js/ui/tablock.js`): Web Lock `geek-pos-<KEY>` หน้าที่สองขึ้นจอ "แอปเปิดอยู่อีกหน้าแล้ว" + "ใช้หน้านี้แทน" (steal → หน้าเก่าหยุดขาย แล้วหน้านี้ reload ให้ได้บิลล่าสุด) · `confirmPay` เช็ก `tabCanSell()` · รีเฟรช/ปิดแล้วเปิดใหม่ไม่ติด (รอ lock คืนได้ถึง 2.5 วิ) · ไม่มี navigator.locks (jsdom, เบราว์เซอร์เก่า) = แบบเดิม · เทสต์ใน e2e D03
- ใบเสร็จ/ตะกร้าบอกจำนวนชิ้นที่คิดเงิน (Tee 2026-10-16 · `topQtyText` ใน slips.js): "กล้วย ×2" / "กล้วย ×2 · +30" / "กล้วย ×2 · เพิ่ม 1 ชิ้น +15" · แสดงผลอย่างเดียว ยอดไม่เปลี่ยน · ตั๋วครัวและ CSV (`topLabel`) ยังเป็นรูปแบบเดิม
- ยังไม่มี: เปิดลิ้นชัก

## งานถัดไป (ขั้น 0 → 1)
1. ~~แยกต้นแบบเป็นโมดูล~~ เสร็จแล้ว อยู่ใน `app/`
2. ~~ทำ `printer-test/`~~ เสร็จแล้ว ออนไลน์ที่ https://tee33127.github.io/geek-popup-pos/printer-test/ (WebUSB ใช้ได้เฉพาะ https หรือ localhost)
3. รอผลเช็กลิสต์ขั้น 1 แล้วตัดสินใจ PWA vs แอป Android (Capacitor)

## โครงสร้างโฟลเดอร์
```
CLAUDE.md                 ← ไฟล์นี้
.claude/commands/check-all.md ← คำสั่ง /check-all ตรวจงานทั้งหมดตาม docs/qa-checklist.md (ตรวจอย่างเดียว ไม่แก้ app/)
README.md                 ← ภาพรวมสำหรับคน
docs/
  business-rules.md       ← แหล่งความจริงของเมนู ราคา กติกา (+ คำถามที่ยังเปิด)
  project-plan.md         ← แผน 6 ขั้น เช็กลิสต์ทดสอบฮาร์ดแวร์ ความเสี่ยง
  hardware.md             ← อุปกรณ์ที่ยืนยันแล้ว + คำสั่ง ESC/POS
  qa-checklist.md         ← เช็กลิสต์ตรวจก่อนปล่อย (รหัส Z/P/PR/C/U/V/R/E/K/D/X/H/F/UI) · แก้กติกาใน business-rules.md ต้องแก้ค่าคาดหวังที่นี่ด้วย
  qa/                     ← รายงานผลตรวจ report-YYYY-MM-DD.md (screens/ อยู่ใน .gitignore)
  purchasing/*.pdf        ← shopping list และงบที่เสนอเจ้าของร้าน (อยู่ใน .gitignore ห้าม commit เพราะ repo เป็น public)
app/                      ← ซอร์สจริง (แก้ที่นี่) เปิด app/index.html ได้เลย
  index.html              ← markup + ลำดับ <script> (ลำดับสำคัญ ดูด้านล่าง)
  css/fonts.css           ← @font-face IBM Plex Sans Thai Looped (โหลด ../fonts/*.woff2) + `--font` · ใช้ร่วมกับ printer-test/ manual/ · build ฝัง base64 ใน prototype
  css/pos.css
  fonts/                  ← plex-thai-looped-400/600/700.woff2 (subset ด้วย fonttools pyftsubset: Thai + Latin พื้นฐาน + ฿ × · – … → − ≈ ≥ ✓) + OFL.txt
  manifest.webmanifest    ← PWA: ชื่อแอป ไอคอน สีแบรนด์
  sw.js                   ← service worker เก็บไฟล์แอปทั้งหมดไว้ใช้ออฟไลน์ · VERSION/FILES สร้างโดย build ห้ามแก้มือ
  icons/                  ← icon.svg (ต้นฉบับ) → icon-192/512.png
  img/*.jpg, *.png        ← รูปเมนูย่อแล้ว 420×420 (ต้นฉบับอยู่ assets/menu/) + โลโก้วิธีชำระเงิน
  js/version.js           ← APP_VERSION {v, built} สร้างโดย build (ห้ามแก้มือ) · v = VERSION ใน sw.js · แสดงท้ายหน้าตั้งค่า ไว้เช็กว่าแท็บเล็ตอัปเดตแล้ว
  js/config.js            ← CONFIG: เมนู ราคา ท็อปปิ้ง · ท็อปปิ้งมี name (รหัสอังกฤษที่เก็บในบิล ห้ามเปลี่ยน) + th (ชื่อที่แสดง ผ่าน topName())
  js/core.js              ← baht/esc/pad, bizDate, addDays, ป้ายข้อความรายการ, csvText (ไม่แตะ DOM)
  js/icons.js             ← ไอคอน SVG (icon('check')) ใช้แทนอีโมจิทั้งแอป · ห้ามใช้อีโมจิ (มีเทสต์ตรวจใน pwa.test.js)
  js/pricing.js           ← priceItem(menu, state) ฟังก์ชันล้วน + priceSel() สำหรับหน้าจอ
  js/store.js             ← loadSales/saveSales (sync, ถือข้อมูลในหน่วยความจำ) เขียนลง IndexedDB เบื้องหลัง + สำรอง localStorage · storeReady ต้องรอก่อนใช้ · saveSales ไม่ลบบิล · clearSales ใช้เฉพาะ DEMO
  js/reports.js           ← buildReport, รอบขาย/ช่วงวันที่ (REP)
  js/ui/codepad.js (ต่อ)  ← แป้นเงินของแอป moneyField(id, value, cur) + moneyPadHtml() (data-mk) ใช้กับรับเงินมา / เงินทอนตั้งต้น / ปิดร้าน · ช่อง readonly inputmode="none" กดแป้นแล้วยิง input event ให้ตัวจัดการเดิม
  js/ui/builder.js (ต่อ)  ← chipHtml() ปุ่มท็อปปิ้งแบบเดียวทั้งแอป (Greek / หน้าต่างเปลี่ยน openSwap / หน้าต่างเพิ่ม openAdds ใช้ toppingGrid เดียวกัน) แบบ A: ข้อความชิดซ้าย จำนวนบรรทัดล่าง "n ชิ้น · +฿" ปุ่ม − แถบขวาในปุ่ม ห้ามมีอะไรยื่นนอกขอบ · แนวนอน 5 คอลัมน์เสมอ · fitNames() ลดขนาดตัวอักษรชื่อยาว (≥ 11px) ห้ามตัดคำ · แตะ = +1, − = ลด
  js/ui/cart.js (ต่อ)     ← รายละเอียดแก้ว cartDetailHtml ใช้ topGroups (slips.js) เหมือนใบเสร็จ กลุ่มละบรรทัดเดียว ตัด … แตะ = ดูเต็ม (cartFull) · กล่องออเดอร์ยุบ/ขยาย (แนวนอน): body.picking = แถบแคบ #cartMini · body.cartopen = overlay (คอลัมน์ main ไม่เปลี่ยน) · cartMode() เรียกจาก renderBuilder · openPay ถามก่อนถ้ามีแก้วค้าง (askPendingCup) · cartFlash ไฮไลต์บรรทัดที่เพิ่งเพิ่ม
  js/ui/modal.js          ← $, toast (ลอยเหนือแถบล่าง · มีหน้าต่างเปิด = .mtoast ในหน้าต่าง), openModal(body, {title, key, foot, wide, backdrop, onClose}) หัวติดบน + X (id closeX → modalClose) + แถบล่าง · เลื่อนเฉพาะ .mbody · ล็อก body (iOS: position fixed + จำ scrollY) · key เดิม = คงตำแหน่งเลื่อน · askConfirm, askOwner
  js/ui/codepad.js        ← ใส่รหัส 2 แบบ: แป้นของแอป (padNew/padHtml/padVal/padError) เฉพาะหน้าเข้าใช้งาน + รหัสกู้คืน · ฟอร์มอื่น (ตั้งค่าครั้งแรก, ตั้งรหัสใหม่, พนักงาน, askOwner) ใช้ codeField(id, ปุ่มที่ Enter กด) = ช่อง text แป้นตัวเลข ซ่อนด้วย CSS + ปุ่มตากดค้าง (Tee 2026-10-13 แป้นของแอปในฟอร์มทำให้งง) · **ห้ามใช้ `<input type=password>`** iPad ขึ้นแป้นตัวอักษร · ช่องตัวเลขอื่นใส่ `data-digits pattern="[0-9]*"` · `data-enter="id"` = Enter กดปุ่มนั้น
  js/slips.js             ← เนื้อหาตั๋ว receiptBlocks / kitchenBlocks (ไม่แตะ DOM) + slipHtml (HTML จากบล็อกเดียวกัน) + slipLines (ข้อความทีละบรรทัดไว้เทสต์) · ใช้ทั้งแอปและ printer-test · แก้ตั๋วแก้ที่นี่ที่เดียว
  js/ui/print.js          ← receiptHtml/kitchenHtml = slipHtml(…Blocks) · printSale เลือก USB ก่อน (รอ slipFontsReady แล้ววาด) + ปุ่มปริ้นเตอร์ · ส่งทีละใบ (printJobs) หมดเวลาต่อใบ jobTimeout ≥ 15 วิ (PRINT_TIMEOUT) → printerStuck: ล้างคิว (printGen) ปิด/เชื่อมใหม่ · PRINTED สถานะต่อบิล ok/fail/wait/nocon/unknown · printSale(s, which, manual) ข้ามใบที่ wait (กดรัวไม่ซ้อน) · doneHtml/renderDone หน้าสำเร็จ (#prStatus #prReceipt #prKitchen #prConnect) · reprint() เฉพาะใบที่ขาดหรือให้เลือก · แถบ #printFail (Tee 2026-10-16/17)
  js/ui/builder.js        ← หน้าเลือกออเดอร์ (v3 Tee 2026-10-13): ขั้นที่เปิดแล้วเปิดค้าง (stepsShown) · ครบแล้ว = ถูกเขียว (stepDone) · ขั้นใหม่ .enter + เลื่อนจอ · ปุ่มหลักหน้าที่เดียว ยังขาด = class off + flashStep(missingStep()) · ช่องสรุปแก้วในแถบล่าง cupSummaryHtml (P จาก priceSel() ตัวเดียวกับปุ่ม) · แถบล่าง #actBar position fixed ความสูงคงที่ (--abh) วางตรงกล่องเลือกด้วย placeActBar() · หน้าต่างถามท็อปปิ้งตอนกดเพิ่ม · เทสต์ใช้ tests/flow-helper.js
  js/ui/cart.js, pay.js, summary.js
  js/ui/tablock.js        ← ขายได้ทีละหน้า (Web Locks) จอ "แอปเปิดอยู่อีกหน้าแล้ว" · TAB_STATE free/wait/own/other · tabCanSell() · โหลดก่อน main.js
  js/ui/main.js           ← updateNext, ตัวจัดการคลิกใน modal, เริ่มต้นหน้าจอ (ต้องโหลดเป็นไฟล์สุดท้าย)
  js/promptpay.js         ← PP.payload(id, amount) EMVCo + CRC16 (ฟังก์ชันล้วน), เช็กเลข 13 หลัก, qrSvg วาด QR
  js/vendor/qrcode.js     ← qrcode-generator 1.4.4 (MIT) คัดลอกมาไว้ใช้ออฟไลน์ ห้ามแก้
  js/promo.js             ← promoEval(p, items, want) คำนวณโปรจากตะกร้า (ฟังก์ชันล้วน)
  js/ui/promo-ui.js       ← ปุ่มโปรในกล่องออเดอร์ + หน้าต่างเลือกโปร/เลือกแก้ว
  js/settings.js          ← SETTINGS / saveSettings ตั้งค่าเฉพาะเครื่อง (localStorage) + applyOut/setOut (ของหมด) · โหลดต่อจาก config.js ทันที · readStored/keepCorrupt: JSON เสีย → เก็บของเดิมที่ `<key>_corrupt_<เวลา>` ห้ามลบ (SETTINGS_BROKEN → หน้า "ข้อมูลตั้งค่าเสีย") · รหัสกู้คืนเก็บที่ RECOVERY_KEY แยกจาก settings (recoveryHash/setRecoveryHash)
  js/ui/settings-ui.js    ← หน้าตั้งค่า (ปุ่มบนแถบหัว): สวิตช์ มี/หมด + เลข PromptPay / พนักงาน / รหัสกู้คืน (เจ้าของ)
  js/auth.js              ← ผู้ใช้ สิทธิ์ (CAN) sha256 แบบ sync (crypto.subtle ใช้ไม่ได้บน file://) session รายวัน log เข้า/ออก
  js/cash.js              ← เงินทอนตั้งต้น / นับเงินปิดร้าน (cashLog, addCash, dayFloat, cashSales, cashCount)
  js/backup.js            ← backupData / parseBackup / applyBackup (ไม่แตะ DOM)
  js/ui/close-ui.js       ← ถามเงินทอนตั้งต้น, หน้าปิดร้าน, สำรอง (exportFile ใน summary.js), นำข้อมูลกลับ (restoreText ให้เทสต์เรียกตรง)
  js/ui/login.js          ← หน้าเข้าใช้งานเต็มจอ (ตั้งครั้งแรก / แป้นรหัส / รหัสกู้คืน) + ปุ่มผู้ใช้บนแถบหัว + needUser()
  js/printer.js           ← ESC/POS, UsbPrinter.send หยุดเมื่อรอบการเชื่อม (session) เปลี่ยน · raster (GS v 0) แถบละ 24 แถว · ESCPOS.recover ล้างคำสั่งภาพที่ค้าง (ส่งก่อนงานแรกเมื่อ usbPrinter.dirty = open/fail · บั๊ก H23 2026-10-17) · status() DLE EOT เฉพาะมี bulk IN · renderSlip วาดบล็อกลง canvas (fillRect + fillText เท่านั้น), wrapText (ตัดคำ ห้ามขึ้นบรรทัดด้วยเครื่องหมาย), slipFontsReady (รอฟอนต์ ≤ 2 วิ), UsbPrinter (WebUSB) · ใช้ทั้งในแอป (โหลดก่อน ui/) และ printer-test
manual/index.html         ← คู่มือพนักงาน 1 หน้า + การ์ดแก้ปัญหา (พิมพ์ A4 2 หน้า) · **แก้ข้อความปุ่ม/ขั้นตอนในแอป ต้องแก้คู่มือด้วย**
printer-test/index.html   ← หน้าทดสอบฮาร์ดแวร์ (ใช้ ../app/js/ config core printer slips + css/fonts.css) ตั๋วตัวอย่างเป็นบิลสมมติผ่าน receiptBlocks/kitchenBlocks ของแอป + บรรทัดทดสอบสระ (เฉพาะหน้านี้) · เช็กลิสต์ + log
tools/build-prototype.js  ← รวม app/ เป็น prototype/pos.html + pos-demo.html (ฝัง CSS/JS/รูป) และเขียน VERSION + FILES ใน app/sw.js จาก hash ไฟล์ใน app/
prototype/
  pos.html                ← ไฟล์ build (ห้ามแก้ตรง) ไฟล์เดียว เปิดได้เลย
  pos-demo.html           ← เหมือน pos.html + ข้อมูลตัวอย่าง 3 รอบขาย (เก็บข้อมูลแยก key)
  demo-seed.js            ← โค้ดสร้างข้อมูลตัวอย่าง (ใส่เฉพาะ pos-demo.html)
assets/menu/              ← รูปเมนูจริง (ต้นฉบับ)
assets/payment/           ← โลโก้ PromptPay / ไทยช่วยไทย ต้นฉบับ (Tee ให้มา) → ย่อเป็น app/img/promptpay.png, thai-chuay-thai.png
tests/
  run-tests.js            ← รันทุกเทสต์
  app/pricing.test.js     ← คิดราคาใน vm เปล่า ไม่มี DOM
  app/pwa.test.js         ← manifest, ไอคอน, รายการไฟล์ใน sw.js ครบ, จำลองติดตั้งแล้วตัดเน็ต
  app/store.test.js       ← IndexedDB จำลอง (fake-indexeddb): migration, เปิดหน้าใหม่, รวมสองแหล่ง, พื้นที่เต็ม, โหมดสำรอง
  app/app-files.test.js   ← เปิด app/index.html แบบแยกไฟล์ แล้วขาย 1 บิล
  app/printer.test.js     ← byte ESC/POS + raster ใน vm เปล่า
  app/printer-recover.test.js ← ตัดงานกลางรูปหลายตำแหน่ง แล้วพิมพ์ใหม่ ผ่านปริ้นเตอร์จำลอง (escpos-emu.js) ต้องไม่มีตัวมั่ว
  escpos-emu.js           ← ปริ้นเตอร์ ESC/POS จำลอง แปลคำสั่งทีละ byte (ESC @, GS v 0, GS V, DLE EOT, ตัวอักษร)
  app/printer-test-page.test.js ← หน้า printer-test กับปริ้นเตอร์ปลอม (jsdom ไม่มี canvas จึงไม่ได้เทสต์ภาพตั๋ว)
  app/slips.test.js       ← ตั๋วใน vm + canvas จำลอง: ไม่รับแยกกลุ่ม ตัดบรรทัด ราคาต่อชิ้น ท้ายใบ หมายเหตุถูกแก้ว ไม่มีพื้นดำ คอลัมน์ตรง รอฟอนต์
  qa/e2e.test.js          ← npm run qa:e2e (Playwright 4 จอ) · S01 วาดตั๋วด้วยฟอนต์จริง → docs/qa/screens/<วันที่>/slips/*.png
  auth-helper.js          ← บัญชีทดสอบ (เจ้าของ 1234 · พนักงาน แพร 1111) seed() ใน beforeParse + signIn() หลังเปิดหน้า · เทสต์หน้าจอใหม่ต้องใช้
  prototype/*.test.js     ← เทสต์ pos.html ด้วย jsdom (กติการาคา, รายงาน, void/restore/CSV, รอบ 23:00)
```

**ที่เก็บข้อมูล**: IndexedDB ชื่อเดียวกับ `KEY` (DEMO ใช้ชื่อแยก) object store `sales` keyPath `id` · ตอนเปิดหน้าอ่านทั้ง IndexedDB และ localStorage มารวมกัน ถ้าบิลเดียวกันต่างกัน ใช้ฉบับที่ `log` ยาวกว่า · jsdom ไม่มี IndexedDB เทสต์ prototype จึงวิ่งโหมด localStorage ส่วนโหมด IndexedDB เทสต์ใน `store.test.js` · ถ้าเทสต์ต้องใส่บิลหลังเปิดหน้า ให้เรียก `saveSales` ห้ามเขียน localStorage ตรง (หน้าไม่อ่านซ้ำ)

**วิธีแยกไฟล์ใน `app/`**: ใช้ `<script src>` ธรรมดา (ไม่ใช่ ES module) เพื่อให้เปิดจาก `file://` ได้ ทุกไฟล์แชร์ตัวแปร global ร่วมกัน (`sel`, `cart`, `REP` ฯลฯ) และเทสต์เรียกผ่าน `w.eval` ได้ · โค้ดที่รันตอนโหลดไฟล์ (เช่น `$('x').onclick = fn`) ใช้ได้เฉพาะของที่ประกาศในไฟล์ก่อนหน้าหรือไฟล์เดียวกัน ถ้าเพิ่มไฟล์ใหม่ต้องใส่ใน `index.html` ตามลำดับ

**PWA**: แก้ไฟล์ใน `app/` แล้วต้องรัน `npm test` (หรือ build) ก่อน commit เสมอ ไม่งั้น `sw.js` ไม่เปลี่ยน VERSION แท็บเล็ตจะไม่โหลดไฟล์ใหม่ · บอก Tee เลข VERSION ใหม่ทุกครั้งที่ push (ดูได้ใน ตั้งค่า บนแท็บเล็ต) · ไฟล์ใหม่ใน `app/` ถูกใส่ใน cache อัตโนมัติ · service worker ใช้ skipWaiting หน้าที่เปิดอยู่ใช้โค้ดเดิมจนเปิดใหม่ (ทุกไฟล์โหลดตอนเริ่ม จึงไม่มีโค้ดปนเวอร์ชัน)

## GitHub
repo สาธารณะ https://github.com/tee33127/geek-popup-pos · GitHub Pages เสิร์ฟจาก `main` ที่ root (push แล้วขึ้นเว็บใน 1-2 นาที) · ห้าม commit ข้อมูลยอดขายจริง เอกสารงบ หรือรหัสจริง

## คำสั่ง
```bash
npm install                 # ครั้งแรก (jsdom + fake-indexeddb สำหรับเทสต์)
npm test                    # build prototype/ จาก app/ แล้วรันเทสต์ทั้งหมด
npm run build:prototype     # build อย่างเดียว (ใช้แค่ Node ไม่ต้องมี Python)
```
ตรวจงานทั้งหมดก่อนปล่อย: พิมพ์ `/check-all` ใน Claude Code (หรือ `/check-all pricing promo` เฉพาะหมวด) → รายงานที่ `docs/qa/`
เปิดดูต้นแบบ: เปิด `prototype/pos-demo.html` ในเบราว์เซอร์ → ใส่รหัส DEMO (เจ้าของ `1234` · พนักงาน `1111` · รหัสกู้คืน `12345678`)

## กฎการทำงาน
- **กติกาเงิน**: แก้เมนู/ราคา/กติกาเมื่อไร ต้องแก้ `docs/business-rules.md` + config + เทสต์ ให้ตรงกันในคราวเดียว และรันเทสต์ก่อนบอกว่าเสร็จ ห้ามเดาราคา ถ้าไม่ชัดให้ถาม Tee
- **ข้อมูลยอดขาย**: ห้ามลบบิล ใช้ `void` + `log` เสมอ · เปลี่ยนรูปแบบข้อมูลต้องมี migration และห้ามทำให้ข้อมูลเก่าหาย · ห้าม commit ไฟล์ CSV ยอดขายจริง
- **ออฟไลน์ก่อน**: ทุกฟีเจอร์ขายและพิมพ์ต้องทำงานได้โดยไม่มีเน็ต ห้ามโหลด font/สคริปต์จาก CDN ตอนใช้งานจริง
- **UI สำหรับพนักงานใหม่**: ปุ่มที่กดได้ ≥ 44px (Tee 2026-10-14 ลดจาก 48 ให้หน้าขายเห็นครบในจอเดียว), ขนาดทั้งแอปคุมด้วย `--ui-scale` ใน `:root` ของ `app/css/pos.css` (ตอนนี้ .88 · ค่าใน CSS เขียนเป็น `calc(Npx * var(--ui-scale))` ปุ่มใช้ `max(44px, …)` ตัวอักษร `max(12px, …)` · ส่วนพิมพ์ตั๋วไม่ขึ้นกับค่านี้) · หน้าขาย Redmi แนวนอนต้องเห็นครบในจอเดียว (e2e UI16), ข้อความไทยสั้นชัด, ปุ่มหลักเด่นกว่าปุ่มรอง (เช่น "เปลี่ยน" เด่นกว่า "ไม่รับ"), การกระทำที่ย้อนไม่ได้ต้องยืนยันก่อน
- **ห้ามใช้ `alert/confirm/prompt`** ของเบราว์เซอร์ (ถูกบล็อกในบางโหมด) ใช้ modal ของระบบเอง (`askConfirm`, `askOwner`)
- **ส่งออกไฟล์** ห้ามพาออกจากหน้า POS (เคยเกิดจอขาว) ใช้หน้าต่างเลือก ดาวน์โหลด/แชร์/คัดลอก
- **ภาษาไทยบนตั๋ว**: render เป็นภาพเสมอ ไม่พึ่งฟอนต์ในปริ้นเตอร์
- **รอบขาย** เปลี่ยนวันเวลา 23:00 — ใช้ `bizDate()` เสมอ ห้ามใช้วันที่ปฏิทินตรงๆ ในรายงานหรือเลขออเดอร์
- สีแบรนด์: น้ำเงิน `#1A00B8`, ส้ม `#F7941D`, ขาว
- ทำงานเป็นขั้นเล็กๆ บอก Tee ว่าจะทำอะไรก่อนเริ่มงานใหญ่ และสรุปสั้นๆ ว่าเปลี่ยนอะไรหลังทำเสร็จ

## สมมติฐานที่ยังรอยืนยัน
ดูรายการ "คำถามที่ยังเปิดอยู่" ท้าย `docs/business-rules.md` — ถ้างานไหนขึ้นกับข้อเหล่านี้ ให้ถาม Tee ก่อน
