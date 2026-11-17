
!include "LogicLib.nsh"

!macro customInstall

  ; Create the Scripter CLI launcher.
  FileOpen $0 "$INSTDIR\scripter.cmd" w

  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 'set "APP=%~dp0Scripter.exe"$\r$\n'
  FileWrite $0 'if not exist "%APP%" exit /b 1$\r$\n'
  FileWrite $0 'if /i "%~1"=="-h" goto help$\r$\n'
  FileWrite $0 'if /i "%~1"=="--help" goto help$\r$\n'
  FileWrite $0 'if /i "%~1"=="-v" goto version$\r$\n'
  FileWrite $0 'if /i "%~1"=="--version" goto version$\r$\n'
  FileWrite $0 'start "" "%APP%" %*$\r$\n'
  FileWrite $0 'exit /b 0$\r$\n'
  FileWrite $0 ':help$\r$\n'
  FileWrite $0 'echo Scripter - Code Editor$\r$\n'
  FileWrite $0 'echo Usage: scripter [path]$\r$\n'
  FileWrite $0 'echo Options: --help, --version$\r$\n'
  FileWrite $0 'exit /b 0$\r$\n'
  FileWrite $0 ':version$\r$\n'
  FileWrite $0 'echo Scripter ${VERSION}$\r$\n'
  FileWrite $0 'exit /b 0$\r$\n'

  FileClose $0

  ; Create the alias.
  CopyFiles /SILENT "$INSTDIR\scripter.cmd" "$INSTDIR\script.cmd"

  ; Register installation directory in current user's PATH.
  ReadRegStr $0 HKCU "Environment" "Path"

  ; Check whether the installation directory is already present.
  ${If} $0 == ""
    WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
  ${Else}
    ; Avoid duplicate entries.
    ${If} $0 != "$INSTDIR"
      WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
    ${EndIf}
  ${EndIf}

  ; Notify Windows.
  System::Call 'user32::SendMessageTimeoutW(i 0xffff, i 0x001A, i 0, w "Environment", i 2, i 5000, *i .r0)'

!macroend


!macro customUnInstall

  ; Remove CLI launchers.
  Delete "$INSTDIR\scripter.cmd"
  Delete "$INSTDIR\script.cmd"

  ; Notify Windows.
  System::Call 'user32::SendMessageTimeoutW(i 0xffff, i 0x001A, i 0, w "Environment", i 2, i 5000, *i .r0)'

!macroend
