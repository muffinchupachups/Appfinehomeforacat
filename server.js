require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// เชื่อมต่อ MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'flutter_signup',
  multipleStatements: true,
});

db.connect((err) => {
  if (err) {
    console.error('❌ เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', err);
  } else {
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ');
  }
});

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// สมัครสมาชิก
app.post(
  '/signup',
  [
    body('fullname').notEmpty().withMessage('กรุณากรอกชื่อ-นามสกุล'),
    body('age').isInt({ min: 1 }).withMessage('อายุต้องเป็นตัวเลข'),
    body('email').isEmail().withMessage('รูปแบบอีเมลไม่ถูกต้อง'),
    body('phone').notEmpty().withMessage('กรุณากรอกเบอร์โทร'),
    body('password').isLength({ min: 6 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัว'),
  ],
  async (req, res) => {
    console.log('📌 Request to /signup:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '❌ ข้อมูลไม่ถูกต้อง', errors: errors.array() });
    }

    try {
      const { fullname, age, email, phone, password } = req.body;

      // เช็คว่าอีเมลมีอยู่แล้วหรือไม่มี
      db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
          console.error('❌ ตรวจสอบอีเมลล้มเหลว:', err);
          return res.status(500).json({ message: '❌ เซิร์ฟเวอร์มีปัญหา' });
        }

        if (results.length > 0) {
          return res.status(400).json({ message: '❌ อีเมลนี้ถูกใช้ไปแล้ว' });
        }

        // เข้ารหัสผ่าน
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `INSERT INTO users (fullname, age, email, phone, password) VALUES (?, ?, ?, ?, ?)`;
        const values = [fullname, age, email, phone, hashedPassword];

        db.query(sql, values, (err, result) => {
          if (err) {
            console.error('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล:', err);
            return res.status(500).json({ message: '❌ ไม่สามารถสมัครสมาชิกได้' });
          }
          console.log('✅ สมัครสมาชิกสำเร็จ ID:', result.insertId);
          res.status(201).json({ message: '✅ สมัครสมาชิกสำเร็จ', userId: result.insertId });
        });
      });
    } catch (error) {
      console.error('❌ เซิร์ฟเวอร์มีปัญหา:', error);
      res.status(500).json({ message: '❌ เซิร์ฟเวอร์มีปัญหา', error });
    }
  }
);

// ล็อกอิน
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: '❌ กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  console.log("📌 Login request received - Email:", email);

  // อีเมลมีอยู่ในฐานข้อมูลหรือไม่มี
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('❌ ตรวจสอบข้อมูลล้มเหลว:', err);
      return res.status(500).json({ message: '❌ เซิร์ฟเวอร์มีปัญหา' });
    }

    if (results.length === 0) {
      console.log("❌ อีเมลไม่ถูกต้อง:", email);
      return res.status(401).json({ message: '❌ อีเมลไม่ถูกต้อง' });
    }

    const user = results[0];

    // ✅ ตรวจสอบรหัสผ่านโดยไม่ใช้ `await`
    bcrypt.compare(password, user.password, (err, validPassword) => {
      if (err) {
        console.error('❌ เปรียบเทียบรหัสผ่านล้มเหลว:', err);
        return res.status(500).json({ message: '❌ เซิร์ฟเวอร์มีปัญหา' });
      }

      if (!validPassword) {
        console.log("❌ รหัสผ่านไม่ถูกต้องสำหรับอีเมล:", email);
        return res.status(401).json({ message: '❌ รหัสผ่านไม่ถูกต้อง' });
      }

      console.log("✅ เข้าสู่ระบบสำเร็จ - User ID:", user.id);
      res.json({ message: '✅ เข้าสู่ระบบสำเร็จ', userId: user.id });
    });
  });
});
//โพสข้อมูลสัตว์
app.post('/api/postdata', (req, res) => {
  const { name, gender, age, traits, details, image } = req.body;

  if (!name || !gender || !age || !traits || !details || !image) {
    return res.status(400).json({ message: '❌ กรุณากรอกข้อมูลให้ครบ' });
  }

  const sql = `INSERT INTO animals (name, gender, age, traits, details, image_url) VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(sql, [name, gender, age, traits, details, image], (err, result) => {
    if (err) {
      console.error('❌ บันทึกข้อมูลล้มเหลว:', err);
      return res.status(500).json({ message: '❌ บันทึกข้อมูลล้มเหลว' });
    }
    res.json({ message: '✅ บันทึกข้อมูลสำเร็จ', id: result.insertId });
  });
});


app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  db.query('SELECT fullname, age, email, phone, password FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: '❌ ดึงข้อมูลโปรไฟล์ล้มเหลว', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: '❌ ไม่พบผู้ใช้' });
    }
    res.json(results[0]);
  });
});


app.put('/api/updateProfile/:userId', async (req, res) => {
  const { userId } = req.params;
  let { fullname, age, email, phone, password } = req.body;

  if (!fullname || !age || !email || !phone) {
    return res.status(400).json({ message: '❌ กรุณากรอกข้อมูลให้ครบ' });
  }

  try {
    // หากมีการส่งรหัสผ่านมาใหม่ ให้อัปเดตโดยเข้ารหัสก่อน
    if (password) {
      password = await bcrypt.hash(password, 10);
    }

    // อัปเดตข้อมูลในฐานข้อมูล (หากไม่มีรหัสผ่านใหม่ ใช้ค่ารหัสเดิม)
    db.query(
      'UPDATE users SET fullname = ?, age = ?, email = ?, phone = ?' + (password ? ', password = ?' : '') + ' WHERE id = ?',
      password ? [fullname, age, email, phone, password, userId] : [fullname, age, email, phone, userId],
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: '❌ อัปเดตข้อมูลไม่สำเร็จ', error: err });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: '❌ ไม่พบผู้ใช้ที่ต้องการอัปเดต' });
        }
        res.json({ message: '✅ อัปเดตข้อมูลสำเร็จ' });
      }
    );
  } catch (error) {
    console.error('❌ ข้อผิดพลาดในการเข้ารหัสรหัสผ่าน:', error);
    res.status(500).json({ message: '❌ เซิร์ฟเวอร์มีปัญหา', error });
  }
});




// 🚀 เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
