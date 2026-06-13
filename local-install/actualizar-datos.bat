@echo off
:: Usa PowerShell para manejar correctamente los caracteres especiales (acentos)
powershell -ExecutionPolicy Bypass -Command "& {
    $origen  = 'C:\Users\cristian.franco\OneDrive - Comercializadora Inducascos S.A.S\VENTAS WEB\Escritorio\PLANEACION'
    $destino = 'C:\DashboardCEDI'
    $archivos = @(
        @{ src = 'Bandeja de planeación (IDC-IDCWM-INDU2).xlsx'; dst = 'Bandejadeplaneacion.xlsx' },
        @{ src = 'Inventario x Posición.xlsx';                    dst = 'Inventario.xlsx' }
    )
    foreach ($a in $archivos) {
        $src = Join-Path $origen $a.src
        $dst = Join-Path $destino $a.dst
        if (Test-Path $src) {
            Copy-Item $src $dst -Force
            Write-Host ('  [OK] ' + $a.dst)
        } else {
            Write-Host ('  [ERROR] No encontrado: ' + $src)
        }
    }
    Write-Host ('Actualizado: ' + (Get-Date -Format 'HH:mm:ss'))
}"
