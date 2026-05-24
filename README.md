# UNO 生词 · 水果 🍎
## Multiplayer Chinese Vocabulary UNO Game

เกม UNO เรียนคำศัพท์ภาษาจีน หัวข้อผลไม้ สำหรับ 2-4 คน

### วิธี Deploy บน Railway

1. **สร้าง GitHub repo ใหม่** และ push โค้ดทั้งหมดขึ้น:
   ```bash
   git init
   git add .
   git commit -m "Initial UNO game"
   git remote add origin https://github.com/YOUR_USERNAME/uno-chinese.git
   git push -u origin main
   ```

2. **ไปที่ [railway.app](https://railway.app)** → New Project → Deploy from GitHub

3. **เลือก repo** ที่ push ขึ้นไป → Railway จะ detect Node.js อัตโนมัติ

4. **Railway จะ deploy อัตโนมัติ** และให้ URL เช่น `https://uno-chinese.up.railway.app`

### วิธีเล่น

1. เปิด URL บนอุปกรณ์ทั้ง 2-4 เครื่อง
2. ใส่ชื่อผู้เล่น และ **รหัสห้องเดียวกัน** (เช่น `room1`)
3. **Player 1** กด "เริ่มเกม" เมื่อทุกคนเข้าร่วมแล้ว
4. เล่น UNO ตามปกติ! ไพ่ตัวเลขใช้ชื่อผลไม้ภาษาจีน

### ไพ่ในเกม

| ผลไม้ | พินอิน | เลข |
|--------|--------|-----|
| 苹果 | píng guǒ | 0 |
| 葡萄 | pútáo | 1 |
| 香蕉 | xiāngjiāo | 2 |
| 橘子 | júzi | 3 |
| 菠萝 | bōluó | 4 |
| 芒果 | mángguǒ | 5 |
| 草莓 | cǎoméi | 6 |
| 木瓜 | mùguā | 7 |
| 榴莲 | liúlián | 8 |

### กฎ UNO

- วางไพ่ที่ตรง **สี** หรือ **ผลไม้** (ตัวเลข) กับไพ่บนกอง
- ไม่มีไพ่วาง → แตะ draw pile แตะ 1 ใบ
- **Skip** (🚫) = ข้ามตาคนถัดไป
- **Reverse** (🔄) = กลับทิศทาง
- **+2** = คนถัดไปแตะ 2 ใบ
- **Wild** (🌈) = เลือกสีใหม่
- **Wild+4** (🌈+4) = เลือกสี + คนถัดไปแตะ 4 ใบ
- เหลือไพ่ใบสุดท้าย = **UNO!**
- หมดไพ่ก่อน = ชนะ!
