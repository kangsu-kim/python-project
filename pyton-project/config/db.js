const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const dbConfig = require('./dbConfig');

dotenv.config();

// 대용량 데이터 처리를 위한 최적화된 풀 설정
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 25, // 기존 10에서 25로 증가
  queueLimit: 0,
  connectTimeout: 60000, // 연결 시간 증가 (60초)
  namedPlaceholders: true, // 명명된 파라미터 지원
  // 대용량 쿼리 처리를 위한 설정
  maxPreparedStatements: 256, // 더 많은 준비된 문장 캐시
  // 대용량 패킷 처리를 위한 설정
  multipleStatements: true,
  // 타임아웃 설정
  acquireTimeout: 60000, // 연결 획득 타임아웃 (60초)
  // 서버 변수 설정
  dateStrings: true, // 날짜를 문자열로 반환
  // 연결 유지를 위한 설정
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10초마다 연결 유지
});

// 최대 패킷 크기 및 타임아웃 설정을 위한 초기화 쿼리
pool.on('connection', async (connection) => {
  try {
    // 트랜잭션 격리 수준 설정
    await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
    // 최대 패킷 크기 증가 (16MB → 64MB)
    await connection.query('SET GLOBAL max_allowed_packet = 67108864');
    // 쿼리 타임아웃 증가
    await connection.query('SET SESSION MAX_EXECUTION_TIME = 300000'); // 300초 (5분)
    // 그룹 연결 크기 증가
    await connection.query('SET SESSION group_concat_max_len = 1048576'); // 1MB
  } catch (error) {
    console.warn('DB 연결 설정 변경 중 오류 (무시됨):', error.message);
  }
});

// Function to initialize database and create tables if they don't exist
const initializeDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        role ENUM('admin', 'manager', 'driver', 'clerk') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create shipments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipment_number VARCHAR(50) NOT NULL UNIQUE,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        cargo_type VARCHAR(100) NOT NULL,
        weight DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'in_transit', 'delivered', 'cancelled') NOT NULL,
        assigned_driver INT,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_driver) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Create user_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (token),
        INDEX (user_id)
      )
    `);

    // Check if shipments_data table exists
    const [tables] = await pool.query('SHOW TABLES LIKE "shipments_data"');
    
    if (tables.length === 0) {
      console.log('shipments_data 테이블 생성 중...');
      
      // CREATE TABLE 쿼리 - 인덱스 추가로 대용량 데이터 처리 최적화
      await pool.query(`
        CREATE TABLE shipments_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          일시 VARCHAR(100),
          원청 VARCHAR(100),
          소속 VARCHAR(100),
          차량번호 VARCHAR(100),
          기사명 VARCHAR(100),
          연락처 VARCHAR(100),
          상차지 VARCHAR(100),
          하차지 VARCHAR(100),
          금액 VARCHAR(100),
          source_sheet VARCHAR(200),
          all_data JSON,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          isInvoiceLocked BOOLEAN DEFAULT NULL,
          invoiceMemo TEXT DEFAULT NULL,
          invoicePassword VARCHAR(100) DEFAULT NULL,
          INDEX idx_created_at (created_at),
          INDEX idx_created_by (created_by),
          INDEX idx_source_sheet (source_sheet),
          INDEX idx_일시 (일시),
          INDEX idx_원청 (원청),
          INDEX idx_기사명 (기사명)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      console.log('shipments_data 테이블이 생성되었습니다.');
    } else {
      console.log('shipments_data 테이블이 이미 존재합니다.');
      
      // 계산서 관련 필드 추가
      try {
        // 마이그레이션 스크립트 실행
        const migrationPath = path.join(__dirname, '../migrations/add_invoice_fields.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        // 세미콜론으로 구분된 각 SQL 문 실행
        const queries = migrationSql.split(';').filter(sql => sql.trim().length > 0);
        
        for (const sql of queries) {
          if (sql.trim()) {
            await pool.query(sql);
          }
        }
        
        console.log('계산서 관련 필드 마이그레이션 완료');
        
        // 인덱스 추가 여부 확인
        const [checkIndexes] = await pool.query(`
          SHOW INDEX FROM shipments_data
          WHERE Key_name LIKE 'idx_%';
        `);
        
        // 인덱스가 없으면 추가
        if (checkIndexes.length === 0) {
          console.log('대용량 처리를 위한 인덱스 추가 중...');
          await pool.query(`
            ALTER TABLE shipments_data
            ADD INDEX idx_created_at (created_at),
            ADD INDEX idx_created_by (created_by),
            ADD INDEX idx_source_sheet (source_sheet),
            ADD INDEX idx_일시 (일시),
            ADD INDEX idx_원청 (원청),
            ADD INDEX idx_기사명 (기사명);
          `);
          console.log('인덱스 추가 완료');
        }
      } catch (error) {
        // 이미 필드가 존재하는 경우 등 오류는 무시
        console.log('계산서 마이그레이션 참고:', error.message);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
};

// Check if admin account exists, create if it doesn't
const createAdminAccount = async () => {
  try {
    const bcrypt = require('bcryptjs');
    
    console.log('관리자 계정 확인 중...');
    
    // Check if admin account exists
    const [rows] = await pool.query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
    
    if (rows.length === 0) {
      // Create a default admin account
      const adminUsername = 'admin';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@cargo.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
      
      console.log(`관리자 계정 생성 시작: username=${adminUsername}, password=${adminPassword}`);
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      console.log('비밀번호 해시화 완료');
      
      // Insert admin user
      await pool.query(
        'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
        [adminUsername, hashedPassword, adminEmail, 'admin']
      );
      
      console.log('==== 관리자 계정 생성 완료 ====');
      console.log('Username: admin');
      console.log('Password: Admin@123456');
      console.log('================================');
    } else {
      console.log('관리자 계정이 이미 존재합니다:', rows[0].username);
      
      // 기존 관리자 비밀번호를 재설정 (문제 해결용)
      const adminPassword = 'Admin@123456';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      await pool.query(
        'UPDATE users SET password = ? WHERE username = ?',
        [hashedPassword, 'admin']
      );
      
      console.log('==== 관리자 비밀번호 재설정 완료 ====');
      console.log('Username: admin');
      console.log('Password: Admin@123456');
      console.log('====================================');
    }
  } catch (error) {
    console.error('관리자 계정 생성 오류:', error);
  }
};

module.exports = {
  pool,
  initializeDatabase,
  createAdminAccount
}; 