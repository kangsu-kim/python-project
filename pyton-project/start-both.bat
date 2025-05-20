@echo off
REM 서버 실행
echo 서버 시작 중...
start cmd /k "cd /d D:\cursor\Homepage && node server.js"

REM 잠시 대기
timeout /t 3

REM 클라이언트 실행 
echo 클라이언트 시작 중...
start cmd /k "cd /d D:\cursor\Homepage\client && npm start"

echo 서버와 클라이언트가 모두 시작되었습니다. 