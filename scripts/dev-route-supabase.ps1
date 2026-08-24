<#
.SYNOPSIS
  Enruta el trafico al pooler de Supabase por el hotspot Wi-Fi, dejando el resto
  del trafico en la red corporativa.

.DESCRIPTION
  La red corporativa filtra toda salida TCP que no sea 80/443, asi que la
  conexion Postgres de Drizzle (puerto 6543 del pooler de Supabase) muere con
  "write CONNECT_TIMEOUT ...:6543" y cualquier pagina que lea datos devuelve 500.

  Este script crea rutas estaticas /32 hacia las IPs actuales del pooler por el
  adaptador Wi-Fi (hotspot), de forma que SOLO ese trafico sale por datos
  moviles. El resto -- incluida la red interna -- sigue por el cable.

  Es un apanyo local. La solucion definitiva es pedir a Sistemas la apertura de
  6543/5432 salientes hacia *.pooler.supabase.com.

  Trampas conocidas:
    - Las IPs del pooler son de un balanceador de AWS y ROTAN. Si vuelve el
      CONNECT_TIMEOUT, lo primero es re-ejecutar este script.
    - Reconectar el hotspot cambia gateway e IP local -> re-ejecutar.
    - postgres-js reutiliza el cliente entre recargas (globalForDb en
      src/db/index.ts), asi que las rutas deben estar puestas ANTES de arrancar
      `next dev`. Si las anyades con el server en marcha, reinicialo.

  Las rutas se crean en el ActiveStore: no sobreviven a un reinicio, a proposito.

.PARAMETER Remove
  Borra las rutas creadas previamente y deja la maquina como estaba.

.EXAMPLE
  # En PowerShell COMO ADMINISTRADOR, con el hotspot conectado:
  .\scripts\dev-route-supabase.ps1
  npm run dev

.EXAMPLE
  .\scripts\dev-route-supabase.ps1 -Remove
#>
[CmdletBinding()]
param(
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$StateFile = Join-Path $env:LOCALAPPDATA 'areto-dev-routes.json'

function Fail($msg) {
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "crear rutas requiere privilegios. Abre PowerShell como administrador y vuelve a ejecutar este script."
  }
}

function Get-PoolerEndpoint {
  # Leemos DATABASE_URL de .env.local para no hardcodear la region del pooler.
  $envPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env.local'
  if (-not (Test-Path $envPath)) { Fail "no encuentro $envPath. Copia .env.example a .env.local primero." }

  $line = Select-String -Path $envPath -Pattern '^\s*DATABASE_URL\s*=' | Select-Object -Last 1
  if (-not $line) { Fail "DATABASE_URL no esta definida en $envPath." }

  $value = ($line.Line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
  # `.*@` es greedy a proposito: se queda con el ultimo @, por si la contrasenya lleva uno.
  if ($value -notmatch '^postgres(?:ql)?://.*@([^:/@]+):(\d+)') {
    Fail "no consigo extraer host y puerto de DATABASE_URL. Debe ser postgresql://usuario:password@host:puerto/base."
  }
  [pscustomobject]@{ DbHost = $Matches[1]; Port = [int]$Matches[2] }
}

function Get-HotspotRoute {
  $wifi = Get-NetAdapter |
    Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -match 'Wi-Fi|Wireless|802\.11' } |
    Select-Object -First 1
  if (-not $wifi) { Fail "no hay ningun adaptador Wi-Fi activo. Conecta el hotspot y reintenta." }

  $gw = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.ifIndex -eq $wifi.InterfaceIndex } |
    Select-Object -First 1
  if (-not $gw) { Fail "el adaptador '$($wifi.Name)' esta levantado pero no tiene puerta de enlace. Reconecta el hotspot." }

  [pscustomobject]@{
    Alias   = $wifi.Name
    IfIndex = $wifi.InterfaceIndex
    NextHop = $gw.NextHop
  }
}

function Resolve-Ipv4($hostname) {
  try {
    $addrs = [System.Net.Dns]::GetHostAddresses($hostname) |
      Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
      ForEach-Object { $_.IPAddressToString }
  } catch {
    Fail "no puedo resolver ${hostname}: $($_.Exception.Message)"
  }
  if (-not $addrs) { Fail "$hostname no tiene registros A (IPv4)." }
  @($addrs | Sort-Object -Unique)
}

function Remove-DevRoute($prefix) {
  $existing = Get-NetRoute -DestinationPrefix $prefix -PolicyStore ActiveStore -ErrorAction SilentlyContinue
  if ($existing) {
    $existing | Remove-NetRoute -Confirm:$false -PolicyStore ActiveStore -ErrorAction SilentlyContinue
    return $true
  }
  return $false
}

function Test-Port($ip, $port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($ip, $port, $null, $null)
    return ($iar.AsyncWaitHandle.WaitOne(6000, $false) -and $client.Connected)
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

Assert-Admin
$endpoint = Get-PoolerEndpoint

# --- Limpieza -----------------------------------------------------------------
if ($Remove) {
  $prefixes = @()
  if (Test-Path $StateFile) {
    $prefixes += (Get-Content $StateFile -Raw | ConvertFrom-Json).Prefixes
  }
  # Union con las IPs actuales, por si rotaron despues de crear las rutas.
  $prefixes += (Resolve-Ipv4 $endpoint.DbHost | ForEach-Object { "$_/32" })
  $prefixes = @($prefixes | Sort-Object -Unique)

  $removed = 0
  foreach ($p in $prefixes) {
    if (Remove-DevRoute $p) { Write-Host "  borrada  $p"; $removed++ }
  }
  Remove-Item $StateFile -ErrorAction SilentlyContinue
  Write-Host ""
  Write-Host "$removed ruta(s) eliminadas. El trafico al pooler vuelve a salir por la red corporativa." -ForegroundColor Yellow
  exit 0
}

# --- Alta de rutas ------------------------------------------------------------
$hotspot = Get-HotspotRoute
$ips = Resolve-Ipv4 $endpoint.DbHost

Write-Host "Pooler : $($endpoint.DbHost):$($endpoint.Port)"
Write-Host "Hotspot: $($hotspot.Alias) (ifIndex $($hotspot.IfIndex)) via $($hotspot.NextHop)"
Write-Host ""

$prefixes = @()
$failed = 0
foreach ($ip in $ips) {
  $prefix = "$ip/32"
  Remove-DevRoute $prefix | Out-Null   # idempotente
  New-NetRoute -DestinationPrefix $prefix `
               -InterfaceIndex $hotspot.IfIndex `
               -NextHop $hotspot.NextHop `
               -RouteMetric 1 `
               -PolicyStore ActiveStore | Out-Null
  $prefixes += $prefix

  $via = (Find-NetRoute -RemoteIPAddress $ip | Select-Object -Last 1).InterfaceAlias
  $open = Test-Port $ip $endpoint.Port
  if (-not $open) { $failed++ }
  $mark = if ($open) { 'OK' } else { 'FALLO' }
  $color = if ($open) { 'Green' } else { 'Red' }
  Write-Host ("  {0,-18} via {1,-16} puerto {2}: {3}" -f $prefix, $via, $endpoint.Port, $mark) -ForegroundColor $color
}

[pscustomobject]@{ Prefixes = $prefixes } | ConvertTo-Json | Set-Content -Path $StateFile -Encoding utf8

Write-Host ""
if ($failed -gt 0) {
  Write-Host "$failed de $($ips.Count) IPs siguen sin conectar. Comprueba que el hotspot tiene datos y reintenta." -ForegroundColor Yellow
} else {
  Write-Host "Listo. Arranca ahora 'npm run dev' (si ya estaba en marcha, reinicialo)." -ForegroundColor Green
}
Write-Host "Para deshacerlo: .\scripts\dev-route-supabase.ps1 -Remove"
