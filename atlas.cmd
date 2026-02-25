@echo off
set ELECTRON_RUN_AS_NODE=1
set ATLAS_PACKAGED=true
"%~dp0Atlas.exe" "%~dp0resources\app.asar\dist\atlas.js" %*
