@echo off
setlocal
cd /d "%~dp0"
set "LEXNOTE_PY="
py -3 --version >nul 2>&1
if not errorlevel 1 set "LEXNOTE_PY=py -3"
if defined LEXNOTE_PY goto launch
python --version >nul 2>&1
if not errorlevel 1 set "LEXNOTE_PY=python"
if defined LEXNOTE_PY goto launch
if exist "%LocalAppData%\Python\bin\python.exe" (
  "%LocalAppData%\Python\bin\python.exe" --version >nul 2>&1
  if not errorlevel 1 set LEXNOTE_PY="%LocalAppData%\Python\bin\python.exe"
)
if defined LEXNOTE_PY goto launch
echo Python 3 is required. Install from https://www.python.org/downloads/
echo Enable Add Python to PATH, then run this file again.
pause
exit /b 1
:launch
%LEXNOTE_PY% serve.py %*
if errorlevel 1 pause
