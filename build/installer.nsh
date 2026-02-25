!macro customInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable(\"PATH\", [Environment]::GetEnvironmentVariable(\"PATH\", [EnvironmentVariableTarget]::User) + \";$INSTDIR\", [EnvironmentVariableTarget]::User)"'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$newPath = [Environment]::GetEnvironmentVariable(\"PATH\", [EnvironmentVariableTarget]::User) -replace \";?\Q$INSTDIR\E;?\", \";\"; [Environment]::SetEnvironmentVariable(\"PATH\", $$newPath, [EnvironmentVariableTarget]::User)"'
!macroend
