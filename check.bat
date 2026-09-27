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

echo.
echo All core development dependencies are installed.
echo.

REM Run Linter Check
echo Checking code quality (ESLint)...
call npm run lint
if %ERRORLEVEL% neq 0 (
  echo Linter check failed. Please resolve lint issues before committing.
  exit /b 1
)
echo Linter passed cleanly.
echo.

REM Run Automated Test Suite
echo Running automated test suite (Jest)...
call npm test
if %ERRORLEVEL% neq 0 (
  echo Automated tests failed. Please resolve failing tests before committing.
  exit /b 1
)
echo All automated tests passed green.
echo.
echo Environment and code quality checks completed successfully!