const express = require('express');
const router = express.Router();
const { getSheetData, extractSheetId, extractGid } = require('../config/google/sheets');
const { auth, managerAndAbove } = require('../middleware/auth');
const { pool } = require('../config/db');

/**
 * @route   POST /api/sheets/load
 * @desc    구글 시트에서 데이터 불러오기
 * @access  Private
 */
router.post('/load', [auth, managerAndAbove], async (req, res) => {
  try {
    console.log('[POST /api/sheets/load] 시트 로드 요청 받음:', req.body);
    const { url, sessionId } = req.body;

    if (!url) {
      console.log('[POST /api/sheets/load] URL이 제공되지 않음');
      return res.status(400).json({ message: '구글 시트 URL이 필요합니다.' });
    }

    // 세션 ID가 제공된 경우 해당 세션의 저장된 데이터를 먼저 확인
    if (sessionId) {
      try {
        // 이전에 저장된 세션 데이터가 있는지 확인
        const [sessionRows] = await pool.query(
          `SELECT * FROM sheet_sessions WHERE session_id = ? AND user_id = ? LIMIT 1`,
          [sessionId, req.user.id]
        );

        if (sessionRows.length > 0) {
          console.log(`[POST /api/sheets/load] 세션 ID ${sessionId}에 대한 저장된 데이터 발견`);
          
          // 저장된 시트 데이터 조회
          const [dataRows] = await pool.query(
            `SELECT * FROM shipments_data WHERE session_id = ? ORDER BY id ASC`,
            [sessionId]
          );

          if (dataRows.length > 0) {
            console.log(`[POST /api/sheets/load] 세션에 저장된 ${dataRows.length}개의 데이터 항목 발견`);
            
            const sheetTitle = sessionRows[0].sheet_title;
            const headers = JSON.parse(sessionRows[0].headers);
            
            // 데이터 행을 객체 형식으로 변환
            const formattedRows = dataRows.map(row => {
              try {
                return typeof row.all_data === 'string' 
                  ? JSON.parse(row.all_data) 
                  : row.all_data;
              } catch (e) {
                console.error(`[POST /api/sheets/load] JSON 파싱 오류 (${row.id}):`, e);
                return {};
              }
            });
            
            return res.status(200).json({
              sheets: [{
                sheetTitle,
                headers,
                rows: formattedRows,
                sessionId
              }],
              source: 'database'
            });
          }
        }
      } catch (error) {
        // 세션 데이터 로드 오류는 무시하고 원본 시트 데이터 로드 계속 진행
        console.error('[POST /api/sheets/load] 세션 데이터 로드 오류:', error);
      }
    }

    if (url.toLowerCase() === 'test' || url.toLowerCase() === 'sample') {
      console.log('[POST /api/sheets/load] 테스트 또는 샘플 데이터 요청 감지');

      // 고유한 세션 ID 생성
      const newSessionId = generateSessionId();

      const sampleSheet = {
        sheetTitle: '샘플 데이터',
        headers: ['일시', '원청', '차량번호', '기사명', '상차지', '하차지', '금액'],
        rows: [
          { '일시': '2023-09-15', '원청': '신성통운', '차량번호': '12가1234', '기사명': '홍길동', '상차지': '서울', '하차지': '부산', '금액': '300000' },
          { '일시': '2023-09-16', '원청': '신성통운', '차량번호': '54나5678', '기사명': '김철수', '상차지': '인천', '하차지': '광주', '금액': '250000' },
          { '일시': '2023-09-17', '원청': '신성통운', '차량번호': '33다9876', '기사명': '이영희', '상차지': '대전', '하차지': '대구', '금액': '200000' }
        ],
        sessionId: newSessionId
      };

      // 샘플 데이터도 데이터베이스에 저장
      try {
        await saveSheetDataToDatabase(sampleSheet.rows, sampleSheet.headers, sampleSheet.sheetTitle, req.user.id, newSessionId);
      } catch (error) {
        console.error('[POST /api/sheets/load] 샘플 데이터 저장 오류:', error);
        // 샘플 데이터 저장 실패는 무시하고 진행
      }

      return res.status(200).json({ 
        sheets: [sampleSheet],
        source: 'sample'
      });
    }

    try {
      console.log('[POST /api/sheets/load] 구글 시트 ID 추출 중:', url);
      const spreadsheetId = extractSheetId(url);
      const gid = extractGid(url);
      const sheetName = null;

      console.log(`[POST /api/sheets/load] 추출된 시트 ID: ${spreadsheetId}, GID: ${gid || 'default'}`);
      const allSheetsData = await getSheetData(spreadsheetId, sheetName, gid);
      console.log('[POST /api/sheets/load] 시트 데이터 가져오기 완료');

      if (!allSheetsData || allSheetsData.length === 0) {
        console.error('[POST /api/sheets/load] 시트에서 데이터를 찾을 수 없음');
        return res.status(400).json({ message: '시트에서 데이터를 찾을 수 없습니다.' });
      }

      const sheetData = allSheetsData[0];
      const { sheetTitle, data } = sheetData;

      console.log(`[POST /api/sheets/load] 시트 제목: ${sheetTitle}, 데이터 행 수: ${data ? data.length : 0}`);
      
      if (!data || !data.length) {
        console.error('[POST /api/sheets/load] 시트에 데이터가 없음');
        return res.status(400).json({ message: '시트에 데이터가 없습니다.' });
      }

      const headers = data[0];
      const rows = data.slice(1);

      console.log('[POST /api/sheets/load] 원본 헤더:', headers);
      
      // 빈 행을 제거
      const filteredRows = rows.filter(row => row.some(cell => cell && cell.trim() !== ''));
      console.log(`[POST /api/sheets/load] 빈 행 제거 후 ${filteredRows.length}개 행 남음`);
      
      // 행 데이터를 객체로 변환
      const formattedRows = filteredRows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          // 빈 헤더나 undefined 헤더는 무시
          if (header && header.trim() !== '') {
            obj[header] = row[index] || '';
          }
        });
        return obj;
      });

      console.log(`[POST /api/sheets/load] 총 ${formattedRows.length}개의 데이터 행 처리 완료`);

      // 새 세션 ID 생성
      const newSessionId = sessionId || generateSessionId();
      console.log(`[POST /api/sheets/load] 세션 ID 생성/사용: ${newSessionId}`);

      // 시트 데이터를 DB에 저장
      console.log('[POST /api/sheets/load] 데이터 저장 시작...');
      const saveSuccess = await saveSheetDataToDatabase(formattedRows, headers, sheetTitle, req.user.id, newSessionId);
      
      if (saveSuccess) {
        console.log('[POST /api/sheets/load] 시트 데이터가 데이터베이스에 저장되었습니다');
      } else {
        console.error('[POST /api/sheets/load] 데이터베이스 저장 실패');
        return res.status(500).json({ message: '데이터베이스 저장 중 오류가 발생했습니다.' });
      }

      // 클라이언트에 결과 반환
      return res.status(200).json({
        sheets: [{
          sheetTitle,
          headers,
          rows: formattedRows,
          sessionId: newSessionId
        }],
        source: 'google_sheet'
      });
    } catch (err) {
      console.error('[POST /api/sheets/load] 시트 처리 오류:', err);
      return res.status(500).json({ message: `시트 처리 중 오류가 발생했습니다: ${err.message}` });
    }
  } catch (error) {
    console.error('[POST /api/sheets/load] 시트 불러오기 오류:', error);
    return res.status(500).json({ message: `서버 오류: ${error.message}` });
  }
});

/**
 * @route   GET /api/sheets/sessions
 * @desc    사용자의 저장된 시트 세션 목록 가져오기
 * @access  Private
 */
router.get('/sessions', auth, async (req, res) => {
  try {
    // 사용자의 세션 목록 가져오기
    const [sessions] = await pool.query(
      `SELECT 
        s.session_id, 
        s.sheet_title, 
        s.created_at, 
        s.updated_at,
        (SELECT COUNT(*) FROM shipments_data WHERE session_id = s.session_id) as item_count
      FROM sheet_sessions s
      WHERE s.user_id = ?
      ORDER BY s.updated_at DESC`,
      [req.user.id]
    );

    return res.json(sessions);
  } catch (error) {
    console.error('[GET /api/sheets/sessions] 세션 목록 조회 오류:', error);
    return res.status(500).json({ message: '세션 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

/**
 * @route   DELETE /api/sheets/sessions/:sessionId
 * @desc    저장된 시트 세션 삭제
 * @access  Private
 */
router.delete('/sessions/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // 세션이 사용자의 것인지 확인
    const [checkSession] = await pool.query(
      `SELECT * FROM sheet_sessions WHERE session_id = ? AND user_id = ?`,
      [sessionId, req.user.id]
    );
    
    if (checkSession.length === 0) {
      return res.status(404).json({ message: '세션을 찾을 수 없거나 접근 권한이 없습니다.' });
    }
    
    // 트랜잭션 시작
    await pool.query('START TRANSACTION');
    
    try {
      // 세션에 연결된 데이터 삭제
      await pool.query(
        `DELETE FROM shipments_data WHERE session_id = ?`,
        [sessionId]
      );
      
      // 세션 기록 삭제
      await pool.query(
        `DELETE FROM sheet_sessions WHERE session_id = ?`,
        [sessionId]
      );
      
      // 트랜잭션 커밋
      await pool.query('COMMIT');
      
      return res.json({ message: '세션이 성공적으로 삭제되었습니다.' });
    } catch (error) {
      // 오류 발생 시 롤백
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('[DELETE /api/sheets/sessions] 세션 삭제 오류:', error);
    return res.status(500).json({ message: '세션 삭제 중 오류가 발생했습니다.' });
  }
});

/**
 * 고유 세션 ID 생성 함수
 */
function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

/**
 * 배치 삽입을 실행하는 함수
 * @param {Array} rows 삽입할 데이터 배열
 * @param {string} sheetTitle 시트 이름
 * @param {number} userId 사용자 ID
 * @param {string} sessionId 세션 ID
 * @returns {Promise}
 */
async function executeBatchInsert(rows, sheetTitle, userId, sessionId) {
  if (rows.length === 0) return Promise.resolve();
  
  // 배치 삽입용 쿼리와 값 배열 준비
  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
  const values = [];
  
  rows.forEach(row => {
    values.push(
      row['일시'] || null,
      row['원청'] || null,
      row['소속'] || null,
      row['차량번호'] || null,
      row['기사명'] || null,
      row['연락처'] || null,
      row['상차지'] || null,
      row['하차지'] || null,
      row['금액'] || null,
      sheetTitle,
      JSON.stringify(row),
      userId,
      sessionId
    );
  });
  
  const sql = `
    INSERT INTO shipments_data (
      일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
      source_sheet, all_data, created_by, session_id
    ) VALUES ${placeholders}
  `;
  
  return pool.query(sql, values);
}

/**
 * 시트 데이터를 데이터베이스에 저장하는 함수
 */
async function saveSheetDataToDatabase(rows, headers, sheetTitle, userId, sessionId) {
  // 제외할 필드 목록
  const excludedFields = ['청구계', '지급계', '수수료율퍼센트', '수수료', '위탁수수료', '수익', '실공급액', '부가세', '합계'];
  
  try {
    console.log(`[saveSheetDataToDatabase] 시작: ${rows.length}개 행 처리 시작, 세션 ID: ${sessionId}`);
    const startTime = Date.now();
    
    // 1. sheet_sessions 테이블 확인 및 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sheet_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        sheet_title VARCHAR(255) NOT NULL,
        headers JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX (session_id),
        INDEX (user_id)
      )
    `);
    
    // 2. shipments_data 테이블에 session_id 칼럼이 없으면 추가
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'shipments_data' AND COLUMN_NAME = 'session_id'
      `, [process.env.DB_NAME]);
      
      if (columns.length === 0) {
        console.log('[saveSheetDataToDatabase] shipments_data 테이블에 session_id 칼럼 추가');
        await pool.query(`
          ALTER TABLE shipments_data 
          ADD COLUMN session_id VARCHAR(100), 
          ADD INDEX idx_session_id (session_id)
        `);
      }
    } catch (error) {
      console.error('[saveSheetDataToDatabase] 칼럼 확인 오류:', error);
      // 계속 진행
    }

    // 3. 시트 데이터 테이블 확인
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sheet_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_sheet VARCHAR(255) NOT NULL,
        data_json JSON NOT NULL,
        headers JSON NOT NULL,
        created_by INT NOT NULL,
        session_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX (session_id)
      )
    `);

    // 4. shipments 테이블 확인
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipments_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        일시 VARCHAR(100),
        원청 VARCHAR(100),
        소속 VARCHAR(100),
        차량번호 VARCHAR(100),
        기사명 VARCHAR(100),
        연락처 VARCHAR(100),
        상차지 VARCHAR(255),
        하차지 VARCHAR(255),
        금액 VARCHAR(100),
        source_sheet VARCHAR(100),
        all_data JSON,
        created_by INT NOT NULL,
        session_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        isInvoiceLocked BOOLEAN DEFAULT FALSE,
        invoiceMemo TEXT,
        invoicePassword VARCHAR(100),
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX (session_id)
      )
    `);

    // 5. 트랜잭션 시작
    await pool.query('START TRANSACTION');
    console.log('[saveSheetDataToDatabase] 트랜잭션 시작');

    // 6. 기존 세션 데이터가 있으면 삭제
    if (sessionId) {
      // 먼저 세션이 존재하는지 확인
      const [existingSession] = await pool.query(
        `SELECT * FROM sheet_sessions WHERE session_id = ?`,
        [sessionId]
      );
      
      if (existingSession.length > 0) {
        console.log(`[saveSheetDataToDatabase] 기존 세션 ID ${sessionId} 발견, 데이터 교체 수행`);
        
        // 기존 세션의 데이터 삭제
        await pool.query(
          `DELETE FROM shipments_data WHERE session_id = ?`,
          [sessionId]
        );
        
        // 세션 정보 업데이트
        await pool.query(
          `UPDATE sheet_sessions 
           SET sheet_title = ?, headers = ?, updated_at = NOW() 
           WHERE session_id = ?`,
          [sheetTitle, JSON.stringify(headers), sessionId]
        );
      } else {
        // 새 세션 저장
        await pool.query(
          `INSERT INTO sheet_sessions (session_id, user_id, sheet_title, headers)
           VALUES (?, ?, ?, ?)`,
          [sessionId, userId, sheetTitle, JSON.stringify(headers)]
        );
        
        console.log(`[saveSheetDataToDatabase] 새 세션 생성: ID ${sessionId}`);
      }
    } else {
      // 세션 ID가 없는 경우는 오류
      throw new Error('세션 ID가 제공되지 않았습니다.');
    }

    // 7. 제외 필드 삭제된 데이터를 준비
    const filteredRows = rows.map(row => {
      const filteredRow = { ...row };
      excludedFields.forEach(field => {
        delete filteredRow[field];
      });
      return filteredRow;
    });

    console.log(`[saveSheetDataToDatabase] 제외된 필드: ${excludedFields.join(', ')}`);
    console.log(`[saveSheetDataToDatabase] 필터링 후 데이터 행 수: ${filteredRows.length}개`);
    
    // 8. 데이터 행 개수 확인
    if (filteredRows.length === 0) {
      console.warn('[saveSheetDataToDatabase] 필터링 후 저장할 데이터가 없습니다.');
      await pool.query('ROLLBACK');
      return false;
    }

    // 9. 원본 시트 데이터를 JSON으로 저장
    const [sheetResult] = await pool.query(
      'INSERT INTO sheet_data (source_sheet, data_json, headers, created_by, session_id) VALUES (?, ?, ?, ?, ?)',
      [sheetTitle, JSON.stringify(filteredRows), JSON.stringify(headers), userId, sessionId]
    );
    
    const sheetId = sheetResult.insertId;
    console.log(`[saveSheetDataToDatabase] 새 sheet_data 레코드 생성: ID ${sheetId}, 세션 ID ${sessionId}`);

    // 10. 개별 데이터를 청크 단위로 저장 (최적화된 배치 크기로 처리)
    const CHUNK_SIZE = 1000; // 배치 크기 증가 (기존 500 → 1000)
    const PARALLEL_CHUNKS = 5; // 병렬 처리할 최대 청크 수
    
    let successCount = 0;
    let failCount = 0;
    
    console.log(`[saveSheetDataToDatabase] 대량 데이터 처리: ${filteredRows.length}개 행을 ${CHUNK_SIZE}개씩 나누어 처리합니다.`);
    
    // 청크 배열 생성 (필터링된 행을 CHUNK_SIZE 크기의 배열로 나눔)
    const chunks = [];
    for (let i = 0; i < filteredRows.length; i += CHUNK_SIZE) {
      chunks.push(filteredRows.slice(i, i + CHUNK_SIZE));
    }
    
    console.log(`[saveSheetDataToDatabase] 총 ${chunks.length}개의 청크로 분할됨`);
    
    // 병렬 처리를 위한 프로미스 배열
    const promises = [];
    
    // 청크 처리 함수
    const processChunks = async () => {
      while (chunks.length > 0 && promises.length < PARALLEL_CHUNKS) {
        const chunk = chunks.shift();
        
        try {
          const promise = executeBatchInsert(chunk, sheetTitle, userId, sessionId)
            .then(() => {
              successCount += chunk.length;
              
              // 프로미스 배열에서 완료된 항목 제거
              const index = promises.indexOf(promise);
              if (index !== -1) {
                promises.splice(index, 1);
              }
              
              // 진행 상황 보고
              const progress = Math.round(successCount / filteredRows.length * 100);
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`[saveSheetDataToDatabase] 진행 상황: ${successCount}/${filteredRows.length} 행 저장 완료 (${progress}%) - 경과 시간: ${elapsed}초`);
            })
            .catch(err => {
              failCount += chunk.length;
              console.error(`[saveSheetDataToDatabase] 청크 처리 중 오류:`, err);
              
              // 프로미스 배열에서 완료된 항목 제거
              const index = promises.indexOf(promise);
              if (index !== -1) {
                promises.splice(index, 1);
              }
              
              // 너무 많은 오류 발생 시 처리 중단
              if (failCount > filteredRows.length * 0.1) { // 10% 이상 실패 시
                throw new Error(`너무 많은 오류 발생 (${failCount}개). 작업을 중단합니다.`);
              }
            });
          
          promises.push(promise);
        } catch (error) {
          console.error('[saveSheetDataToDatabase] 청크 처리 예약 중 오류:', error);
          throw error; // 상위 레벨로 오류 전파
        }
      }
      
      // 처리 중인 청크가 있고 더 처리할 청크가 있으면 대기
      if (promises.length > 0 && chunks.length > 0) {
        await Promise.race(promises);
        return processChunks(); // 재귀 호출로 다음 청크 처리
      }
    };
    
    // 첫 청크 처리 시작
    await processChunks();
    
    // 모든 프로미스가 완료될 때까지 대기
    if (promises.length > 0) {
      await Promise.all(promises);
    }
    
    // 성공 여부 확인
    const totalProcessed = successCount + failCount;
    const successRate = Math.round((successCount / totalProcessed) * 100);
    
    console.log(`[saveSheetDataToDatabase] 처리 완료: ${successCount}개 성공, ${failCount}개 실패 (성공률: ${successRate}%)`);
    
    if (successCount > 0) {
      // 트랜잭션 커밋
      await pool.query('COMMIT');
      
      const totalTime = (Date.now() - startTime) / 1000;
      const insertRate = Math.round(successCount / totalTime);
      
      console.log(`[saveSheetDataToDatabase] 데이터베이스에 성공적으로 저장되었습니다.`);
      console.log(`[saveSheetDataToDatabase] 총 소요 시간: ${totalTime.toFixed(2)}초 (초당 ${insertRate}개 처리)`);
      
      return true;
    } else {
      // 모든 항목이 실패한 경우 롤백
      await pool.query('ROLLBACK');
      console.error('[saveSheetDataToDatabase] 모든 데이터 삽입 시도가 실패했습니다. 트랜잭션 롤백.');
      return false;
    }
  } catch (error) {
    console.error('[saveSheetDataToDatabase] 전체 처리 오류:', error);
    
    // 롤백 시도
    try {
      await pool.query('ROLLBACK');
      console.error('[saveSheetDataToDatabase] 트랜잭션 롤백 완료');
    } catch (rollbackError) {
      console.error('[saveSheetDataToDatabase] 롤백 중 오류:', rollbackError);
    }
    
    return false;
  }
}

module.exports = router;
