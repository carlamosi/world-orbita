# ═══════════════════════════════════════════════════════════════════
#  setup-vercel-env.ps1
#  Configura las variables de entorno de Supabase en Vercel via API
#  y lanza un redeploy del proyecto world-orbita.
#
#  USO:
#    1. Ve a https://vercel.com/account/tokens → "Create Token"
#    2. Dale un nombre (ej: "world-orbita-setup") y crea el token
#    3. Ejecuta: .\setup-vercel-env.ps1 -VercelToken "tu_token_aqui"
# ═══════════════════════════════════════════════════════════════════
param(
    [Parameter(Mandatory=$true)]
    [string]$VercelToken
)

$PROJECT_NAME = "world-orbita"
$SUPABASE_URL = "https://aqwfmmhfiqjvyaufjcsk.supabase.co"
$SUPABASE_KEY = "sb_publishable_3JgXV9bcjTgqwxT5-zm0gQ_h7PvMAES"

$headers = @{
    "Authorization" = "Bearer $VercelToken"
    "Content-Type"  = "application/json"
}

Write-Host "`n🌍 world-orbita — Configurando Vercel Environment Variables`n" -ForegroundColor Cyan

# 1. Obtener project ID
Write-Host "🔍 Buscando proyecto '$PROJECT_NAME' en Vercel..." -ForegroundColor Yellow
$projects = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects" -Headers $headers
$project = $projects.projects | Where-Object { $_.name -eq $PROJECT_NAME } | Select-Object -First 1

if (-not $project) {
    Write-Host "❌ No se encontró el proyecto '$PROJECT_NAME' en tu cuenta de Vercel." -ForegroundColor Red
    Write-Host "   Asegúrate de que el token tiene acceso al proyecto correcto." -ForegroundColor Red
    exit 1
}

$PROJECT_ID = $project.id
Write-Host "✅ Proyecto encontrado: $PROJECT_ID" -ForegroundColor Green

# 2. Variables a configurar
$envVars = @(
    @{ key = "VITE_SUPABASE_URL";               value = $SUPABASE_URL; type = "plain" },
    @{ key = "SUPABASE_URL";                     value = $SUPABASE_URL; type = "plain" },
    @{ key = "VITE_SUPABASE_PUBLISHABLE_KEY";    value = $SUPABASE_KEY; type = "sensitive" },
    @{ key = "SUPABASE_PUBLISHABLE_KEY";         value = $SUPABASE_KEY; type = "sensitive" }
)

$targets = @("production", "preview", "development")

# 3. Eliminar variables existentes con el mismo nombre (para evitar duplicados)
Write-Host "`n🗑️  Limpiando variables existentes..." -ForegroundColor Yellow
$existingEnv = Invoke-RestMethod `
    -Uri "https://api.vercel.com/v9/projects/$PROJECT_ID/env" `
    -Headers $headers

foreach ($existing in $existingEnv.envs) {
    $match = $envVars | Where-Object { $_.key -eq $existing.key }
    if ($match) {
        Invoke-RestMethod `
            -Uri "https://api.vercel.com/v9/projects/$PROJECT_ID/env/$($existing.id)" `
            -Method DELETE `
            -Headers $headers | Out-Null
        Write-Host "  🗑️  Eliminada: $($existing.key)" -ForegroundColor DarkGray
    }
}

# 4. Crear las variables en todos los entornos
Write-Host "`n📦 Creando variables de entorno..." -ForegroundColor Yellow
foreach ($envVar in $envVars) {
    $body = @{
        key    = $envVar.key
        value  = $envVar.value
        type   = $envVar.type
        target = $targets
    } | ConvertTo-Json

    try {
        Invoke-RestMethod `
            -Uri "https://api.vercel.com/v9/projects/$PROJECT_ID/env" `
            -Method POST `
            -Headers $headers `
            -Body $body | Out-Null

        $display = if ($envVar.type -eq "sensitive") { "***" } else { $envVar.value }
        Write-Host "  ✅ $($envVar.key) = $display" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Error creando $($envVar.key): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 5. Obtener el último deployment y hacer redeploy
Write-Host "`n🚀 Lanzando redeploy en Vercel..." -ForegroundColor Yellow
$deployments = Invoke-RestMethod `
    -Uri "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&limit=1" `
    -Headers $headers

$latestDeployment = $deployments.deployments | Select-Object -First 1

if ($latestDeployment) {
    $redeployBody = @{
        deploymentId = $latestDeployment.uid
        name         = $PROJECT_NAME
        target       = "production"
    } | ConvertTo-Json

    try {
        $redeploy = Invoke-RestMethod `
            -Uri "https://api.vercel.com/v13/deployments" `
            -Method POST `
            -Headers $headers `
            -Body $redeployBody

        Write-Host "  ✅ Redeploy iniciado: $($redeploy.url)" -ForegroundColor Green
        Write-Host "`n🌐 La app estará disponible en unos minutos en:" -ForegroundColor Cyan
        Write-Host "   https://$($redeploy.url)" -ForegroundColor White
    }
    catch {
        Write-Host "  ⚠️  El redeploy manual falló (es normal si Vercel ya lo detectó automáticamente)" -ForegroundColor Yellow
        Write-Host "  El push a GitHub ya debería haber disparado el redeploy automático." -ForegroundColor Yellow
    }
}

Write-Host "`n═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✨ Configuración completa. Vercel desplegará con las nuevas vars." -ForegroundColor Green
Write-Host "     Ve a https://vercel.com/dashboard para seguir el progreso." -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
