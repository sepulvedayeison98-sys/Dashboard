@echo off
:: ============================================================
::  ABRIR DASHBOARD CEDI
::  Doble click para abrir el dashboard
:: ============================================================

:: 1. Actualizar los datos antes de abrir
echo Copiando datos actualizados...
powershell -ExecutionPolicy Bypass -File "C:\DashboardCEDI\actualizar-datos.ps1"

:: 2. Verificar si el servidor ya esta corriendo en puerto 9090
netstat -an | find "9090" | find "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo Servidor ya en ejecucion.
) else (
    echo Iniciando servidor local...
    powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File C:\DashboardCEDI\servidor.ps1' -Verb RunAs -WindowStyle Normal"
    timeout /t 3 /nobreak >nul
)

:: 3. Abrir el dashboard en el navegador
echo Abriendo Dashboard...
start "" "http://localhost:9090/index.html"
