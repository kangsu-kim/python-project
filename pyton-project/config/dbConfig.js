// 데이터베이스 설정 정보
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cargo_transport',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

module.exports = dbConfig; 