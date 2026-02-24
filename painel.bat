@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "REFRESH_FLAG=%~dp0.refresh-restart.flag"

title Painel do Bot - biel

:menu
cls
echo ========================================
echo         PAINEL DO BOT - BIEL
echo ========================================
echo [1] npm run check
echo [2] npm run build
echo [3] npm run dev
echo [4] npm run dev:dev
echo [5] npm run watch
echo [6] npm run watch:dev
echo [7] npm run start
echo [8] npm run start:dev
echo [9] npm install
echo [10] npm run build + npm run start
echo [0] Sair
echo ========================================
set /p option=Escolha uma opcao: 

if "%option%"=="1" goto check
if "%option%"=="2" goto build
if "%option%"=="3" goto dev
if "%option%"=="4" goto devdev
if "%option%"=="5" goto watch
if "%option%"=="6" goto watchdev
if "%option%"=="7" goto start
if "%option%"=="8" goto startdev
if "%option%"=="9" goto install
if "%option%"=="10" goto buildstart
if "%option%"=="0" goto end

echo.
echo Opcao invalida.
pause
goto menu

:check_tools
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado no PATH.
  echo Instale o Node.js 20.12+ e tente novamente.
  pause
  goto menu
)

where npm >nul 2>&1
if errorlevel 1 (
  echo NPM nao foi encontrado no PATH.
  echo Reinstale o Node.js e tente novamente.
  pause
  goto menu
)

goto :eof

:check
call :check_tools
echo.
echo Executando npm run check...
call npm run check
pause
goto menu

:build
call :check_tools
echo.
echo Executando npm run build...
call npm run build
pause
goto menu

:dev
call :check_tools
echo.
echo Executando npm run dev...
call npm run dev
pause
goto menu

:devdev
call :check_tools
echo.
echo Executando npm run dev:dev...
call npm run dev:dev
pause
goto menu

:watch
call :check_tools
echo.
echo Executando npm run watch...
call npm run watch
pause
goto menu

:watchdev
call :check_tools
echo.
echo Executando npm run watch:dev...
call npm run watch:dev
pause
goto menu

:start
call :check_tools
echo.
echo Executando npm run start...
call npm run start
if exist "%REFRESH_FLAG%" (
  del /f /q "%REFRESH_FLAG%" >nul 2>&1
  goto end
)
pause
goto menu

:startdev
call :check_tools
echo.
echo Executando npm run start:dev...
call npm run start:dev
pause
goto menu

:install
call :check_tools
echo.
echo Executando npm install...
call npm install
pause
goto menu

:buildstart
call :check_tools
echo.
echo Executando npm run build...
call npm run build
if errorlevel 1 (
  echo Build falhou. O start nao sera executado.
  pause
  goto menu
)

echo.
echo Executando npm run start...
call npm run start
if exist "%REFRESH_FLAG%" (
  del /f /q "%REFRESH_FLAG%" >nul 2>&1
  goto end
)
pause
goto menu

:end
echo Encerrando painel...
endlocal
exit /b 0
