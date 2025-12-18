# CPE 386 - Group Project

ยินดีต้อนรับเข้าสู่โปรเจกต์ส่วนหนึ่งของวิชา CPE 386

## 📋 รายละเอียดโปรเจกต์

โปรเจกต์นี้เป็นเกม Web-based ที่สร้างด้วย JavaScript สำหรับการแสดงภาพ

### 🎮 คุณสมบัติหลัก
- **หลากหลายฉาก (Scenes)** - รองรับหลายสเตจของเกม
- **ระบบไขปริศนา (Puzzle System)** - คำถามและไขปริศนาสำหรับเกมเพลย์
- **การตรวจจับการชน (Collision Detection)** - สำหรับการหลีกเลี่ยงสิ่งกีดขวาง

## 📁 โครงสร้างโปรเจกต์

```
game-1/
├── index.html              # หน้าเริ่มต้น
├── start.html              # หน้าเลือกเกม
├── stage2.html             # สเตจที่ 2
├── python-guide.html       # คู่มือ Python
│
├── JavaScript Files
├── index.js                # ไฟล์หลักของเกม
├── battleScene.js          # ระบบสู้รบ
├── classes.js              # คลาส (Class) สำหรับตัวละคร
│
├── data/                   # ข้อมูลเกม
│   ├── characters.js       # ข้อมูลตัวละคร
│   ├── monsters.js         # ข้อมูลมอนสเตอร์
│   ├── attacks.js          # ระบบการโจมตี
│   ├── battleZones.js      # เขตสู้รบ
│   ├── collisions.js       # ข้อมูลการชน
│   └──  puzzles.js          # ข้อมูลไขปริศนา
│
├── data_stage2/            # ข้อมูลสเตจที่ 2
│   ├── characters.js
│   ├── collisions.js
│   └── puzzles.js
│
├── img/                    # รูปภาพและ sprites
│   ├── oldMan/
│   ├── villager/
│   ├── Quiz/
│   └── wall/
│
├── audio/                  # ไฟล์เสียง
├── js/
│   └── utils.js            # ฟังก์ชันอรรถประโยชน์
│
└── tools/
    └── resize_towertown.py # เครื่องมือจัดการขนาดภาพ
```

## 🚀 วิธีเริ่มต้น

1. **เปิดไฟล์** `start.html` ในเบราว์เซอร์
2. **เลือกสเตจ** ที่ต้องการเล่น
3. **เล่นเกม** และสนุกสนาน!

## 💾 ไฟล์ข้อมูล (Data Files)

- **characters.js** - ข้อมูลตัวละคร/ผู้เล่น
- **puzzles.js** - คำถามเพื่อความท้าทายเพิ่มเติม
- **collisions.js** - แผนที่ของสิ่งกีดขวาง

## 🎨 สายมติ

โปรเจกต์นี้ใช้สไตล์ **Press Start 2P** สำหรับลองรสชาติแบบ Retro/Pixel Art

## 📝 หมายเหตุ

สำหรับการพัฒนาเพิ่มเติม ให้ดู `python-guide.html` สำหรับคำแนะนำการใช้ Python
