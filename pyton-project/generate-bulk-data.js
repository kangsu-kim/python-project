// 대량 데이터 생성 및 로드 스크립트
const { pool } = require('./config/db');

// 랜덤 데이터 생성을 위한 배열들
const companies = ['신성통운', '대한물류', '로지스틱스코리아', '한국택배', '글로벌물류', '사람인물류', '통합물류센터'];
const affiliations = ['직영', '협력사', '프리랜서', '계약직', '정규직'];
const carNumbers = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종'];
const firstNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
const lastNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '서연', '서현', '민서', '하은', '하윤', '윤서', '지민', '지우', '서진', '수빈'];
const phonePrefix = ['010', '011', '016', '017', '018', '019'];
const cities = ['서울', '부산', '인천', '대구', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const districts = ['중구', '동구', '서구', '남구', '북구', '강남구', '강서구', '강동구', '강북구', '중랑구', '관악구', '구로구', '마포구', '용산구', '송파구'];

// 무작위 항목 선택 함수
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 무작위 날짜 생성 함수 (YYMMDD 형식)
function getRandomDate() {
  const year = 22 + Math.floor(Math.random() * 3); // 22-24년
  const month = 1 + Math.floor(Math.random() * 12); // 1-12월
  const day = 1 + Math.floor(Math.random() * 28); // 1-28일
  
  return `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
}

// 무작위 전화번호 생성 함수
function getRandomPhone() {
  const prefix = getRandomItem(phonePrefix);
  const middle = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  
  return `${prefix}-${middle}-${suffix}`;
}

// 무작위 차량번호 생성 함수
function getRandomCarNumber() {
  const region = getRandomItem(carNumbers);
  const firstDigit = Math.floor(1 + Math.random() * 9);
  const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
  const lastNumber = Math.floor(1000 + Math.random() * 9000);
  
  return `${region}${firstDigit}${letter}${lastNumber}`;
}

// 무작위 금액 생성 함수
function getRandomAmount() {
  // 10만원에서 100만원 사이
  return (Math.floor(10 + Math.random() * 90) * 10000).toString();
}

// 데이터 생성 함수 - 메모리 효율을 위해 제너레이터 패턴 사용
function* generateData(count) {
  for (let i = 0; i < count; i++) {
    yield {
      일시: getRandomDate(),
      원청: getRandomItem(companies),
      소속: getRandomItem(affiliations),
      차량번호: getRandomCarNumber(),
      기사명: `${getRandomItem(firstNames)}${getRandomItem(lastNames)}`,
      연락처: getRandomPhone(),
      상차지: `${getRandomItem(cities)} ${getRandomItem(districts)}`,
      하차지: `${getRandomItem(cities)} ${getRandomItem(districts)}`,
      금액: getRandomAmount()
    };
  }
}

// 최적화된 배치 삽입 함수
async function executeOptimizedBatchInsert(batch, adminId) {
  // 배치 삽입용 쿼리와 값 배열 준비
  const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
  const values = [];
  
  batch.forEach(item => {
    const allData = JSON.stringify(item);
    
    values.push(
      item.일시,
      item.원청,
      item.소속,
      item.차량번호,
      item.기사명,
      item.연락처,
      item.상차지,
      item.하차지,
      item.금액,
      '대량 생성 데이터',
      allData,
      adminId
    );
  });
  
  const sql = `
    INSERT INTO shipments_data 
    (일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
     source_sheet, all_data, created_by)
    VALUES ${placeholders}
  `;
  
  return pool.query(sql, values);
}

async function loadBulkData(count) {
  try {
    console.log(`${count}개의 대량 데이터 생성 및 로드 시작...`);
    const startTime = Date.now();
    
    // 관리자 ID 가져오기 (기본값 1로 설정)
    const [adminRows] = await pool.query(
      "SELECT id FROM users WHERE username = 'admin'"
    );
    const adminId = adminRows.length > 0 ? adminRows[0].id : 1;
    
    console.log(`관리자 ID: ${adminId}`);
    
    // 배치 처리를 위한 변수
    const batchSize = 1000; // 배치 크기 증가 (기존 100 → 1000)
    let inserted = 0;
    let batches = [];
    let currentBatch = [];
    
    // 트랜잭션 시작
    await pool.query('START TRANSACTION');
    
    // 메모리 관리를 위해 데이터 생성기(generator) 사용
    const dataGenerator = generateData(count);
    
    console.log(`배치 크기: ${batchSize}개 단위로 처리`);
    
    // 병렬 처리를 위한 프로미스 배열
    const batchPromises = [];
    const PARALLEL_BATCH_LIMIT = 5; // 병렬 처리할 최대 배치 수
    
    for (let i = 0; i < count; i++) {
      const item = dataGenerator.next().value;
      currentBatch.push(item);
      
      if (currentBatch.length === batchSize) {
        // 배치가 가득 차면 실행할 배치 큐에 추가
        batches.push([...currentBatch]);
        currentBatch = [];
        
        // 병렬 처리 로직
        while (batches.length > 0 && batchPromises.length < PARALLEL_BATCH_LIMIT) {
          const batchToProcess = batches.shift();
          const batchPromise = executeOptimizedBatchInsert(batchToProcess, adminId)
            .then(() => {
              inserted += batchToProcess.length;
              const progress = Math.round(inserted/count*100);
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              const remaining = inserted > 0 
                ? ((count - inserted) * (Date.now() - startTime) / inserted / 1000).toFixed(1)
                : "계산 중";
                
              console.log(`진행 중: ${inserted}/${count} (${progress}%) - 경과 시간: ${elapsed}초, 예상 남은 시간: ${remaining}초`);
              
              // 프로미스 배열에서 완료된 프로미스 제거
              const index = batchPromises.indexOf(batchPromise);
              if (index > -1) {
                batchPromises.splice(index, 1);
              }
            });
          
          batchPromises.push(batchPromise);
        }
        
        // 병렬 처리 제한에 도달하면 하나의 배치가 완료될 때까지 대기
        if (batchPromises.length >= PARALLEL_BATCH_LIMIT && batches.length > 0) {
          await Promise.race(batchPromises);
        }
      }
      
      // 메모리 사용량 모니터링 (10만 건마다)
      if (i > 0 && i % 100000 === 0) {
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`메모리 사용량: ${Math.round(usedMemory * 100) / 100} MB`);
      }
    }
    
    // 마지막 배치 처리
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    // 남은 모든 배치 병렬 처리
    while (batches.length > 0) {
      const availableSlots = PARALLEL_BATCH_LIMIT - batchPromises.length;
      const batchesToProcess = batches.splice(0, availableSlots);
      
      const newPromises = batchesToProcess.map(batch => 
        executeOptimizedBatchInsert(batch, adminId)
          .then(() => {
            inserted += batch.length;
            const progress = Math.round(inserted/count*100);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const remaining = inserted > 0 
              ? ((count - inserted) * (Date.now() - startTime) / inserted / 1000).toFixed(1) 
              : "계산 중";
              
            console.log(`진행 중: ${inserted}/${count} (${progress}%) - 경과 시간: ${elapsed}초, 예상 남은 시간: ${remaining}초`);
          })
      );
      
      batchPromises.push(...newPromises);
      
      if (batches.length > 0) {
        await Promise.race(batchPromises);
        // 완료된 프로미스 제거
        for (let i = batchPromises.length - 1; i >= 0; i--) {
          if (batchPromises[i].status === 'fulfilled') {
            batchPromises.splice(i, 1);
          }
        }
      }
    }
    
    // 모든 배치 처리가 완료될 때까지 대기
    await Promise.all(batchPromises);
    
    // 트랜잭션 커밋
    await pool.query('COMMIT');
    
    const totalTime = (Date.now() - startTime) / 1000;
    const insertRate = Math.round(count / totalTime);
    
    console.log(`${count}개의 대량 데이터가 추가되었습니다.`);
    console.log(`총 소요 시간: ${totalTime.toFixed(2)}초 (초당 ${insertRate}개 처리)`);
    console.log('대량 데이터 로드가 완료되었습니다.');
    process.exit(0);
  } catch (error) {
    // 오류 발생 시 롤백
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('롤백 중 오류 발생:', rollbackError);
    }
    
    console.error('대량 데이터 로드 중 오류 발생:', error);
    process.exit(1);
  }
}

// 명령줄 인수로 데이터 개수 받기 (기본값: 2000개, 하루 처리량에 맞춤)
const count = parseInt(process.argv[2]) || 2000;

// 스크립트 실행
loadBulkData(count); 