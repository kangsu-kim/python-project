import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Navigation = ({ user, onLogout }) => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/dashboard">신성통운</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/dashboard">대시보드</Nav.Link>
            {user && user.role === 'admin' && (
              <Nav.Link as={Link} to="/admin">관리자 설정</Nav.Link>
            )}
          </Nav>
          <Nav>
            {user && (
              <Navbar.Text className="me-3">
                <span className="text-light">{user.username} 님</span>
              </Navbar.Text>
            )}
            <Button variant="outline-light" size="sm" onClick={onLogout}>
              로그아웃
            </Button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation; 