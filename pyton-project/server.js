const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const { initializeDatabase, createAdminAccount } = require('./config/db');

// Load environment variables
dotenv.config();

// 환경 변수 설정 - 없는 경우 기본값 제공
if (!process.env.DB_HOST) process.env.DB_HOST = 'localhost';
if (!process.env.DB_USER) process.env.DB_USER = 'root';
if (!process.env.DB_PASSWORD) process.env.DB_PASSWORD = '';
if (!process.env.DB_NAME) process.env.DB_NAME = 'cargo_transport';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'default_jwt_secret_for_cargo_app';
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = 'Admin@123456';
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'admin@cargo.com';

// Create Express app
const app = express();

// Enable trust proxy
app.set('trust proxy', 1);

// Enable cookie parser
app.use(cookieParser());

// Configure CORS
app.use(cors({
  origin: true, // 모든 오리진 허용
  credentials: true,
  exposedHeaders: ['x-auth-token']
}));

// Basic security with Helmet
app.use(helmet({
  contentSecurityPolicy: false // 개발 중 비활성화
}));

// Enable parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiting to prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 한도를 100에서 1000으로 늘림
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/auth/login', limiter); // /api/auth 전체가 아닌 로그인 API만 제한

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/sheets', require('./routes/sheets'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Server Error', error: process.env.NODE_ENV === 'production' ? null : err.message });
});

// Set up port
const PORT = 5001;

// 서버 시작 시 실행될 코드
const startServer = async () => {
  try {
    await initializeDatabase();
    await createAdminAccount();
    
    app.listen(PORT, () => {
      console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
    });
  } catch (err) {
    console.error('서버 시작 오류:', err.message);
    process.exit(1);
  }
};

startServer(); 