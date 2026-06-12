# ============================================================
#  SETUP COMPLETO - Dashboard CEDI Local
#  Ejecutar UNA SOLA VEZ para instalar todo
# ============================================================

$destino = "C:\DashboardCEDI"
$libs    = "$destino\libs"
$origen  = "C:\Users\cristian.franco\OneDrive - Comercializadora Inducascos S.A.S\VENTAS WEB\Escritorio\PLANEACION"

function OK  { Write-Host "  [OK] $args" -ForegroundColor Green }
function ERR { Write-Host "  [ERROR] $args" -ForegroundColor Red }
function INF { param([string]$msg,[string]$col="Cyan") Write-Host $msg -ForegroundColor $col }

INF ""
INF "============================================"
INF "  Instalando Dashboard CEDI en $destino"
INF "============================================"
INF ""

# 1. Crear carpetas
INF "Creando estructura de carpetas..."
New-Item -ItemType Directory -Force -Path $destino | Out-Null
New-Item -ItemType Directory -Force -Path $libs    | Out-Null
OK "Carpetas listas"

# 2. Descargar librerias JavaScript (una sola vez)
INF ""
INF "Descargando librerias JavaScript (requiere internet una sola vez)..."
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
        ERR "$($lib.file): $($_.Exception.Message)"
    }
}

# 3. Copiar index.html (version local)
INF ""
INF "Copiando archivos del dashboard..."
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
try {
    Copy-Item "$scriptDir\index.html"          "$destino\index.html"          -Force
    Copy-Item "$scriptDir\servidor.ps1"        "$destino\servidor.ps1"        -Force
    Copy-Item "$scriptDir\abrir-dashboard.bat" "$destino\abrir-dashboard.bat" -Force
    Copy-Item "$scriptDir\actualizar-datos.bat" "$destino\actualizar-datos.bat" -Force
    OK "Archivos del dashboard copiados"
} catch {
    ERR "Error copiando archivos: $($_.Exception.Message)"
}

# 4. Copiar los Excel desde OneDrive
INF ""
INF "Copiando archivos Excel..."
$excels = @(
    @{ src = "$origen\Bandeja de planeaci$([char]243)n (IDC-IDCWM-INDU2).xlsx"; dst = "$destino\Bandejadeplaneacion.xlsx" },
    @{ src = "$origen\Inventario x Posici$([char]243)n.xlsx";                   dst = "$destino\Inventario.xlsx" }
)
foreach ($e in $excels) {
    if (Test-Path $e.src) {
        Copy-Item $e.src $e.dst -Force
        OK ([System.IO.Path]::GetFileName($e.dst))
    } else {
        ERR "No encontrado: $($e.src)"
        INF "  Verifica que la ruta del archivo sea correcta" "Yellow"
    }
}

# 5. Crear acceso directo en el Escritorio
INF ""
INF "Creando acceso directo en el Escritorio..."
try {
    $escritorio = [System.Environment]::GetFolderPath("Desktop")
    $wsh  = New-Object -ComObject WScript.Shell
    $link = $wsh.CreateShortcut("$escritorio\Dashboard CEDI.lnk")
    $link.TargetPath       = "$destino\abrir-dashboard.bat"
    $link.WorkingDirectory = $destino
    $link.Description      = "Abrir Dashboard CEDI"
    $link.Save()
    OK "Acceso directo creado en el Escritorio"
} catch {
    ERR "No se pudo crear el acceso directo: $($_.Exception.Message)"
}

# 6. Configurar Task Scheduler para actualizar datos cada 20 min
INF ""
INF "Configurando actualizacion automatica cada 20 minutos..."
try {
    $trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 20) -Once -At (Get-Date)
    $action  = New-ScheduledTaskAction -Execute "$destino\actualizar-datos.bat"
    $settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable:$false -StartWhenAvailable
    Register-ScheduledTask -TaskName "Dashboard CEDI - Actualizar datos" `
        -Trigger $trigger -Action $action -Settings $settings `
        -Description "Copia los Excel de OneDrive al dashboard cada 20 minutos" `
        -Force | Out-Null
    OK "Tarea programada creada (cada 20 min)"
} catch {
    ERR "No se pudo crear la tarea programada: $($_.Exception.Message)"
    INF "  Puedes crearla manualmente en el Programador de tareas" "Yellow"
}

# ── Resumen ───────────────────────────────────────────────
INF ""
INF "============================================" "Green"
INF "  INSTALACION COMPLETADA" "Green"
INF "" "Green"
INF "  Para abrir el dashboard:" "White"
INF "  -> Doble click en 'Dashboard CEDI' del Escritorio" "White"
INF "  -> O en C:\DashboardCEDI\abrir-dashboard.bat" "White"
INF ""
INF "  Los datos se actualizan automaticamente" "White"
INF "  cada 20 minutos desde OneDrive." "White"
INF "============================================" "Green"
INF ""
Read-Host "Presiona Enter para cerrar"
