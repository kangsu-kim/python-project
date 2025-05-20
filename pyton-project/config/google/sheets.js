const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.resolve(__dirname, 'credentials.json');

/**
 * 구글 시트에서 데이터를 가져오는 함수 (gid → 시트명 자동 매핑)
 * @param {string} spreadsheetId - 구글 시트 ID
 * @param {string|null} sheetName - 시트명 (없으면 gid 기반 자동 추출)
 * @param {string|null} gid - URL에 있는 gid 값 (옵션)
 * @returns {Promise<Array>} 시트 데이터
 */
async function getSheetData(spreadsheetId, sheetName = null, gid = null) {
  try {
    console.log(`[getSheetData] 시작: ID=${spreadsheetId}, sheet=${sheetName || 'auto'}, gid=${gid || 'null'}`);
    
    // credentials.json 파일이 존재하는지 확인
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`자격 증명 파일을 찾을 수 없습니다: ${CREDENTIALS_PATH}`);
    }
    
    // 자격 증명 로드
    console.log('[getSheetData] 자격 증명 로드 중...');
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('자격 증명 파일에 필요한 정보가 누락되었습니다 (client_email 또는 private_key)');
    }
    
    // JWT 인증 설정
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    // Google Sheets API 초기화
    const sheets = google.sheets({ version: 'v4', auth });

    // 스프레드시트 메타데이터 가져오기
    console.log('[getSheetData] 스프레드시트 메타데이터 요청...');
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = metadata.data.sheets;

    if (!sheetList || sheetList.length === 0) {
      throw new Error('스프레드시트에 시트가 없습니다.');
    }

    console.log(`[getSheetData] 시트 ${sheetList.length}개 발견`);
    
    // 시트 선택 로직
    let selectedSheetName = sheetName;
    if (!sheetName && gid) {
      console.log(`[getSheetData] gid ${gid}에 해당하는 시트 찾는 중...`);
      const match = sheetList.find(sheet => String(sheet.properties.sheetId) === gid);
      if (match) {
        selectedSheetName = match.properties.title;
        console.log(`[getSheetData] gid ${gid}에 해당하는 시트를 찾았습니다: ${selectedSheetName}`);
      } else {
        console.warn(`[getSheetData] gid ${gid}에 해당하는 시트를 찾을 수 없어 첫 번째 시트를 사용합니다.`);
      }
    }
    if (!selectedSheetName) {
      selectedSheetName = sheetList[0].properties.title;
      console.log(`[getSheetData] 첫 번째 시트 사용: ${selectedSheetName}`);
    }

    // 선택된 시트의 데이터 가져오기
    console.log(`[getSheetData] "${selectedSheetName}" 시트의 데이터 요청 중...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: selectedSheetName,
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      console.warn(`[getSheetData] "${selectedSheetName}" 시트에 데이터가 없습니다.`);
      return [{
        sheetTitle: selectedSheetName,
        data: []
      }];
    }
    
    console.log(`[getSheetData] "${selectedSheetName}" 시트에서 ${rows.length}개 행 로드 완료`);
    
    // 로깅 목적으로 첫 행과 마지막 행 출력
    if (rows.length > 0) {
      console.log('[getSheetData] 헤더 행:', JSON.stringify(rows[0]));
      if (rows.length > 1) {
        console.log('[getSheetData] 첫 번째 데이터 행:', JSON.stringify(rows[1]));
      }
    }
    
    return [{
      sheetTitle: selectedSheetName,
      data: rows
    }];
  } catch (error) {
    console.error('구글 시트 데이터 가져오기 오류:', error);
    
    // 자세한 오류 정보 출력
    if (error.response) {
      console.error('API 응답 오류:', {
        status: error.response.status,
        message: error.response.data?.error?.message || 'Unknown error',
        errors: error.response.data?.error?.errors || []
      });
    }
    
    throw new Error(`구글 시트 데이터를 불러오지 못했습니다: ${error.message}`);
  }
}

function extractSheetId(url) {
  console.log(`[extractSheetId] URL에서 시트 ID 추출 시도: ${url}`);
  const regex = /\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  if (!match || match.length < 2) {
    throw new Error('유효한 스프레드시트 ID를 찾을 수 없습니다.');
  }
  console.log(`[extractSheetId] 추출된 시트 ID: ${match[1]}`);
  return match[1];
}

function extractGid(url) {
  console.log(`[extractGid] URL에서 GID 추출 시도: ${url}`);
  const match = url.match(/gid=([0-9]+)/);
  const result = match ? match[1] : null;
  console.log(`[extractGid] 추출된 GID: ${result || 'null'}`);
  return result;
}

module.exports = { getSheetData, extractSheetId, extractGid };
