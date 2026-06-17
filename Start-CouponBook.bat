@echo off
title Coupon Book Launcher
setlocal
cd /d "%~dp0"
echo.
echo ============================================
echo  Coupon Book 실행
echo ============================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Python 가상환경을 준비합니다...
  where py >nul 2>nul
  if %errorlevel%==0 (
    py -3 -m venv .venv
  ) else (
    python -m venv .venv
  )
)

set "PY=%~dp0.venv\Scripts\python.exe"

echo [2/3] 필요한 패키지를 확인합니다...
"%PY%" -m pip install -q -r requirements.txt

echo [3/3] 서버를 시작합니다...
set "COUPON_BOOK_PORT=7789"
start "CouponBook Server" "%PY%" "%~dp0app.py"

timeout /t 3 /nobreak >nul
start http://127.0.0.1:7789

endlocal
