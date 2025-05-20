const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_for_cargo_app';

// Middleware for JWT authentication
const auth = async (req, res, next) => {
  // Get token from header or cookie
  const token = req.header('x-auth-token') || (req.cookies && req.cookies.token);
  
  console.log('인증 미들웨어 실행, 토큰 확인:', token ? '토큰 있음' : '토큰 없음');

  // Check if no token
  if (!token) {
    console.log('토큰 없음, 401 응답');
    return res.status(401).json({ message: '인증 토큰이 없습니다. 접근이 거부되었습니다.' });
  }

  try {
    // 데이터베이스에서 토큰 유효성 검증
    console.log('데이터베이스에서 토큰 세션 확인 중...');
    const [sessions] = await pool.query(
      'SELECT * FROM user_sessions WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    
    if (sessions.length === 0) {
      console.log('DB에서 유효한 세션을 찾을 수 없음');
      return res.status(401).json({ message: '세션이 만료되었습니다. 다시 로그인해주세요.' });
    }
    
    // JWT 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('토큰 검증 성공, 사용자 ID:', decoded.user.id);
    
    // 세션의 사용자 ID와 토큰의 사용자 ID가 일치하는지 확인
    if (sessions[0].user_id !== decoded.user.id) {
      console.log('토큰과 세션의 사용자 ID 불일치');
      return res.status(401).json({ message: '유효하지 않은 세션입니다.' });
    }
    
    // 사용자 정보 가져오기
    const [rows] = await pool.query('SELECT id, username, email, role FROM users WHERE id = ?', [decoded.user.id]);
    
    if (rows.length === 0) {
      console.log('유효한 토큰이지만 사용자를 찾을 수 없음');
      return res.status(401).json({ message: '유효하지 않은 토큰입니다' });
    }
    
    // 세션 활동 시간 업데이트
    await pool.query(
      'UPDATE user_sessions SET last_activity = NOW() WHERE token = ?',
      [token]
    );
    
    // Add user to request object
    req.user = rows[0];
    console.log('사용자 인증 성공:', rows[0].username);
    next();
  } catch (err) {
    console.error('토큰 검증 오류:', err.message);
    // 오류 유형에 따라 다른 메시지 반환
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '유효하지 않은 토큰 형식입니다.' });
    }
    res.status(401).json({ message: '유효하지 않은 토큰입니다' });
  }
};

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다' });
  }
  next();
};

// Middleware to check if user is admin or manager
const managerAndAbove = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: '관리자 또는 매니저 권한이 필요합니다' });
  }
  next();
};

module.exports = {
  auth,
  adminOnly,
  managerAndAbove
}; 