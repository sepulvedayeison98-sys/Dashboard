# Servidor HTTP local para el Dashboard CEDI
# Accesible desde cualquier PC en la misma red de la empresa

$raiz   = "C:\DashboardCEDI"
$puerto = 9090

# Obtener IP local del PC
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | Select-Object -First 1).IPAddress

$servidor = New-Object System.Net.HttpListener
$servidor.Prefixes.Add("http://+:$puerto/")

# Abrir el puerto en el Firewall de Windows automáticamente
try {
    netsh advfirewall firewall delete rule name="Dashboard CEDI" | Out-Null
    netsh advfirewall firewall add rule name="Dashboard CEDI" dir=in action=allow protocol=TCP localport=$puerto | Out-Null
} catch {}

try {
    $servidor.Start()
} catch {
    Write-Host "ERROR: No se pudo iniciar el servidor en el puerto $puerto"
    Write-Host "Intenta ejecutar PowerShell como Administrador."
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  SERVIDOR DASHBOARD CEDI ACTIVO" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Tu acceso:      http://localhost:$puerto/index.html" -ForegroundColor Cyan
Write-Host "  Comparte este:  http://${ip}:$puerto/index.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Cualquier PC del mismo WiFi puede abrir ese link." -ForegroundColor White
Write-Host ""
Write-Host "  NO cierres esta ventana mientras usas el dashboard." -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

while ($servidor.IsListening) {
    try {
        $ctx  = $servidor.GetContext()
        $ruta = $ctx.Request.Url.LocalPath
        $file = Join-Path $raiz ($ruta.TrimStart('/').Replace('/', '\'))
        $resp = $ctx.Response

        $resp.Headers.Add("Access-Control-Allow-Origin", "*")
        $resp.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")

        if (Test-Path $file -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ext   = [System.IO.Path]::GetExtension($file).ToLower()
            $mime  = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.js'   { 'application/javascript' }
                '.xlsx' { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                '.png'  { 'image/png' }
                '.json' { 'application/json' }
                '.css'  { 'text/css' }
                default { 'application/octet-stream' }
            }
            $resp.ContentType     = $mime
            $resp.ContentLength64 = $bytes.Length
            $resp.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $resp.StatusCode = 404
        }
        $resp.Close()
    } catch {}
}
