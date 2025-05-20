@echo off
echo ==== 실행 중인 노드 프로세스 종료 ====
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

echo ==== 서버 시작 ====
cd /d D:\cursor\Homepage
npm run dev 