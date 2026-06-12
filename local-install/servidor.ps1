# Servidor HTTP local para el Dashboard CEDI
# Se ejecuta en segundo plano — no cerrar la ventana mientras usas el dashboard

$raiz  = "C:\DashboardCEDI"
$puerto = 8080

$servidor = New-Object System.Net.HttpListener
$servidor.Prefixes.Add("http://localhost:$puerto/")

try {
    $servidor.Start()
} catch {
    Write-Host "ERROR: No se pudo iniciar el servidor en el puerto $puerto"
    Write-Host "Verifica que no haya otro proceso usando ese puerto."
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

Write-Host "Servidor Dashboard corriendo en http://localhost:$puerto"
Write-Host "No cierres esta ventana mientras usas el dashboard."
Write-Host "(Para cerrar el servidor, cierra esta ventana)"

while ($servidor.IsListening) {
    try {
        $ctx  = $servidor.GetContext()
        $ruta = $ctx.Request.Url.LocalPath
        $file = Join-Path $raiz ($ruta.TrimStart('/').Replace('/', '\'))
        $resp = $ctx.Response

        # Agregar cabeceras CORS para que el browser no bloquee
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
            $resp.ContentType      = $mime
            $resp.ContentLength64  = $bytes.Length
            $resp.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $resp.StatusCode = 404
        }
        $resp.Close()
    } catch {
        # Ignorar errores de conexiones abortadas por el browser
    }
}
