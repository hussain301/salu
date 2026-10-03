<#
.SYNOPSIS
    Installs, configures, and manages the Next.js standalone application as a Windows Service using NSSM.

.DESCRIPTION
    Shah Abdul Latif University (SALU) Web Portal Windows Service Manager.
    Configures the standalone Next.js 16 + Payload CMS 3.90.2 application as a resilient background
    Windows Service with auto-restart on failure, log rotation to logs/, and production environment variables.

.PARAMETER Action
    Action to perform: Install (default), Uninstall, Start, Stop, Restart, Status.

.PARAMETER ServiceName
    Name of the Windows Service. Default: SALU-Website.

.PARAMETER DisplayName
    User-friendly display name in Windows Services Manager.

.PARAMETER Port
    HTTP port the Next.js standalone instance will bind to. Default: 3000.

.PARAMETER NodeEnv
    Node environment mode. Default: production.

.PARAMETER NssmPath
    Explicit path to nssm.exe. If omitted, searches PATH and standard installation paths.

.PARAMETER NodePath
    Explicit path to node.exe. If omitted, searches PATH and Program Files.

.PARAMETER ProjectDir
    Root directory of the project. Defaults to the repository root.

.PARAMETER SkipAssetCopy
    If specified, skips copying .next/static and public into the .next/standalone bundle.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Install
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Status
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Restart
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [ValidateSet('Install', 'Uninstall', 'Start', 'Stop', 'Restart', 'Status')]
    [string]$Action = 'Install',

    [string]$ServiceName = 'SALU-Website',
    [string]$DisplayName = 'Shah Abdul Latif University (SALU) Web Portal',
    [int]$Port = 3000,
    [string]$NodeEnv = 'production',
    [string]$NssmPath = '',
    [string]$NodePath = '',
    [string]$ProjectDir = '',
    [switch]$SkipAssetCopy
)

# Set error handling preference
$ErrorActionPreference = 'Stop'

function Write-Step {
    param ([string]$Message)
    Write-Host "[SALU-SERVICE] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param ([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param ([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-ErrMsg {
    param ([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 1. Verify Administrative Privileges
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and $Action -ne 'Status') {
    Write-ErrMsg "This script requires Administrator privileges to modify Windows Services."
    Write-Host "Please reopen PowerShell as Administrator ('Run as administrator') and re-run this script." -ForegroundColor Yellow
    exit 1
}

# 2. Resolve Project Root
if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
    $ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectDir = (Resolve-Path $ProjectDir).Path
}
Write-Step "Working directory: $ProjectDir"

# 3. Locate node.exe
if ([string]::IsNullOrWhiteSpace($NodePath)) {
    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $NodePath = $nodeCmd.Source
    } elseif (Test-Path "C:\Program Files\nodejs\node.exe") {
        $NodePath = "C:\Program Files\nodejs\node.exe"
    } elseif (Test-Path "$env:LOCALAPPDATA\Programs\node\node.exe") {
        $NodePath = "$env:LOCALAPPDATA\Programs\node\node.exe"
    } else {
        Write-ErrMsg "node.exe was not found in PATH or standard installation directories."
        Write-Host "Please install Node.js (>=20.9.0) or specify -NodePath 'C:\path\to\node.exe'." -ForegroundColor Yellow
        exit 1
    }
}
Write-Step "Node.js executable: $NodePath"

# 4. Locate nssm.exe
if ([string]::IsNullOrWhiteSpace($NssmPath)) {
    $nssmCmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($nssmCmd) {
        $NssmPath = $nssmCmd.Source
    } else {
        $candidatePaths = @(
            (Join-Path $ProjectDir "tools\nssm.exe"),
            (Join-Path $ProjectDir "tools\nssm\win64\nssm.exe"),
            (Join-Path $ProjectDir "scripts\nssm.exe"),
            "C:\ProgramData\chocolatey\bin\nssm.exe",
            "C:\tools\nssm\win64\nssm.exe",
            "C:\tools\nssm.exe",
            "C:\nssm\win64\nssm.exe"
        )
        foreach ($candidate in $candidatePaths) {
            if (Test-Path $candidate) {
                $NssmPath = (Resolve-Path $candidate).Path
                break
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($NssmPath) -or -not (Test-Path $NssmPath)) {
    Write-ErrMsg "NSSM (Non-Sucking Service Manager) was not found."
    Write-Host @"
NSSM is required to register and supervise Windows Services.
To install NSSM:
  - Via Winget:   winget install NSSM.NSSM
  - Via Scoop:    scoop install nssm
  - Via Choco:    choco install nssm
  - Direct download: Download from https://nssm.cc/download, extract win64\nssm.exe to $ProjectDir\tools\nssm.exe
  - Or specify path: .\scripts\setup-service.ps1 -NssmPath 'C:\path\to\nssm.exe'
"@ -ForegroundColor Yellow
    exit 1
}
Write-Step "NSSM executable: $NssmPath"

# 5. Define File & Directory Paths
$logsDir = Join-Path $ProjectDir "logs"
$dataDir = Join-Path $ProjectDir "data"
$mediaDir = Join-Path $ProjectDir "media"
$standaloneDir = Join-Path $ProjectDir ".next\standalone"
$serverJs = Join-Path $standaloneDir "server.js"
$staticSourceDir = Join-Path $ProjectDir ".next\static"
$publicSourceDir = Join-Path $ProjectDir "public"

# Ensure critical application directories exist
foreach ($dir in @($logsDir, $dataDir, $mediaDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Step "Created directory: $dir"
    }
}

# 6. Parse .env for Configuration Secrets
$envFile = Join-Path $ProjectDir ".env"
$payloadSecret = "change-me-to-a-long-random-string"
$databaseUri = "file:./data/salu.db"
$siteUrl = "http://localhost:$Port"

if (Test-Path $envFile) {
    Write-Step "Loading environment variables from $envFile"
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $split = $line.Split('=', 2)
            if ($split.Length -eq 2) {
                $key = $split[0].Trim()
                $val = $split[1].Trim()
                if ($key -eq "PAYLOAD_SECRET" -and $val) { $payloadSecret = $val }
                if ($key -eq "DATABASE_URI" -and $val) { $databaseUri = $val }
                if ($key -eq "NEXT_PUBLIC_SITE_URL" -and $val) { $siteUrl = $val }
            }
        }
    }
}

# 7. Action Execution Dispatcher
switch ($Action) {
    'Status' {
        Write-Step "Checking status of service '$ServiceName'..."
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($null -eq $svc) {
            Write-WarnMsg "Service '$ServiceName' is NOT installed."
        } else {
            Write-Host "Service Name   : $($svc.Name)" -ForegroundColor Green
            Write-Host "Display Name   : $($svc.DisplayName)" -ForegroundColor Green
            Write-Host "Current Status : $($svc.Status)" -ForegroundColor ($svc.Status -eq 'Running' ? 'Green' : 'Yellow')
            Write-Host "Start Type     : $($svc.StartType)" -ForegroundColor Green
            & $NssmPath status $ServiceName
        }
    }

    'Start' {
        Write-Step "Starting service '$ServiceName'..."
        & $NssmPath start $ServiceName
        Start-Sleep -Seconds 2
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') {
            Write-Success "Service '$ServiceName' is RUNNING."
        } else {
            Write-WarnMsg "Service status: $($svc.Status). Check $logsDir\salu_error.log for details."
        }
    }

    'Stop' {
        Write-Step "Stopping service '$ServiceName'..."
        & $NssmPath stop $ServiceName
        Write-Success "Service '$ServiceName' stopped."
    }

    'Restart' {
        Write-Step "Restarting service '$ServiceName'..."
        & $NssmPath restart $ServiceName
        Start-Sleep -Seconds 2
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        Write-Success "Service '$ServiceName' restarted (Status: $($svc.Status))."
    }

    'Uninstall' {
        Write-Step "Uninstalling service '$ServiceName'..."
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($null -ne $svc) {
            if ($svc.Status -eq 'Running') {
                Write-Step "Stopping running service before removal..."
                & $NssmPath stop $ServiceName
            }
            & $NssmPath remove $ServiceName confirm
            Write-Success "Service '$ServiceName' successfully removed."
        } else {
            Write-WarnMsg "Service '$ServiceName' does not exist."
        }
    }

    'Install' {
        Write-Step "Validating build artifacts..."
        if (-not (Test-Path $serverJs)) {
            Write-ErrMsg "Standalone server bundle not found at '$serverJs'."
            Write-Host "Please build the application first by running:" -ForegroundColor Yellow
            Write-Host "  npm.cmd run build" -ForegroundColor White
            exit 1
        }

        # Stage Next.js Standalone Assets (Copy .next/static and public into standalone)
        if (-not $SkipAssetCopy) {
            Write-Step "Staging static assets for standalone deployment..."
            $standaloneStaticDest = Join-Path $standaloneDir ".next\static"
            $standalonePublicDest = Join-Path $standaloneDir "public"

            if (Test-Path $staticSourceDir) {
                Write-Step "Copying .next\static -> $standaloneStaticDest"
                if (-not (Test-Path $standaloneStaticDest)) {
                    New-Item -ItemType Directory -Path $standaloneStaticDest -Force | Out-Null
                }
                Copy-Item -Path "$staticSourceDir\*" -Destination $standaloneStaticDest -Recurse -Force
            }

            if (Test-Path $publicSourceDir) {
                Write-Step "Copying public -> $standalonePublicDest"
                if (-not (Test-Path $standalonePublicDest)) {
                    New-Item -ItemType Directory -Path $standalonePublicDest -Force | Out-Null
                }
                Copy-Item -Path "$publicSourceDir\*" -Destination $standalonePublicDest -Recurse -Force
            }
            Write-Success "Static asset staging completed."
        }

        # Check if service already exists
        $existingSvc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($null -ne $existingSvc) {
            Write-WarnMsg "Service '$ServiceName' already exists. Updating existing configuration..."
            if ($existingSvc.Status -eq 'Running') {
                & $NssmPath stop $ServiceName
            }
        } else {
            Write-Step "Registering new service '$ServiceName' with NSSM..."
            & $NssmPath install $ServiceName "$NodePath"
        }

        # Configure NSSM application parameters
        Write-Step "Configuring application execution parameters..."
        & $NssmPath set $ServiceName AppDirectory "$ProjectDir"
        & $NssmPath set $ServiceName AppParameters ".next\standalone\server.js"
        & $NssmPath set $ServiceName DisplayName "$DisplayName"
        & $NssmPath set $ServiceName Description "Shah Abdul Latif University (SALU) Next.js 16 + Payload CMS 3.90.2 Production Service"

        # Configure Environment Variables
        Write-Step "Setting service environment variables (PORT=$Port, NODE_ENV=$NodeEnv)..."
        $envVars = @(
            "PORT=$Port",
            "NODE_ENV=$NodeEnv",
            "DATABASE_URI=$databaseUri",
            "NEXT_PUBLIC_SITE_URL=$siteUrl",
            "PAYLOAD_SECRET=$payloadSecret"
        )
        & $NssmPath set $ServiceName AppEnvironmentExtra $envVars

        # Configure Log Redirection & Automatic Rotation
        Write-Step "Configuring log rotation in $logsDir..."
        $stdoutLog = Join-Path $logsDir "salu_service.log"
        $stderrLog = Join-Path $logsDir "salu_error.log"

        & $NssmPath set $ServiceName AppStdout "$stdoutLog"
        & $NssmPath set $ServiceName AppStderr "$stderrLog"
        & $NssmPath set $ServiceName AppRotateFiles 1
        & $NssmPath set $ServiceName AppRotateOnline 1
        & $NssmPath set $ServiceName AppRotateSeconds 86400        # Daily rotation fallback
        & $NssmPath set $ServiceName AppRotateBytes 10485760       # 10 MB limit before rotation

        # Configure Process Resilience & Auto-Restart Policies
        Write-Step "Configuring auto-restart crash recovery policies..."
        & $NssmPath set $ServiceName AppExit Default Restart
        & $NssmPath set $ServiceName AppRestartDelay 5000          # 5-second backoff between crash loops
        & $NssmPath set $ServiceName AppThrottle 1500              # Throttle if crashing in under 1.5 seconds
        & $NssmPath set $ServiceName Start SERVICE_AUTO_START       # Auto start on Windows boot

        # Set Service Startup and Start the Service
        Write-Step "Starting service '$ServiceName'..."
        & $NssmPath start $ServiceName
        Start-Sleep -Seconds 3

        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') {
            Write-Success "====================================================================="
            Write-Success "Windows Service '$ServiceName' installed and STARTED successfully!"
            Write-Success "Port          : $Port"
            Write-Success "Working Dir   : $ProjectDir"
            Write-Success "Service Log   : $stdoutLog"
            Write-Success "Error Log     : $stderrLog"
            Write-Success "Local Endpoint: http://127.0.0.1:$Port"
            Write-Success "====================================================================="
        } else {
            Write-WarnMsg "Service was created but current status is '$($svc.Status)'."
            Write-WarnMsg "Inspect $stderrLog for potential startup errors."
        }
    }
}
