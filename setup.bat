@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   АСУТП Эмулятор — Автоматическая настройка окружения
echo ============================================================
echo.
echo  Этот скрипт настраивает шаги 2-5 из ONBOARDING.md
echo  Шаг 1 (CODESYS + Control Win V3) — установить вручную
echo.

set CODESYS_EXE=C:\Program Files (x86)\CODESYS 3.5.17.30\CODESYS\Common\CODESYS.exe
set CLAUDE_JSON=%USERPROFILE%\.claude.json
set PROJECT_DIR=%~dp0
set ERRORS=0

REM ─────────────────────────────────────────────────────────────
REM Шаг 1: Проверка Node.js
REM ─────────────────────────────────────────────────────────────
echo [1/5] Проверка Node.js...
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] Node.js не найден.
    echo          Скачать: https://nodejs.org
    echo          После установки Node.js запустите setup.bat снова.
    set /a ERRORS+=1
    goto :end
) else (
    for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
    echo   [OK] Node.js !NODE_VER!
)

REM ─────────────────────────────────────────────────────────────
REM Шаг 2: Установка @codesys/mcp-toolkit
REM ─────────────────────────────────────────────────────────────
echo.
echo [2/5] Установка @codesys/mcp-toolkit...
codesys-mcp-tool --help > nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] @codesys/mcp-toolkit уже установлен
) else (
    echo   Устанавливаю npm install -g @codesys/mcp-toolkit ...
    npm install -g @codesys/mcp-toolkit
    if %errorlevel% neq 0 (
        echo   [FAIL] Ошибка установки npm пакета
        set /a ERRORS+=1
    ) else (
        echo   [OK] @codesys/mcp-toolkit установлен
    )
)

REM ─────────────────────────────────────────────────────────────
REM Шаг 3: Восстановление кастомного патча MCP
REM ─────────────────────────────────────────────────────────────
echo.
echo [3/5] Применение кастомного патча MCP...
if not exist "%PROJECT_DIR%codesys-mcp-server.js" (
    echo   [FAIL] codesys-mcp-server.js не найден в папке проекта
    set /a ERRORS+=1
) else (
    set SRC=%PROJECT_DIR%codesys-mcp-server.js
    set DST=%APPDATA%\npm\node_modules\@codesys\mcp-toolkit\dist\server.js
    if not exist "!DST!" (
        echo   [FAIL] @codesys/mcp-toolkit не установлен (предыдущий шаг не выполнен?)
        set /a ERRORS+=1
    ) else (
        copy /Y "!SRC!" "!DST!" > nul
        echo   [OK] Патч применён (read_pou_code, get_application_state, и др.)
    )
)

REM ─────────────────────────────────────────────────────────────
REM Шаг 4: Создание ~/.claude.json
REM ─────────────────────────────────────────────────────────────
echo.
echo [4/5] Настройка ~/.claude.json...
if exist "%CLAUDE_JSON%" (
    echo   [WARN] %CLAUDE_JSON% уже существует — не перезаписываю.
    echo          Убедитесь что в нём есть секция "codesys_local" (см. ONBOARDING.md шаг 3)
) else (
    if not exist "%CODESYS_EXE%" (
        echo   [WARN] CODESYS.exe не найден по пути:
        echo          %CODESYS_EXE%
        echo          После установки CODESYS — исправьте путь в %CLAUDE_JSON%
    )
    (
        echo {
        echo   "mcpServers": {
        echo     "codesys_local": {
        echo       "type": "stdio",
        echo       "command": "codesys-mcp-tool",
        echo       "args": [
        echo         "--codesys-path",
        echo         "%CODESYS_EXE%",
        echo         "--codesys-profile",
        echo         "CODESYS V3.5 SP17 Patch 3"
        echo       ]
        echo     }
        echo   }
        echo }
    ) > "%CLAUDE_JSON%"
    echo   [OK] Создан %CLAUDE_JSON%
)

REM ─────────────────────────────────────────────────────────────
REM Шаг 5: Python-зависимости
REM ─────────────────────────────────────────────────────────────
echo.
echo [5/5] Установка Python-зависимостей...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo   [WARN] python не найден в PATH — пропускаю.
    echo          Установить Python: https://python.org
) else (
    pip install -r "%PROJECT_DIR%python-bridge\requirements.txt" --quiet
    if %errorlevel% neq 0 (
        echo   [FAIL] Ошибка pip install
        set /a ERRORS+=1
    ) else (
        echo   [OK] asyncua, websockets, pyyaml, psutil установлены
    )
)

REM ─────────────────────────────────────────────────────────────
REM Итог
REM ─────────────────────────────────────────────────────────────
:end
echo.
echo ============================================================
if %ERRORS% equ 0 (
    echo   Готово! Ошибок нет.
    echo.
    echo   Следующие шаги:
    echo   1. Запустить CODESYS Control Win V3 из трея
    echo   2. Открыть новый терминал (перезагрузить PATH)
    echo   3. Запустить: python verify.py
) else (
    echo   Завершено с ошибками: %ERRORS%
    echo   Исправьте ошибки выше и запустите setup.bat снова.
)
echo ============================================================
echo.
pause
