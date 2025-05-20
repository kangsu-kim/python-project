const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// @route    GET api/users
// @desc     Get all users
// @access   Private (Admin only)
router.get('/', [auth, adminOnly], async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('서버 오류');
  }
});

// @route    POST api/users
// @desc     Create a user (admin only)
// @access   Private
router.post(
  '/',
  [
    auth,
    adminOnly,
    [
      check('username', '사용자명은 필수입니다').not().isEmpty(),
      check('email', '유효한 이메일을 입력해주세요').isEmail(),
      check('password', '비밀번호는 6자 이상이어야 합니다').isLength({ min: 6 }),
      check('role', '역할은 필수입니다').isIn(['admin', 'manager', 'driver', 'clerk'])
    ]
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body;

    try {
      // Check if user already exists
      const [existingUsers] = await pool.query(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ message: '이미 존재하는 사용자명 또는 이메일입니다' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert user
      const [result] = await pool.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, role]
      );

      if (result.affectedRows > 0) {
        // Get the created user
        const [newUser] = await pool.query(
          'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
          [result.insertId]
        );

        res.status(201).json(newUser[0]);
      } else {
        res.status(500).json({ message: '사용자 생성 실패' });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    PUT api/users/:id
// @desc     Update a user
// @access   Private (Admin only)
router.put(
  '/:id',
  [
    auth,
    adminOnly,
    [
      check('username', '사용자명은 필수입니다').optional().not().isEmpty(),
      check('email', '유효한 이메일을 입력해주세요').optional().isEmail(),
      check('password', '비밀번호는 6자 이상이어야 합니다').optional().isLength({ min: 6 }),
      check('role', '유효한 역할을 선택해주세요').optional().isIn(['admin', 'manager', 'driver', 'clerk'])
    ]
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body;
    const userId = req.params.id;

    try {
      // Check if user exists
      const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (userRows.length === 0) {
        return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
      }

      // Build update fields
      let updateQuery = 'UPDATE users SET ';
      const updateValues = [];
      
      if (username) {
        updateQuery += 'username = ?, ';
        updateValues.push(username);
      }
      
      if (email) {
        updateQuery += 'email = ?, ';
        updateValues.push(email);
      }
      
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateQuery += 'password = ?, ';
        updateValues.push(hashedPassword);
      }
      
      if (role) {
        updateQuery += 'role = ?, ';
        updateValues.push(role);
      }
      
      // Remove trailing comma and space
      updateQuery = updateQuery.slice(0, -2);
      
      // Add WHERE condition
      updateQuery += ' WHERE id = ?';
      updateValues.push(userId);
      
      // Execute update
      const [result] = await pool.query(updateQuery, updateValues);
      
      if (result.affectedRows > 0) {
        // Get the updated user
        const [updatedUser] = await pool.query(
          'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?',
          [userId]
        );
        
        res.json(updatedUser[0]);
      } else {
        res.status(500).json({ message: '사용자 업데이트 실패' });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    DELETE api/users/:id
// @desc     Delete a user
// @access   Private (Admin only)
router.delete('/:id', [auth, adminOnly], async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (userRows.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }
    
    // Don't allow deleting your own account
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ message: '자신의 계정은 삭제할 수 없습니다' });
    }
    
    // Execute delete
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    
    if (result.affectedRows > 0) {
      res.json({ message: '사용자가 삭제되었습니다' });
    } else {
      res.status(500).json({ message: '사용자 삭제 실패' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('서버 오류');
  }
});

module.exports = router; 