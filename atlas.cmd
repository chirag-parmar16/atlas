@echo off
set ELECTRON_RUN_AS_NODE=1
set ATLAS_PACKAGED=true
"%~dp0Atlas-Sandbox.exe" "%~dp0resources\app.asar\dist\atlas.js" %*
