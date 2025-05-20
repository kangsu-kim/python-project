import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { auth } from '../utils/api';

const Login = ({ onLogin, authError }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 외부에서 전달된 인증 오류를 내부 상태에 반영
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('로그인 시도:', username);
      
      // 서버 API를 사용하여 로그인 수행
      const response = await auth.login(username, password);
      const { user } = response.data;
      
      console.log('로그인 성공:', user);
      
      // 로그인 성공 후 상위 컴포넌트에 알림
      if (onLogin) {
        onLogin(user);
      }
      
    } catch (err) {
      console.error('로그인 오류:', err);
      setError(err.response?.data?.message || '아이디 또는 비밀번호가 일치하지 않습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <Card className="shadow-lg" style={{ width: '400px' }}>
        <Card.Body className="p-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold mb-3">신성통운</h2>
            <p className="text-muted">계정 정보로 로그인하세요</p>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>사용자명</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="사용자명 입력"
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>비밀번호</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
              />
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              className="w-100 py-2"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </Form>
          
          <div className="text-center mt-4">
            <small className="text-muted">
              계정이 없으신가요? 관리자에게 문의하세요.
            </small>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login; 