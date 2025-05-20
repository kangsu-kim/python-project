const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const auth = require('../middleware/auth').auth;

// JWT Secret & Expiry
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_for_cargo_app';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d'; // 7일로 연장

// @route    POST api/auth/login
// @desc     Login user & get token
// @access   Public
router.post(
  '/login',
  [
    check('username', '사용자명을 입력해주세요').not().isEmpty(),
    check('password', '비밀번호를 입력해주세요').exists()
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      console.log(`로그인 시도: username=${username}`);
      
      // Check if user exists
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );

      if (rows.length === 0) {
        console.log(`사용자 없음: ${username}`);
        return res.status(400).json({ message: '잘못된 로그인 정보입니다' });
      }

      const user = rows[0];
      console.log(`사용자 찾음: ${user.username}, 역할: ${user.role}`);

      // Check password
      console.log(`비밀번호 비교 시작: DB값=${user.password.substring(0, 10)}...`);
      const isMatch = await bcrypt.compare(password, user.password);

      console.log(`비밀번호 일치 여부: ${isMatch}`);
      if (!isMatch) {
        return res.status(400).json({ message: '잘못된 로그인 정보입니다' });
      }

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          role: user.role
        }
      };

      console.log('JWT 토큰 생성 중...');
      // Sign token
      jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE },
        async (err, token) => {
          if (err) {
            console.error('JWT 토큰 생성 오류:', err);
            throw err;
          }
          
          console.log('JWT 토큰 생성 성공, 만료 시간:', JWT_EXPIRE);
          
          // 사용자 세션 정보를 DB에 저장
          try {
            // 이전 토큰 정보가 있다면 삭제
            await pool.query(
              'DELETE FROM user_sessions WHERE user_id = ?',
              [user.id]
            );
            
            // 새 토큰 정보 저장
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7); // 7일 후
            
            await pool.query(
              'INSERT INTO user_sessions (user_id, token, expires_at, last_activity) VALUES (?, ?, ?, NOW())',
              [user.id, token, expiryDate]
            );
            
            console.log(`사용자 ID ${user.id}의 세션 정보가 DB에 저장됨`);
          } catch (dbError) {
            console.error('세션 정보 저장 오류:', dbError);
            // 오류가 있어도 로그인은 계속 진행
          }
          
          // 쿠키에 토큰 저장 (httpOnly로 설정하여 JS에서 접근 불가)
          res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          });
        }
      );
    } catch (err) {
      console.error('로그인 오류:', err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    GET api/auth/me
// @desc     Get current user
// @access   Private
router.get('/me', auth, async (req, res) => {
  try {
    console.log('현재 사용자 정보 요청:', req.user.username);
    
    // 세션 활동 시간 업데이트
    try {
      await pool.query(
        'UPDATE user_sessions SET last_activity = NOW() WHERE user_id = ?',
        [req.user.id]
      );
    } catch (dbError) {
      console.error('세션 활동 시간 업데이트 오류:', dbError);
      // 오류가 있어도 사용자 정보는 반환
    }
    
    res.json(req.user);
  } catch (err) {
    console.error('사용자 정보 요청 오류:', err.message);
    res.status(500).send('서버 오류');
  }
});

// @route    GET api/auth/logout
// @desc     Logout user, clear token
// @access   Public
router.get('/logout', auth, async (req, res) => {
  try {
    // DB에서 세션 정보 삭제
    if (req.user && req.user.id) {
      await pool.query(
        'DELETE FROM user_sessions WHERE user_id = ?',
        [req.user.id]
      );
      console.log(`사용자 ID ${req.user.id}의 세션 정보가 DB에서 삭제됨`);
    }
    
    // 쿠키 삭제
    res.clearCookie('token');
    res.json({ success: true, message: '로그아웃 성공' });
  } catch (err) {
    console.error('로그아웃 오류:', err.message);
    // 오류가 있어도 클라이언트 쿠키는 삭제
    res.clearCookie('token');
    res.json({ success: true, message: '로그아웃 성공' });
  }
});

// @route    GET api/auth/check-token
// @desc     Check if token is valid (for client side validation)
// @access   Public
router.get('/check-token', async (req, res) => {
  try {
    const token = req.cookies.token || req.header('x-auth-token');
    
    if (!token) {
      return res.json({ valid: false });
    }
    
    // DB에서 토큰 확인
    const [sessions] = await pool.query(
      'SELECT * FROM user_sessions WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    
    if (sessions.length === 0) {
      return res.json({ valid: false });
    }
    
    // 토큰 유효성 확인
    try {
      jwt.verify(token, JWT_SECRET);
      return res.json({ valid: true });
    } catch (err) {
      return res.json({ valid: false });
    }
  } catch (err) {
    console.error('토큰 확인 오류:', err.message);
    return res.json({ valid: false });
  }
});

// @route    GET api/auth/check-session
// @desc     Heartbeat endpoint to check session status and update last activity
// @access   Private
router.get('/check-session', auth, async (req, res) => {
  try {
    console.log('세션 활성 상태 확인:', req.user.username);
    
    // 세션 활동 시간 업데이트
    await pool.query(
      'UPDATE user_sessions SET last_activity = NOW() WHERE user_id = ?',
      [req.user.id]
    );
    
    console.log(`사용자 ID ${req.user.id}의 세션 활동 시간이 업데이트됨`);
    
    // 브라우저 탭 종료 여부 확인 (클라이언트에서 처리됨)
    res.json({ active: true });
  } catch (err) {
    console.error('세션 확인 오류:', err.message);
    res.status(500).send('서버 오류');
  }
});

module.exports = router; 