import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { auth } from './utils/api';

// Components
import Navigation from './components/Navigation';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminSettings from './pages/AdminSettings';
import UserDebug from './pages/UserDebug';

// Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  
  // 로컬 스토리지에서 이전 인증 상태 확인 - 세션 만료 메시지 표시 결정에 사용
  const [hadPreviousSession, setHadPreviousSession] = useState(false);

  // 브라우저 창이 닫힐 때 세션 관리를 위한 기능
  useEffect(() => {
    // 브라우저 창이 처음 열렸을 때 실행
    const handleTabOpen = () => {
      // 탭이 새로 열렸을 때 sessionStorage에 표시
      sessionStorage.setItem('tabOpen', 'true');
      
      // localStorage에 저장된 탭 종료 정보 확인
      const wasTabClosed = localStorage.getItem('tabWasClosed') === 'true';
      
      // 이전에 탭이 닫혔다가 다시 열린 경우 서버 세션 확인
      if (wasTabClosed) {
        console.log('브라우저가 이전에 닫혔다가 다시 열렸습니다. 세션 다시 확인');
        localStorage.removeItem('tabWasClosed');
        
        // 자동 로그아웃 처리 (세션 만료됨)
        if (isAuthenticated) {
          handleLogout();
        }
      }
    };
    
    // 컴포넌트 마운트 시 핸들러 실행
    handleTabOpen();
    
    // 창이 닫힐 때 (beforeunload 이벤트) localStorage에 기록
    const handleTabClose = () => {
      localStorage.setItem('tabWasClosed', 'true');
    };
    
    // beforeunload 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleTabClose);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
    };
  }, [isAuthenticated]);

  // 일정 간격으로 세션 활성 상태 확인
  useEffect(() => {
    let intervalId;
    
    if (isAuthenticated && user) {
      // 사용자가 로그인한 경우, 주기적으로 세션 활성 여부 확인
      intervalId = setInterval(async () => {
        try {
          // sessionStorage 확인 (탭이 닫히면 sessionStorage는 제거됨)
          const isTabOpen = sessionStorage.getItem('tabOpen') === 'true';
          
          if (!isTabOpen) {
            console.log('브라우저 탭이 닫혔습니다. 세션 종료');
            await handleLogout();
            clearInterval(intervalId);
            return;
          }
          
          // 세션 활성 상태 확인 (선택적)
          await auth.checkSession();
        } catch (error) {
          console.error('세션 확인 오류:', error);
          // 세션 오류 시 로그아웃
          await handleLogout();
          clearInterval(intervalId);
        }
      }, 30000); // 30초마다 확인
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAuthenticated, user]);

  // 로그인 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      console.log('인증 상태 확인 중...');
      
      // 로컬 스토리지에서 이전 인증 상태 확인
      const hadPrevAuth = localStorage.getItem('hadAuthenticated') === 'true';
      setHadPreviousSession(hadPrevAuth);
      
      try {
        // 서버에 토큰 유효성 검사 요청
        const tokenResponse = await auth.getUser();
        if (tokenResponse && tokenResponse.data) {
          console.log('서버에서 사용자 정보 로드 성공:', tokenResponse.data);
          setUser(tokenResponse.data);
          setIsAuthenticated(true);
          setAuthError(null);
          
          // 인증 성공 시 로컬 스토리지에 상태 저장
          localStorage.setItem('hadAuthenticated', 'true');
          
          // 세션 스토리지에 탭 열림 상태 저장
          sessionStorage.setItem('tabOpen', 'true');
        } else {
          setIsAuthenticated(false);
          setUser(null);
          
          // 이전에 인증된 적이 있는 경우에만 오류 메시지 표시
          if (hadPrevAuth) {
            setAuthError('세션이 만료되었습니다. 다시 로그인해주세요.');
          }
        }
      } catch (error) {
        console.error('인증 확인 오류:', error);
        setIsAuthenticated(false);
        setUser(null);
        
        // 이전에 인증된 적이 있는 경우에만 오류 메시지 표시
        if (hadPrevAuth) {
          setAuthError('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // 로그인 처리
  const handleLogin = (userData) => {
    console.log('로그인 성공, 사용자 정보 설정:', userData);
    setUser(userData);
    setIsAuthenticated(true);
    setAuthError(null);
    
    // 로그인 성공 시 로컬 스토리지에 인증 상태 저장
    localStorage.setItem('hadAuthenticated', 'true');
    
    // 세션 스토리지에 탭 열림 상태 저장
    sessionStorage.setItem('tabOpen', 'true');
    
    // 탭 닫힘 플래그 제거
    localStorage.removeItem('tabWasClosed');
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    console.log('로그아웃 처리 중...');
    
    try {
      // 서버 API를 통해 로그아웃
      await auth.logout();
      setUser(null);
      setIsAuthenticated(false);
      console.log('로그아웃 완료');
      
      // 세션 정보 초기화
      sessionStorage.removeItem('tabOpen');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      // 오류 발생해도 로컬에서는 로그아웃 처리
      setUser(null);
      setIsAuthenticated(false);
      sessionStorage.removeItem('tabOpen');
    }
  };

  if (isLoading) {
    return <div className="text-center mt-5">로딩 중...</div>;
  }

  return (
    <Router>
      {isAuthenticated && user && <Navigation user={user} onLogout={handleLogout} />}
      <Container fluid className="px-3 py-2">
        <Routes>
          <Route path="/login" element={
            isAuthenticated && user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} authError={authError} />
          } />
          
          <Route path="/dashboard" element={
            isAuthenticated && user ? <Dashboard user={user} /> : <Navigate to="/login" replace />
          } />
          
          <Route path="/admin" element={
            isAuthenticated && user ? <AdminSettings user={user} /> : <Navigate to="/login" replace />
          } />
          
          <Route path="/debug" element={<UserDebug />} />
          <Route path="/user-debug" element={<UserDebug />} />
          
          <Route path="/" element={<Navigate to={isAuthenticated && user ? "/dashboard" : "/login"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App; 