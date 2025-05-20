import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Card, Modal, Row, Col, Alert } from 'react-bootstrap';
import { FaUserPlus, FaEdit, FaTrash, FaSync } from 'react-icons/fa';
import { users as usersAPI } from '../utils/api';

const AdminSettings = ({ user }) => {
  // 사용자 목록 상태
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 모달 상태
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' 또는 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    role: 'viewer' // 기본값: viewer
  });
  
  // 컴포넌트 마운트 시 사용자 목록 로드
  useEffect(() => {
    console.log('AdminSettings 컴포넌트 마운트, 사용자 목록 로드 시작');
    loadUsers();
  }, []);
  
  // 사용자 목록 로드 함수
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('사용자 목록 로드 요청');
      
      const response = await usersAPI.getAll();
      console.log('서버에서 받은 사용자 목록:', response.data);
      
      setUsers(response.data);
      console.log('사용자 목록 설정 완료:', response.data.length, '명');
    } catch (err) {
      console.error('사용자 로드 오류:', err);
      setError(err.response?.data?.message || err.message || '사용자 목록을 불러오는 중 오류가 발생했습니다.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 폼 입력 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // 모달 열기 - 새 사용자 생성
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({
      username: '',
      password: '',
      email: '',
      name: '',
      role: 'clerk'
    });
    setShowUserModal(true);
  };
  
  // 모달 열기 - 사용자 편집
  const handleOpenEditModal = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // 비밀번호는 비워둠
      email: user.email || '',
      role: user.role || 'viewer'
    });
    setShowUserModal(true);
  };
  
  // 모달 닫기
  const handleCloseModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
  };
  
  // 사용자 저장 (생성/수정)
  const handleSaveUser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 필수 입력 검증
      if (!formData.username || (modalMode === 'create' && !formData.password)) {
        setError('사용자 이름과 비밀번호는 필수 입력 항목입니다.');
        setLoading(false);
        return;
      }
      
      if (!formData.email) {
        setError('이메일은 필수 입력 항목입니다.');
        setLoading(false);
        return;
      }
      
      if (modalMode === 'create') {
        // 새 사용자 생성
        await usersAPI.create(formData);
        console.log('사용자 생성 성공');
      } else {
        // 기존 사용자 수정
        // 비밀번호가 비어있으면 제외
        const updateData = {...formData};
        if (!updateData.password) delete updateData.password;
        
        // 서버 API가 _id 또는 id를 사용할 수 있으므로 둘 다 확인
        const userId = selectedUser.id;
        if (!userId) {
          throw new Error('사용자 ID를 찾을 수 없습니다.');
        }
        
        await usersAPI.update(userId, updateData);
        console.log('사용자 업데이트 성공');
      }
      
      // 사용자 목록 새로고침
      await loadUsers();
      // 모달 닫기
      handleCloseModal();
      
    } catch (err) {
      console.error('사용자 저장 오류:', err);
      setError(err.response?.data?.message || err.message || `사용자 ${modalMode === 'create' ? '생성' : '수정'} 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };
  
  // 사용자 삭제
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('정말 이 사용자를 삭제하시겠습니까?')) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await usersAPI.delete(userId);
      console.log('사용자 삭제 성공:', userId);
      
      await loadUsers();
    } catch (err) {
      console.error('사용자 삭제 오류:', err);
      setError(err.response?.data?.message || err.message || '사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 역할 변경 핸들러
  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      setError(null);
      
      await usersAPI.changeRole(userId, newRole);
      console.log('사용자 역할 변경 성공:', userId, newRole);
      
      await loadUsers();
    } catch (err) {
      console.error('역할 변경 오류:', err);
      setError(err.response?.data?.message || err.message || '사용자 역할 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 권한에 따른 액세스 제어
  if (user?.role !== 'admin') {
    return (
      <Alert variant="danger" className="mt-3">
        <Alert.Heading>접근 권한이 없습니다</Alert.Heading>
        <p>이 페이지는 관리자만 접근할 수 있습니다.</p>
      </Alert>
    );
  }

  return (
    <div className="admin-settings">
      <h2 className="mb-3">관리자 설정</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">사용자 관리</h5>
          <div>
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={loadUsers}
              disabled={loading}
              className="me-2"
            >
              <FaSync className={loading ? 'spin' : ''} /> {loading ? '로딩 중...' : '새로고침'}
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleOpenCreateModal}
              disabled={loading}
            >
              <FaUserPlus className="me-1" /> 새 사용자 생성
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>사용자 이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="4" className="text-center">로딩 중...</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center">사용자가 없습니다</td>
                </tr>
              )}
              {!loading && users.map(user => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email || '-'}</td>
                  <td>
                    <Form.Select 
                      size="sm" 
                      value={user.role || 'viewer'} 
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      <option value="admin">관리자</option>
                      <option value="manager">매니저</option>
                      <option value="driver">드라이버</option>
                      <option value="clerk">사무원</option>
                    </Form.Select>
                  </td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="me-2"
                      onClick={() => handleOpenEditModal(user)}
                    >
                      <FaEdit /> 편집
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <FaTrash /> 삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Header>
          <h5 className="mb-0">역할 및 권한</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Card className="mb-3 mb-md-0">
                <Card.Header className="bg-primary text-white">관리자</Card.Header>
                <Card.Body>
                  <ul className="ps-3">
                    <li>모든 데이터 조회/수정/삭제</li>
                    <li>사용자 계정 생성 및 관리</li>
                    <li>역할 변경 권한</li>
                    <li>시스템 설정 변경</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="mb-3 mb-md-0">
                <Card.Header className="bg-success text-white">매니저</Card.Header>
                <Card.Body>
                  <ul className="ps-3">
                    <li>모든 데이터 조회/수정</li>
                    <li>부분적 데이터 삭제</li>
                    <li>계정 생성 불가</li>
                    <li>개인 설정 변경</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card>
                <Card.Header className="bg-info text-white">드라이버/사무원</Card.Header>
                <Card.Body>
                  <ul className="ps-3">
                    <li>데이터 조회만 가능</li>
                    <li>수정/삭제 권한 없음</li>
                    <li>계정 생성 불가</li>
                    <li>읽기 전용 접근</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      {/* 사용자 추가/편집 모달 */}
      <Modal show={showUserModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalMode === 'create' ? '새 사용자 생성' : '사용자 정보 편집'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>사용자 이름*</Form.Label>
              <Form.Control
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                disabled={modalMode === 'edit'} // 편집 시 사용자명 변경 불가
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {modalMode === 'create' ? '비밀번호*' : '새 비밀번호 (변경하지 않으려면 비워두세요)'}
              </Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={modalMode === 'create'} // 생성 시에만 필수
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>이메일*</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>역할*</Form.Label>
              <Form.Select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                <option value="admin">관리자</option>
                <option value="manager">매니저</option>
                <option value="driver">드라이버</option>
                <option value="clerk">사무원</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSaveUser} disabled={loading}>
            {loading ? '처리 중...' : '저장'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminSettings; 