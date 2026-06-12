@echo off
:: ============================================================
::  ACTUALIZAR DATOS - Dashboard CEDI
::  Copia los Excel desde OneDrive a la carpeta del dashboard
::  Programar en Task Scheduler cada 20-30 minutos
:: ============================================================

set ORIGEN=C:\Users\cristian.franco\OneDrive - Comercializadora Inducascos S.A.S\VENTAS WEB\Escritorio\PLANEACION
set DESTINO=C:\DashboardCEDI

echo [%date% %time%] Actualizando datos...

copy /Y "%ORIGEN%\Bandeja de planeaci�n (IDC-IDCWM-INDU2).xlsx" "%DESTINO%\Bandejadeplaneacion.xlsx" >nul
if %errorlevel%==0 (echo   [OK] Bandeja de planeacion) else (echo   [ERROR] Bandeja de planeacion)

copy /Y "%ORIGEN%\Inventario x Posici�n.xlsx" "%DESTINO%\Inventario.xlsx" >nul
if %errorlevel%==0 (echo   [OK] Inventario) else (echo   [ERROR] Inventario)

echo [%date% %time%] Listo.
