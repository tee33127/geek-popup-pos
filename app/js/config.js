/* ============ ตั้งค่าร้าน (แก้ราคา/ท็อปปิ้ง/PIN ตรงนี้) ============ */
const CONFIG = {
  pin: '1234',                    // PIN เปิดหน้าสรุปยอด / ยกเลิกบิล
  shopName: 'Geek Yogurt & Smoothie Bar',
  shopSub: 'Pop-up Store',
  resetHour: 23,                  // เลขออเดอร์เริ่มที่ 001 ใหม่ทุกวันเวลา 23:00 น.
  paperMm: 80,                    // ความกว้างกระดาษเครื่องพิมพ์ (80 หรือ 58)
  autoPrint: true,                // พิมพ์ใบเสร็จ+ตั๋วครัวอัตโนมัติหลังชำระเงิน
  freeToppingCount: 3,            // Greek: ท็อปปิ้งฟรีกี่อย่าง (นับเฉพาะรายการในกลุ่มฟรี)
  overToppingPrice: 15,           // Greek: ท็อปปิ้งฟรีอย่างที่ 4 ขึ้นไป คิดอย่างละกี่บาท
  honeyDefault: 'normal',
  honey: [
    {id:'none',   name:'ไม่รับ'},
    {id:'little', name:'ราดนิดหน่อย'},
    {id:'normal', name:'ราดปกติ'},
    {id:'lots',   name:'ราดเยอะ'},
    {id:'side',   name:'แยก'},
  ],
  dining: [
    {id:'dinein',   name:'กินเลย',  icon:'🍽️'},
    {id:'takeaway', name:'กลับบ้าน', icon:'🛍️'},
  ],
  methods: [
    {id:'cash',      name:'เงินสด',           icon:'💵'},
    {id:'promptpay', name:'PromptPay',        icon:'📱'},
    {id:'tcp',       name:'ไทยช่วยไทย พลัส',   icon:'🤝'},
  ],
  cats: [
    {id:'dried', name:'Dried'},
    {id:'fruit', name:'Fruits'},
    {id:'sauce', name:'Sauce'},
  ],
  /* price 0 = ท็อปปิ้งฟรี (กลุ่ม Free) · price > 0 = Extra คิดเพิ่มตามราคา
     หมายเหตุ: น้ำผึ้งแยกเป็นตัวเลือกของตัวเอง (ฟรี ไม่นับใน 3 อย่าง) */
  items: [
    {name:'Almonds',cat:'dried',price:0}, {name:'Cashew',cat:'dried',price:0}, {name:'Chia',cat:'dried',price:0},
    {name:'Flaxseeds',cat:'dried',price:0}, {name:'Cherry Jelly',cat:'dried',price:0}, {name:'Cacao nibs',cat:'dried',price:0},
    {name:'Chocolate Chips',cat:'dried',price:0}, {name:'Biscoff Crumble',cat:'dried',price:0},
    {name:'Chocolate crumble',cat:'dried',price:0}, {name:'Marshmallow',cat:'dried',price:0},
    {name:'Banana',cat:'fruit',price:0}, {name:'Mango',cat:'fruit',price:0}, {name:'Kiwi',cat:'fruit',price:0},
    {name:'Hazelnut spread',cat:'sauce',price:0}, {name:'Original peanut butter',cat:'sauce',price:0},
    {name:'Cacao peanut butter',cat:'sauce',price:0}, {name:'Caramel',cat:'sauce',price:0},
    {name:'Granola',cat:'dried',price:10}, {name:'Blueberries',cat:'fruit',price:15}, {name:'Strawberries',cat:'fruit',price:15},
  ],
  menus: [
    {id:'greek', name:'Greek Yogurt', img:'img/greek-yogurt.jpg',
      sizes:[
        {id:'g1n', name:'1 สกู๊ป', sub:'ไม่มีท็อปปิ้ง',       price:69,  noTop:true},
        {id:'g1',  name:'1 สกู๊ป', sub:'ท็อปปิ้งฟรี 3 อย่าง', price:89},
        {id:'g2',  name:'2 สกู๊ป', sub:'ท็อปปิ้งฟรี 3 อย่าง', price:129},
      ]},
    {id:'acai', name:'Acai', img:'img/acai.jpg', price:189,
      defaults:['Banana','Strawberries','Blueberries','Granola','Flaxseeds']},
    {id:'banana', name:'Banana Choco', img:'img/banana-choco.jpg', price:149, noSwap:['Strawberries','Blueberries'],
      defaults:['Banana','Cacao peanut butter','Cashew','Chocolate Chips']},
  ],
};
/* ================================================================== */
