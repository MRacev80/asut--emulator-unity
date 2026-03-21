@echo off
echo Restoring custom CODESYS MCP server.js...
set SRC=%~dp0codesys-mcp-server.js
set DST=%APPDATA%\npm\node_modules\@codesys\mcp-toolkit\dist\server.js

if not exist "%SRC%" (
    echo ERROR: codesys-mcp-server.js not found in %~dp0
    pause
    exit /b 1
)

if not exist "%DST%" (
    echo ERROR: @codesys/mcp-toolkit not installed. Run: npm install -g @codesys/mcp-toolkit
    pause
    exit /b 1
)

copy /Y "%SRC%" "%DST%"
echo Done. Restart Claude Code to apply changes.
pause
