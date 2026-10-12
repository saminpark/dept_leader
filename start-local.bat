@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 serve.py
    goto :end
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python serve.py
    goto :end
)
echo Python 3가 필요합니다. 또는 GitHub Pages에 docs 폴더를 배포하세요.
:end
pause
