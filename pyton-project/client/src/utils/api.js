import axios from 'axios';

// 서버 URL 설정
const API_URL = 'http://localhost:5001';

// 데이터 검색 타임아웃 설정 (대용량 데이터 처리용)
const FETCH_TIMEOUT = 60 * 1000; // 60초
const SAVE_TIMEOUT = 120 * 1000; // 120초

// 세션 ID를 로컬 스토리지에 저장/조회하기 위한 키
const SESSION_ID_KEY = 'sheetSessionId';

// API 요청을 위한 axios 인스턴스 생성
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 기본 30초
  maxContentLength: 100 * 1024 * 1024, // 최대 100MB 요청 사이즈
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // 쿠키를 포함한 요청 활성화
});

// 요청 인터셉터 - 토큰 자동 추가
api.interceptors.request.use(
  (config) => {
    // 헤더에 token을 추가하지 않음 (쿠키를 사용)
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 오류 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 요청 오류:', error.response?.status, error.message);
    
    // 401 오류 처리 - 로그인/디버그 페이지에서는 리디렉션 제외
    if (error.response && error.response.status === 401) {
      console.log('인증 오류 감지');
      
      // 현재 페이지가 로그인 페이지나 디버그 페이지가 아닐 때만 리디렉션
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/debug') && !currentPath.includes('/user-debug')) {
        console.log('로그인 페이지로 리디렉션');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// 세션 관리 유틸리티 함수
export const sessionUtils = {
  // 세션 ID 저장
  saveSessionId: (sessionId) => {
    console.log(`세션 ID 저장: ${sessionId}`);
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  },
  
  // 세션 ID 조회
  getSessionId: () => {
    return localStorage.getItem(SESSION_ID_KEY);
  },
  
  // 세션 ID 삭제
  clearSessionId: () => {
    localStorage.removeItem(SESSION_ID_KEY);
  }
};

// 인증 관련 API
export const auth = {
  login: async (username, password) => {
    try {
      console.log('서버에 로그인 요청:', { username, password });
      const response = await api.post('/api/auth/login', { username, password });
      
      // 서버에서 받은 사용자 정보만 저장 (토큰은 쿠키에 저장됨)
      const { user } = response.data;
      console.log('로그인 성공:', user);
      
      return { data: { user } };
    } catch (error) {
      console.error('로그인 요청 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  },
  
  getUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      console.log('현재 사용자 정보 로드 성공:', response.data);
      return { data: response.data };
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  },
  
  logout: async () => {
    try {
      // 서버 API 호출 (쿠키 제거)
      await api.get('/api/auth/logout');
      return { data: { success: true } };
    } catch (error) {
      console.error('로그아웃 요청 실패:', error.response?.data || error.message);
      return { data: { success: true } };
    }
  },
  
  // 세션 활성 상태 확인 (heartbeat)
  checkSession: async () => {
    try {
      const response = await api.get('/api/auth/check-session');
      return { data: response.data };
    } catch (error) {
      console.error('세션 확인 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  }
};

// 사용자 관리 API
export const users = {
  getAll: async () => {
    try {
      console.log('사용자 목록 요청');
      const response = await api.get('/api/users');
      console.log('사용자 목록 로드 성공:', response.data);
      return { data: response.data };
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  },
  
  create: async (userData) => {
    try {
      console.log('사용자 생성 요청:', userData);
      
      // 데이터 유효성 검사
      if (!userData.email) {
        userData.email = `${userData.username}@example.com`;
      }
      
      // 역할 확인
      if (!userData.role) {
        userData.role = 'viewer';
      }
      
      const response = await api.post('/api/users', userData);
      console.log('사용자 생성 성공:', response.data);
      return { data: response.data };
    } catch (error) {
      console.error('사용자 생성 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  },
  
  update: async (id, userData) => {
    try {
      console.log('사용자 업데이트 요청:', id, userData);
      const response = await api.put(`/api/users/${id}`, userData);
      console.log('사용자 업데이트 성공:', response.data);
      return { data: response.data };
    } catch (error) {
      console.error('사용자 업데이트 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  },
  
  delete: async (id) => {
    try {
      console.log('사용자 삭제 요청:', id);
      const response = await api.delete(`/api/users/${id}`);
      console.log('사용자 삭제 성공:', response.data);
      return { data: response.data };
    } catch (error) {
      console.error('사용자 삭제 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  },
  
  changeRole: async (id, role) => {
    try {
      console.log('사용자 역할 변경 요청:', id, role);
      const response = await api.put(`/api/users/${id}`, { role });
      console.log('사용자 역할 변경 성공:', response.data);
      return { data: response.data };
    } catch (error) {
      console.error('사용자 역할 변경 실패:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  }
};

// 화물 데이터 관련 API
export const shipments = {
  getAll: () => api.get('/api/shipments', { 
    timeout: FETCH_TIMEOUT 
  }),
  
  saveAll: (data) => api.post('/api/shipments/save', { shipments: data }, {
    timeout: SAVE_TIMEOUT
  }),
  
  loadFromGoogleSheet: (url) => {
    // 저장된 세션 ID가 있으면 포함하여 요청
    const sessionId = sessionUtils.getSessionId();
    console.log(`시트 로드 요청 - URL: ${url}, 세션 ID: ${sessionId || '없음'}`);
    
    return api.post('/api/sheets/load', { url, sessionId }, {
      timeout: FETCH_TIMEOUT
    }).then(response => {
      // 응답에 세션 ID가 있으면 저장
      if (response.data.sheets?.[0]?.sessionId) {
        sessionUtils.saveSessionId(response.data.sheets[0].sessionId);
        console.log(`새 세션 ID 저장됨: ${response.data.sheets[0].sessionId}`);
      }
      return response;
    });
  },
  
  createInvoice: (id, memo, password) => api.post('/api/shipments/invoice', { id, memo, password }),
  
  getDetail: (id) => api.get(`/api/shipments/${id}`)
};

// 스프레드시트 관련 API
export const sheets = {
  // 시트 데이터 로드 (세션 ID 처리 포함)
  load: (url) => {
    const sessionId = sessionUtils.getSessionId();
    console.log(`시트 로드 API 호출 - URL: ${url}, 세션 ID: ${sessionId || '없음'}`);
    
    return api.post('/api/sheets/load', { url, sessionId })
      .then(response => {
        // 세션 ID 저장
        if (response.data.sheets?.[0]?.sessionId) {
          sessionUtils.saveSessionId(response.data.sheets[0].sessionId);
        }
        return response;
      });
  },
  
  // 세션 목록 조회
  getSessions: () => api.get('/api/sheets/sessions'),
  
  // 세션 삭제
  deleteSession: (sessionId) => api.delete(`/api/sheets/sessions/${sessionId}`)
};

// 서버 상태 확인 API
export const server = {
  checkHealth: () => api.get('/api/health')
};

export default api; 