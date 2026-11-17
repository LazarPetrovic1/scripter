
@echo off
setlocal

set "APP=%~dp0Scripter.exe"
set "VERSION=1.2.0"

if not exist "%APP%" (
    echo Scripter executable not found: "%APP%" 1>&2
    exit /b 1
)

if "%~1"=="--help" goto help
if "%~1"=="-h" goto help

if "%~1"=="--version" goto version
if "%~1"=="-v" goto version

start "" "%APP%" %*
exit /b 0

:help
echo Scripter - Code Editor
echo.
echo Usage:
echo   scripter [options] [paths...]
echo.
echo Examples:
echo   scripter
echo   scripter .
echo   scripter ./my-project
echo   scripter ./src/App.jsx
echo.
echo Options:
echo   --help, -h            Show this help
echo   --version, -v         Show application version
echo   --verbose             Enable verbose logging
echo   -n, --new-window      Open a new application window
echo   -r, --reuse-window    Reuse an existing application window
echo.
exit /b 0

:version
echo Scripter %VERSION%
exit /b 0
