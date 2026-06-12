@echo off
:: ============================================================
::  ABRIR DASHBOARD CEDI
::  Doble click para abrir el dashboard
:: ============================================================

:: 1. Actualizar los datos antes de abrir
echo Copiando datos actualizados...
call "C:\DashboardCEDI\actualizar-datos.bat"

:: 2. Verificar si el servidor ya esta corriendo en puerto 8080
netstat -an | find "8080" | find "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo Servidor ya en ejecucion.
) else (
    echo Iniciando servidor local...
    start "Servidor Dashboard" /MIN powershell -ExecutionPolicy Bypass -File "C:\DashboardCEDI\servidor.ps1"
    timeout /t 2 /nobreak >nul
)

:: 3. Abrir el dashboard en el navegador
echo Abriendo Dashboard...
start "" "http://localhost:8080/index.html"
