# Geek Pop-up POS

POS เขียนเองสำหรับร้าน Geek Yogurt & Smoothie Bar สาขา pop-up ทำงานบนแท็บเล็ต Android พิมพ์ตั๋วด้วยปริ้นเตอร์ความร้อน 80 มม. ใช้งานได้แม้ไม่มีอินเทอร์เน็ต

## ดูต้นแบบ
เปิด `prototype/pos-demo.html` ในเบราว์เซอร์ (มีข้อมูลตัวอย่าง) → ปุ่ม 📊 สรุปยอด → PIN `1234`
ตัวจริงที่ยังไม่มีข้อมูลคือ `prototype/pos.html` · ซอร์สที่แยกไฟล์แล้วอยู่ใน `app/` (เปิด `app/index.html` ได้เหมือนกัน)

## เอกสาร
- [กติกาธุรกิจ เมนู ราคา](docs/business-rules.md)
- [แผนพัฒนา 6 ขั้น](docs/project-plan.md)
- [ฮาร์ดแวร์](docs/hardware.md)
- Shopping list / งบ (PDF) อยู่ใน `docs/purchasing/` เฉพาะในเครื่อง ไม่ขึ้น GitHub

## สำหรับนักพัฒนา
```bash
npm install
npm test                  # build prototype/ จาก app/ แล้วรันเทสต์
npm run build:prototype   # build อย่างเดียว
```
คำแนะนำสำหรับ Claude Code อยู่ใน [CLAUDE.md](CLAUDE.md)
