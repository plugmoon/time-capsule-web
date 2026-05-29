@echo off
setlocal
cd /d "%~dp0"

echo Firebase config setup
echo.
echo 1. In Firebase Console, copy the firebaseConfig object.
echo 2. Come back here and press any key.
echo.
pause

powershell -ExecutionPolicy Bypass -File "%~dp0set-firebase-config.ps1"

echo.
echo If there was no error, firebase-config.js has been updated.
echo.
pause
