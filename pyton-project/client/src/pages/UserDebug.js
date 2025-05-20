import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Alert, Form, Modal } from 'react-bootstrap';
import axios from 'axios';
import { auth, users as usersAPI } from '../utils/api';

const UserDebug = () => {
  const [serverUsers, setServerUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [testLogin, setTestLogin] = useState({
    username: '',
    password: ''
  });
  const [loginResult, setLoginResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // 서버에서 사용자 정보 로드
    loadUsers();
    
    // 현재 로그인한 사용자 정보 로드
    checkCurrentUser();
  }, []);
  
  // 서버에서 사용자 목록 로드
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await usersAPI.getAll();
      console.log('서버에서 로드한 사용자 목록:', response.data);
      setServerUsers(response.data);
    } catch (err) {
      console.error('사용자 목록 로드 오류:', err);
      setError('사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 현재 사용자 확인
  const checkCurrentUser = async () => {
    try {
      const response = await auth.getUser();
      if (response && response.data) {
        setCurrentUser(response.data);
      }
    } catch (err) {
      console.error('현재 사용자 확인 오류:', err);
      setCurrentUser(null);
    }
  };
  
  // 테스트 로그인 처리
  const handleTestLogin = async () => {
    setLoginResult(null);
    setLoading(true);
    
    try {
      console.log('테스트 로그인 시도:', testLogin);
      const response = await auth.login(testLogin.username, testLogin.password);
      
      console.log('로그인 응답:', response);
      setLoginResult({
        success: true,
        message: '로그인 성공!',
        user: response.data.user
      });
      
      // 현재 사용자 정보 업데이트
      setCurrentUser(response.data.user);
      
    } catch (err) {
      console.error('테스트 로그인 오류:', err);
      
      setLoginResult({
        success: false,
        message: err.response?.data?.message || err.message || '로그인에 실패했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 테스트 로그인 입력값 변경 핸들러
  const handleTestLoginChange = (e) => {
    const { name, value } = e.target;
    setTestLogin(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 기본 관리자 계정 생성
  const handleCreateDefaultAdmin = async () => {
    setLoading(true);
    setError(null);
    
    // 서버 상태 먼저 확인
    try {
      await axios.get('/api/health');
    } catch (err) {
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      setLoading(false);
      return;
    }
    
    try {
      // 이미 admin 계정이 있는지 확인
      const existingAdmin = serverUsers.find(u => u.username === 'admin');
      
      if (existingAdmin) {
        if (window.confirm('이미 admin 계정이 존재합니다. 비밀번호를 Admin@123456으로 재설정하시겠습니까?')) {
          // 비밀번호 업데이트 요청
          await usersAPI.update(existingAdmin.id, { 
            password: 'Admin@123456'
          });
          
          alert('admin 계정의 비밀번호가 재설정되었습니다.\n아이디: admin\n비밀번호: Admin@123456');
          loadUsers(); // 사용자 목록 새로고침
        }
      } else {
        // 새 admin 계정 생성
        const newAdmin = {
          username: 'admin',
          password: 'Admin@123456',
          email: 'admin@example.com',
          role: 'admin'
        };
        
        const response = await usersAPI.create(newAdmin);
        console.log('새 관리자 계정 생성됨:', response.data);
        
        alert('기본 관리자 계정이 생성되었습니다.\n아이디: admin\n비밀번호: Admin@123456');
        loadUsers(); // 사용자 목록 새로고침
      }
    } catch (err) {
      console.error('관리자 계정 생성/업데이트 오류:', err);
      setError(err.response?.data?.message || err.message || '관리자 계정 생성/업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 서버 상태 확인
  const checkServerStatus = async () => {
    try {
      const response = await axios.get('/api/health');
      alert(`서버 상태: ${response.data.status}\n시간: ${response.data.timestamp}`);
    } catch (err) {
      alert('서버 연결 오류: ' + (err.message || '알 수 없는 오류'));
    }
  };
  
  return (
    <div className="user-debug p-3">
      <h2 className="mb-4">사용자 계정 디버그</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">서버 사용자 목록</h5>
          <div>
            <Button variant="info" size="sm" className="me-2" onClick={checkServerStatus}>
              서버 상태 확인
            </Button>
            <Button variant="primary" size="sm" className="me-2" onClick={() => setShowLoginModal(true)}>
              로그인 테스트
            </Button>
            <Button variant="success" size="sm" className="me-2" onClick={handleCreateDefaultAdmin} disabled={loading}>
              기본 관리자 생성
            </Button>
            <Button variant="secondary" size="sm" className="me-2" onClick={loadUsers} disabled={loading}>
              {loading ? '로딩 중...' : '새로고침'}
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <Alert variant="info">사용자 목록을 불러오는 중...</Alert>
          ) : serverUsers.length === 0 ? (
            <Alert variant="info">서버에 저장된 사용자가 없습니다.</Alert>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>사용자명</th>
                  <th>이메일</th>
                  <th>역할</th>
                  <th>생성일</th>
                </tr>
              </thead>
              <tbody>
                {serverUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.role || 'viewer'}</td>
                    <td>{new Date(user.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Header>
          <h5 className="mb-0">현재 로그인 정보</h5>
        </Card.Header>
        <Card.Body>
          {currentUser ? (
            <div>
              <p><strong>사용자명:</strong> {currentUser.username}</p>
              <p><strong>역할:</strong> {currentUser.role || 'viewer'}</p>
              <p><strong>쿠키에 토큰 저장됨</strong></p>
            </div>
          ) : (
            <Alert variant="warning">로그인된 사용자가 없습니다.</Alert>
          )}
        </Card.Body>
      </Card>
      
      {/* 로그인 테스트 모달 */}
      <Modal show={showLoginModal} onHide={() => setShowLoginModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>로그인 테스트</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>아이디</Form.Label>
              <Form.Control
                type="text"
                name="username"
                value={testLogin.username}
                onChange={handleTestLoginChange}
                placeholder="아이디 입력"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>비밀번호</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={testLogin.password}
                onChange={handleTestLoginChange}
                placeholder="비밀번호 입력"
              />
            </Form.Group>
          </Form>
          
          {loginResult && (
            <Alert variant={loginResult.success ? 'success' : 'danger'} className="mt-3">
              <p className="mb-0"><strong>{loginResult.message}</strong></p>
              {loginResult.success && (
                <div className="mt-2">
                  <p className="mb-1"><small>사용자명: {loginResult.user.username}</small></p>
                  <p className="mb-1"><small>역할: {loginResult.user.role}</small></p>
                  <p className="mb-0"><small>ID: {loginResult.user.id}</small></p>
                </div>
              )}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLoginModal(false)}>
            닫기
          </Button>
          <Button variant="primary" onClick={handleTestLogin} disabled={loading}>
            {loading ? '로그인 중...' : '로그인 테스트'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserDebug; 