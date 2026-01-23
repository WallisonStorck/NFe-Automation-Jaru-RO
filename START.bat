@echo off
cd /d "%~dp0"

echo ==========================================
echo NFSe Automation - Starting...
echo ==========================================
echo Working folder: %cd%
echo.

set "BRANCH=main"

echo Checking Node.js...
node -v >nul 2>&1
if not "%ERRORLEVEL%"=="0" goto NODE_FAIL
echo OK: Node.js found.
echo.

echo Checking Git...
git --version >nul 2>&1
if not "%ERRORLEVEL%"=="0" goto GIT_FAIL
echo OK: Git found.
echo.

if not exist ".git" goto NOT_A_GIT_REPO

echo Updating repository...
git pull origin %BRANCH%
if not "%ERRORLEVEL%"=="0" goto GIT_PULL_FAIL
echo OK: Repository updated.
echo.

echo Installing/updating dependencies...
REM IMPORTANT: npm is a .cmd on Windows, so we must use CALL
call npm install
if not "%ERRORLEVEL%"=="0" goto NPM_FAIL
echo OK: Dependencies installed.
echo.

echo Starting server...
start "NFSe Server" cmd /k "cd /d %cd% && node server.js"

echo Waiting for server...
timeout /t 2 /nobreak >nul

echo Opening interface in Chrome...
set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME1%" (
  start "" "%CHROME1%" "http://localhost:3000"
) else if exist "%CHROME2%" (
  start "" "%CHROME2%" "http://localhost:3000"
) else (
  start "" "http://localhost:3000"
)

echo.
echo Done. Use the Stop button in the interface when needed.
pause
exit /b 0

:NODE_FAIL
echo ERROR: Node.js is not installed or not in PATH.
echo Install Node.js (LTS) and try again.
pause
exit /b 1

:GIT_FAIL
echo ERROR: Git is not installed or not in PATH.
echo Install Git for Windows and try again.
pause
exit /b 1

:NOT_A_GIT_REPO
echo ERROR: .git folder not found.
echo Please clone the repository first, then run START.bat inside it.
pause
exit /b 1

:GIT_PULL_FAIL
echo ERROR: git pull failed.
echo If you have local changes, commit/stash them and try again.
pause
exit /b 1

:NPM_FAIL
echo ERROR: npm install failed.
pause
exit /b 1
