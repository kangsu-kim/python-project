@echo off
cd /d D:\cursor\Homepage\client

echo 환경 변수 설정 중...
set PORT=3000
set HOST=localhost
set DANGEROUSLY_DISABLE_HOST_CHECK=true
set WDS_SOCKET_HOST=localhost

echo 클라이언트 시작 중 (포트 3000)...
npm start 