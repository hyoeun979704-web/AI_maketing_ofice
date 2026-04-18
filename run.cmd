@echo off
REM AI Marketing Office — Windows 원클릭 실행기.
REM 더블클릭하거나 `run.cmd`로 실행. Node.js 필요.

setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [!] Node.js가 설치되어 있지 않습니다.
  echo.
  echo     1. https://nodejs.org/ko 에서 LTS 버전을 설치하세요
  echo        (설치 시 "Add to PATH" 반드시 체크)
  echo     2. 설치 후 이 창을 닫고 run.cmd를 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo [!] .env 파일이 없습니다 — 시뮬레이션 모드로 실행됩니다.
  echo     실제 Claude API를 쓰시려면 저장소 루트에 .env를 만들고
  echo     다음 한 줄을 넣으세요:
  echo.
  echo         ANTHROPIC_API_KEY=sk-ant-...
  echo.
  echo     그 후 이 창을 다시 실행하면 LIVE 모드로 전환됩니다.
  echo.
  timeout /t 5 >nul
)

if not exist "server\server.mjs" (
  echo [X] server\server.mjs 파일이 없습니다.
  echo     지금 받으신 폴더가 잘못된 브랜치일 수 있습니다.
  echo     https://github.com/hyoeun979704-web/AI_maketing_ofice/tree/claude/analyze-remade-code-Cz9qg
  echo     에서 Download ZIP으로 다시 받으세요.
  pause
  exit /b 1
)

echo.
echo 서버 시작 중... (중단하려면 Ctrl+C)
echo 몇 초 뒤 브라우저가 자동으로 열립니다.
echo.

REM Open browser after short delay in a background shell
start "" cmd /c "timeout /t 3 >nul && start http://localhost:8787"

node server/server.mjs
