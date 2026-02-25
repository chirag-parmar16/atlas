@echo off
chcp 65001 > NUL
set FORCE_COLOR=1
set ELECTRON_RUN_AS_NODE=1
set ATLAS_PACKAGED=true
"%~dp0Atlas-Sandbox.exe" "%~dp0resources\app.asar\dist\atlas.js" %*
