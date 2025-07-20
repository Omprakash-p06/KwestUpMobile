@echo off

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Node.js is not installed. Please install Node.js from https://nodejs.org/
  exit /b 1
) else (
  node --version
)

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo npm is not installed. Please install npm from https://nodejs.org/
  exit /b 1
) else (
  npm --version
)

REM Check git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Git is not installed. Please install Git from https://git-scm.com/
  exit /b 1
) else (
  git --version
)

REM Check expo-cli
where expo >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Expo CLI is not installed. Please install it with: npm install -g expo-cli
  exit /b 1
) else (
  expo --version
)

echo All dependencies are installed. 