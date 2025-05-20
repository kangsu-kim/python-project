# 화물운송 회사 웹 시스템

화물운송 회사를 위한 웹 기반 관리 시스템입니다.

## 기능

- 관리자 계정 관리
- 사용자 권한 기반 페이지 접근 제어
- 화물 및 운송 정보 관리

## 기술 스택

- 프론트엔드: React, Bootstrap
- 백엔드: Node.js, Express
- 데이터베이스: MySQL
- 인증: JWT (JSON Web Token)

## 설치 방법

1. 저장소 클론
```
git clone [repository-url]
```

2. 필요한 패키지 설치
```
npm install
```

3. 환경 변수 설정
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cargo_transport
JWT_SECRET=your_jwt_secret
```

4. 서버 실행
```
npm run dev
```

## 보안 권장사항

1. 프로덕션 환경에서는 반드시 강력한 JWT_SECRET을 설정하세요
2. 기본 관리자 계정의 비밀번호를 즉시 변경하세요
3. HTTPS를 활성화하여 모든 통신을 암호화하세요
4. 정기적으로 데이터베이스 백업을 수행하세요
5. 사용자 계정 관리에 주의하고, 퇴사자의 계정은 즉시 비활성화하세요
6. 모든 비밀번호는 솔트(salt)를 사용하여 해시 처리됩니다
7. 기본 사용자 권한:
   - admin: 모든 기능에 접근 가능
   - manager: 화물 관리 및 운전자 배정 가능
   - driver: 배정된 화물 정보 확인 및 상태 업데이트 가능
   - clerk: 기본적인 화물 정보 조회만 가능 