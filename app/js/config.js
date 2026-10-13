/* ============ ตั้งค่าร้าน (แก้ราคา/ท็อปปิ้ง/PIN ตรงนี้) ============ */
const CONFIG = {
  shopName: 'Geek Yogurt & Smoothie Bar',
  shopSub: 'Pop-up Store',
  resetHour: 23,                  // เลขออเดอร์เริ่มที่ 001 ใหม่ทุกวันเวลา 23:00 น.
  paperMm: 80,                    // ความกว้างกระดาษเครื่องพิมพ์ (80 หรือ 58)
  autoPrint: true,                // พิมพ์ใบเสร็จ+ตั๋วครัวอัตโนมัติหลังชำระเงินทุกบิล (หน้าสำเร็จไม่มีปุ่มพิมพ์ มีแค่ลิงก์พิมพ์ซ้ำ)
  freeToppingCount: 3,            // Greek: ท็อปปิ้งฟรีกี่อย่าง (นับเฉพาะรายการในกลุ่มฟรี)
  overToppingPrice: 15,           // Greek: ท็อปปิ้งฟรีอย่างที่ 4 ขึ้นไป คิดอย่างละกี่บาท
  honeyDefault: null,             // ไม่เลือกไว้ก่อน พนักงานต้องเลือกน้ำผึ้งเองทุกแก้ว (Tee 2026-10-12)
  addTopPrice: 15,                // Acai / Banana Choco: เพิ่มท็อปปิ้ง ชิ้นละ 15 ทุกอย่าง (รวม Extra) (Tee 2026-10-12)
  separateToppingPrice: 5,        // แยกท็อปปิ้ง (ใส่ถ้วยแยก) คิดเพิ่มต่อแก้ว ทุกเมนู · น้ำผึ้งแยกฟรี
  honey: [
    {id:'none',   name:'ไม่รับ'},
    {id:'little', name:'ราดนิดหน่อย'},
    {id:'normal', name:'ราดปกติ'},
    {id:'lots',   name:'ราดเยอะ'},
    {id:'side',   name:'แยก'},
  ],
  dining: [
    {id:'dinein',   name:'กินเลย'},
    {id:'takeaway', name:'กลับบ้าน'},
  ],
  methods: [
    /* logo = โลโก้ทางการ (ต้นฉบับใน assets/payment/) · ไม่มี logo ใช้ไอคอน */
    {id:'cash',      name:'เงินสด', icon:'cash'},
    {id:'promptpay', name:'PromptPay', logo:'img/promptpay.png'},
    {id:'tcp',       name:'ไทยช่วยไทย พลัส', logo:'img/thai-chuay-thai.png'},
  ],
  /* โปรโมชัน: 1 บิลใช้ได้ 1 โปร ใครกดก็ได้ บิลเก็บชื่อโปร + ยอดที่ลด · ค่าที่บวกเพิ่ม (เปลี่ยน/เพิ่มท็อปปิ้ง, แยก) คิดตามปกติ
     ปิดโปรไหนให้ลบออกจากรายการนี้ (บิลเก่ายังแสดงชื่อโปรตามที่บันทึกไว้) */
  promos: [
    {id:'b1g1',    type:'b1g1', name:'1 แถม 1', sub:'Acai / Banana Choco · แก้วที่ถูกที่สุดฟรี 1 แก้ว', menus:['acai','banana']},
    {id:'off30',   type:'off',  name:'ลด 30 บาท', sub:'Acai / Banana Choco 1 แก้ว', menus:['acai','banana'], amount:30},
    {id:'freetop', type:'freetop', name:'ฟรี 1 ท็อปปิ้ง', sub:'ท็อปปิ้งที่ต้องจ่าย 1 ชิ้น (ยกเว้น กราโนล่า บลูเบอร์รี่ สตรอว์เบอร์รี่)', exclude:['Granola','Blueberries','Strawberries']},
  ],
  cats: [
    {id:'dried', name:'Dried', th:'ธัญพืชและของแห้ง'},
    {id:'fruit', name:'Fruits', th:'ผลไม้'},
    {id:'sauce', name:'Sauce', th:'ซอส'},
  ],
  /* name = รหัสภาษาอังกฤษ ใช้เก็บในบิลและห้ามเปลี่ยน (บิลเก่าจะนับแยก) · th = ชื่อที่แสดงทุกที่ (ปุ่ม ตะกร้า ตั๋ว ใบเสร็จ รายงาน CSV)
     price 0 = ท็อปปิ้งฟรี (กลุ่ม Free) · price > 0 = Extra คิดเพิ่มตามราคา
     หมายเหตุ: น้ำผึ้งแยกเป็นตัวเลือกของตัวเอง (ฟรี ไม่นับใน 3 อย่าง) */
  items: [
    {name:'Almonds',th:'อัลมอนด์',cat:'dried',price:0}, {name:'Cashew',th:'เม็ดมะม่วงหิมพานต์',cat:'dried',price:0}, {name:'Chia',th:'เมล็ดเจีย',cat:'dried',price:0},
    {name:'Flaxseeds',th:'เมล็ดแฟลกซ์',cat:'dried',price:0}, {name:'Cherry Jelly',th:'เยลลี่เชอร์รี่',cat:'dried',price:0}, {name:'Cacao nibs',th:'คาเคานิบส์',cat:'dried',price:0},
    {name:'Chocolate Chips',th:'ช็อกโกแลตชิพ',cat:'dried',price:0}, {name:'Biscoff Crumble',th:'บิสคอฟครัมเบิล',cat:'dried',price:0},
    {name:'Chocolate crumble',th:'ช็อกโกแลตครัมเบิล',cat:'dried',price:0}, {name:'Marshmallow',th:'มาร์ชเมลโลว์',cat:'dried',price:0},
    {name:'Banana',th:'กล้วย',cat:'fruit',price:0}, {name:'Mango',th:'มะม่วง',cat:'fruit',price:0}, {name:'Kiwi',th:'กีวี',cat:'fruit',price:0},
    {name:'Hazelnut spread',th:'เฮเซลนัทสเปรด',cat:'sauce',price:0}, {name:'Original peanut butter',th:'เนยถั่วออริจินัล',cat:'sauce',price:0},
    {name:'Cacao peanut butter',th:'เนยถั่วคาเคา',cat:'sauce',price:0}, {name:'Caramel',th:'คาราเมล',cat:'sauce',price:0},
    {name:'Granola',th:'กราโนล่า',cat:'dried',price:10}, {name:'Blueberries',th:'บลูเบอร์รี่',cat:'fruit',price:15}, {name:'Strawberries',th:'สตรอว์เบอร์รี่',cat:'fruit',price:15},
  ],
  menus: [
    {id:'greek', name:'Greek Yogurt', short:'Greek', img:'img/greek-yogurt.jpg',
      sizes:[
        {id:'g1n', name:'1 สกู๊ป', sub:'ท็อปปิ้งชิ้นละ 15',   price:69,  perTop:15},   // ทุกท็อปปิ้ง (รวม Extra) ชิ้นละ 15 ไม่มีโควตาฟรี
        {id:'g1',  name:'1 สกู๊ป', sub:'ท็อปปิ้งฟรี 3 อย่าง', price:89},
        {id:'g2',  name:'2 สกู๊ป', sub:'ท็อปปิ้งฟรี 3 อย่าง', price:129},
      ]},
    {id:'acai', name:'Acai', img:'img/acai.jpg', price:189,
      defaults:['Banana','Strawberries','Blueberries','Granola','Flaxseeds']},
    {id:'banana', name:'Banana Choco', img:'img/banana-choco.jpg', price:149, noHoney:true,   // ไม่มีตัวเลือกน้ำผึ้ง บิลไม่เก็บ honey
      defaults:['Banana','Cacao peanut butter','Cashew','Chocolate Chips']},
  ],
};
/* ================================================================== */
