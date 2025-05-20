// 데이터베이스 상태 확인 스크립트
const { pool } = require('./config/db');

async function checkDatabase() {
  try {
    console.log('데이터베이스 상태 확인 중...');
    
    // shipments_data 테이블의 데이터 개수 확인
    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM shipments_data');
    console.log(`shipments_data 테이블 데이터 개수: ${countResult[0].total}개`);
    
    // sheet_data 테이블의 데이터 개수 확인
    const [sheetCountResult] = await pool.query('SELECT COUNT(*) as total FROM sheet_data');
    console.log(`sheet_data 테이블 데이터 개수: ${sheetCountResult[0].total}개`);
    
    // 최근 추가된 데이터 샘플 확인
    const [recentData] = await pool.query('SELECT * FROM shipments_data ORDER BY id DESC LIMIT 5');
    console.log('\n최근 추가된 5개 데이터:');
    recentData.forEach((row, index) => {
      console.log(`\n[데이터 ${index + 1}]`);
      console.log(`ID: ${row.id}`);
      console.log(`일시: ${row.일시}`);
      console.log(`원청: ${row.원청}`);
      console.log(`기사명: ${row.기사명}`);
      console.log(`차량번호: ${row.차량번호}`);
      console.log(`상차지: ${row.상차지}`);
      console.log(`하차지: ${row.하차지}`);
      console.log(`금액: ${row.금액}`);
      
      // JSON 데이터 파싱
      try {
        const allData = typeof row.all_data === 'string' 
          ? JSON.parse(row.all_data) 
          : row.all_data;
        console.log('추가 정보:', JSON.stringify(allData, null, 2));
      } catch (error) {
        console.log('추가 정보: 파싱 오류');
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('데이터베이스 확인 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
checkDatabase(); 