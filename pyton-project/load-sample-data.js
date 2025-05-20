// 샘플 데이터 로드 스크립트
const { pool } = require('./config/db');

const sampleData = [
  {
    일시: '230101',
    원청: '신성통운',
    소속: '직영',
    차량번호: '12가1234',
    기사명: '홍길동',
    연락처: '010-1234-5678',
    상차지: '서울 마포구',
    하차지: '부산 해운대구',
    금액: '300000'
  },
  {
    일시: '230102',
    원청: '신성통운',
    소속: '직영',
    차량번호: '34나5678',
    기사명: '김철수',
    연락처: '010-2345-6789',
    상차지: '인천 계양구',
    하차지: '대구 수성구',
    금액: '250000'
  },
  {
    일시: '230103',
    원청: '신성통운',
    소속: '직영',
    차량번호: '56다9012',
    기사명: '이영희',
    연락처: '010-3456-7890',
    상차지: '광주 서구',
    하차지: '대전 유성구',
    금액: '200000'
  }
];

async function loadSampleData() {
  try {
    console.log('샘플 데이터 로드 시작...');
    
    // 관리자 ID 가져오기 (기본값 1로 설정)
    const [adminRows] = await pool.query(
      "SELECT id FROM users WHERE username = 'admin'"
    );
    const adminId = adminRows.length > 0 ? adminRows[0].id : 1;
    
    console.log(`관리자 ID: ${adminId}`);
    
    // 데이터 삽입
    for (const item of sampleData) {
      const allData = JSON.stringify(item);
      
      await pool.query(
        `INSERT INTO shipments_data 
         (일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
          source_sheet, all_data, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.일시,
          item.원청,
          item.소속,
          item.차량번호,
          item.기사명,
          item.연락처,
          item.상차지,
          item.하차지,
          item.금액,
          '샘플 데이터',
          allData,
          adminId
        ]
      );
    }
    
    console.log(`${sampleData.length}개의 샘플 데이터가 추가되었습니다.`);
    console.log('샘플 데이터 로드가 완료되었습니다.');
    process.exit(0);
  } catch (error) {
    console.error('샘플 데이터 로드 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
loadSampleData(); 