!macro customInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable(\"PATH\", [Environment]::GetEnvironmentVariable(\"PATH\", [EnvironmentVariableTarget]::User) + \";$INSTDIR\", [EnvironmentVariableTarget]::User)"'
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$newPath = [Environment]::GetEnvironmentVariable(\"PATH\", [EnvironmentVariableTarget]::User) -replace \";?\Q$INSTDIR\E;?\", \";\"; [Environment]::SetEnvironmentVariable(\"PATH\", $$newPath, [EnvironmentVariableTarget]::User)"'
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend
