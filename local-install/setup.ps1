# ============================================================
#  SETUP - Dashboard CEDI Local
#  Ejecutar UNA SOLA VEZ para instalar el dashboard en el PC
# ============================================================

$destino = "C:\DashboardCEDI"
$libs    = "$destino\libs"

function OK  { Write-Host "  [OK] $args" -ForegroundColor Green }
function ERR { Write-Host "  [ERROR] $args" -ForegroundColor Red }
function INF { Write-Host $args -ForegroundColor Cyan }

INF ""
INF "============================================"
INF "  Instalando Dashboard CEDI en $destino"
INF "============================================"
INF ""

# 1. Crear carpetas
INF "Creando carpetas..."
New-Item -ItemType Directory -Force -Path $libs | Out-Null
OK "Carpetas creadas"

# 2. Descargar librerias JavaScript
INF ""
INF "Descargando librerias JavaScript..."
$librerias = @(
    @{ url = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";    file = "react.production.min.js"    },
    @{ url = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"; file = "react-dom.production.min.js" },
    @{ url = "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js";        file = "babel.min.js"               },
    @{ url = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";               file = "xlsx.full.min.js"            }
)

foreach ($lib in $librerias) {
    try {
        Write-Host "  Descargando $($lib.file)..." -NoNewline
        Invoke-WebRequest -Uri $lib.url -OutFile "$libs\$($lib.file)" -UseBasicParsing -ErrorAction Stop
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
        ERR "Fallo: $($_.Exception.Message)"
    }
}

# 3. Descargar index.html desde GitHub
INF ""
INF "Descargando Dashboard desde GitHub..."
try {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sepulvedayeison98-sys/Dashboard/main/index.html" -OutFile "$destino\index.html" -UseBasicParsing -ErrorAction Stop
    OK "index.html descargado"
} catch {
    ERR "No se pudo descargar index.html: $($_.Exception.Message)"
    Read-Host "Presiona Enter para salir"
    exit 1
}

# 4. Reemplazar rutas CDN por rutas locales
INF ""
INF "Configurando rutas locales..."
$html = Get-Content "$destino\index.html" -Raw -Encoding UTF8
$html = $html -replace "https://cdnjs\.cloudflare\.com/ajax/libs/react/18\.3\.1/umd/react\.production\.min\.js", "./libs/react.production.min.js"
$html = $html -replace "https://cdnjs\.cloudflare\.com/ajax/libs/react-dom/18\.3\.1/umd/react-dom\.production\.min\.js", "./libs/react-dom.production.min.js"
$html = $html -replace "https://cdnjs\.cloudflare\.com/ajax/libs/babel-standalone/7\.23\.5/babel\.min\.js", "./libs/babel.min.js"
$html = $html -replace "https://cdnjs\.cloudflare\.com/ajax/libs/xlsx/0\.18\.5/xlsx\.full\.min\.js", "./libs/xlsx.full.min.js"
[System.IO.File]::WriteAllText("$destino\index.html", $html, [System.Text.Encoding]::UTF8)
OK "Rutas actualizadas"

# 5. Crear abrir-dashboard.bat
INF ""
INF "Creando acceso directo..."
$bat = @'
@echo off
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --allow-file-access-from-files "%~dp0index.html"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --allow-file-access-from-files "%~dp0index.html"
) else (
    start "" "msedge.exe" --allow-file-access-from-files "%~dp0index.html"
)
'@
Set-Content "$destino\abrir-dashboard.bat" $bat -Encoding ASCII
OK "abrir-dashboard.bat creado"

# 6. Crear actualizar-dashboard.bat (para futuras actualizaciones del HTML)
$actualizar = @'
@echo off
echo Actualizando Dashboard desde GitHub...
powershell -ExecutionPolicy Bypass -Command "& { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sepulvedayeison98-sys/Dashboard/main/index.html' -OutFile 'C:\DashboardCEDI\index_nuevo.html' -UseBasicParsing; $h = Get-Content 'C:\DashboardCEDI\index_nuevo.html' -Raw; $h = $h -replace 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js','./libs/react.production.min.js'; $h = $h -replace 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js','./libs/react-dom.production.min.js'; $h = $h -replace 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js','./libs/babel.min.js'; $h = $h -replace 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','./libs/xlsx.full.min.js'; [System.IO.File]::WriteAllText('C:\DashboardCEDI\index.html', $h, [System.Text.Encoding]::UTF8); Remove-Item 'C:\DashboardCEDI\index_nuevo.html' }"
echo Listo!
pause
'@
Set-Content "$destino\actualizar-dashboard.bat" $actualizar -Encoding ASCII
OK "actualizar-dashboard.bat creado"

# ── Resumen final ──────────────────────────────────────────
INF ""
INF "============================================"
INF "  INSTALACION COMPLETADA"
INF ""
INF "  Carpeta: $destino"
INF ""
INF "  Para abrir el dashboard:"
INF "  -> Doble click en abrir-dashboard.bat"
INF ""
INF "  Para actualizar cuando haya cambios:"
INF "  -> Doble click en actualizar-dashboard.bat"
INF "============================================"
INF ""
Read-Host "Presiona Enter para cerrar"
