// 데이터베이스 초기화 스크립트
const { pool } = require('./config/db');

async function resetDatabase() {
  try {
    console.log('데이터베이스 초기화 시작...');
    
    // shipments_data 테이블의 모든 데이터 삭제
    await pool.query('DELETE FROM shipments_data');
    console.log('shipments_data 테이블 데이터 삭제 완료');
    
    // sheet_data 테이블의 모든 데이터 삭제
    await pool.query('DELETE FROM sheet_data');
    console.log('sheet_data 테이블 데이터 삭제 완료');
    
    // AUTO_INCREMENT 값 리셋
    await pool.query('ALTER TABLE shipments_data AUTO_INCREMENT = 1');
    await pool.query('ALTER TABLE sheet_data AUTO_INCREMENT = 1');
    console.log('AUTO_INCREMENT 값 리셋 완료');
    
    console.log('데이터베이스 초기화가 완료되었습니다.');
    process.exit(0);
  } catch (error) {
    console.error('데이터베이스 초기화 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
resetDatabase(); 