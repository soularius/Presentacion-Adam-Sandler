@echo off
REM Prueba LOCAL del control remoto: levanta el servidor Python y abre la pantalla (/) y el control (/admin).
REM Para detenerlo: cierra esta ventana o presiona Ctrl+C.
cd /d "%~dp0"
chcp 65001 >nul

set "ADMIN_PASSWORD="
set /p "ADMIN_PASSWORD=Escribe la clave para /admin (Enter = prueba123): "
if "%ADMIN_PASSWORD%"=="" set "ADMIN_PASSWORD=prueba123"

echo.
echo Instalando/verificando dependencias (solo tarda la primera vez)...
python -m pip install -q -r server\requirements.txt

echo.
echo ==============================================================
echo   PANTALLA (el computador del salon):  http://localhost:8000/
echo   CONTROL  (con la clave):             http://localhost:8000/admin
echo.
echo   Desde el CELULAR (mismo wifi), cambia "localhost" por la IP de este PC:
ipconfig | findstr /i "IPv4"
echo   ejemplo:  http://192.168.1.50:8000/admin
echo   (si Windows pregunta por el firewall, da "Permitir" en redes privadas)
echo ==============================================================
echo.

REM abre las dos pestanas cuando el servidor ya este arriba
start "" cmd /c "timeout /t 3 >nul & start http://localhost:8000/ & start http://localhost:8000/admin"

python -m uvicorn app:app --app-dir server --host 0.0.0.0 --port 8000
pause
