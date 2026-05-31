@echo off
cd /d "%~dp0"

if "%1"=="" (
  node server.js 3456
) else (
  node server.js %1
)

echo.
pause
