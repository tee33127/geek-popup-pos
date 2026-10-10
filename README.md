# Geek Pop-up POS

POS เขียนเองสำหรับร้าน Geek Yogurt & Smoothie Bar สาขา pop-up ทำงานบนแท็บเล็ต Android พิมพ์ตั๋วด้วยปริ้นเตอร์ความร้อน 80 มม. ใช้งานได้แม้ไม่มีอินเทอร์เน็ต

## ดูต้นแบบ
ออนไลน์: [ต้นแบบ DEMO](https://tee33127.github.io/geek-popup-pos/prototype/pos-demo.html) · [หน้าทดสอบปริ้นเตอร์](https://tee33127.github.io/geek-popup-pos/printer-test/)

เปิด `prototype/pos-demo.html` ในเบราว์เซอร์ (มีข้อมูลตัวอย่าง) → ปุ่ม 📊 สรุปยอด → PIN `1234`
ตัวจริงที่ยังไม่มีข้อมูลคือ `prototype/pos.html` · ซอร์สที่แยกไฟล์แล้วอยู่ใน `app/` (เปิด `app/index.html` ได้เหมือนกัน)

## ติดตั้งบนแท็บเล็ต (ใช้ได้แม้ไม่มีเน็ต)
1. เปิด Chrome บนแท็บเล็ต ไปที่ https://tee33127.github.io/geek-popup-pos/app/
2. กดเมนู ⋮ มุมขวาบน → **ติดตั้งแอป** (หรือ "เพิ่มลงในหน้าจอหลัก")
3. เปิดจากไอคอน **Geek POS** บนหน้าจอหลัก แอปจะเต็มจอ ไม่มีแถบที่อยู่เว็บ

เปิดครั้งแรกต้องมีเน็ต หลังจากนั้นเปิดได้แม้ออฟไลน์ ยอดขายเก็บในเครื่อง (IndexedDB) ไม่หายตอนอัปเดตแอป · เมื่อมีเวอร์ชันใหม่ แอปจะโหลดเบื้องหลังตอนมีเน็ต แล้วใช้เวอร์ชันใหม่ในการเปิดครั้งถัดไป (ปิดแอปจากรายการแอปล่าสุด แล้วเปิดใหม่)

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
