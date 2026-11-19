@echo off
REM Abre la presentacion con un mini servidor local (para que los videos de YouTube se vean dentro).
REM Si no hay Python, abre el archivo directamente (los videos se abren en YouTube con el boton rojo).
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8765/index.html"
  python -m http.server 8765
) else (
  start "" "index.html"
)
