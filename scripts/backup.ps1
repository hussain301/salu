<#
.SYNOPSIS
    Performs automated hot backups of the SALU SQLite database and media uploads with 30-day retention pruning.

.DESCRIPTION
    Shah Abdul Latif University (SALU) Web Portal Automated Backup Utility.
    - Executes atomic hot backup of the SQLite database (data/salu.db) using sqlite3 .backup or WAL-safe snapshot.
    - Archives and compresses all media library assets (media/).
    - Emits a cryptographic manifest (manifest.json) with SHA-256 integrity checksums.
    - Automatically purges backups older than the retention threshold (default: 30 days).
    - Designed for headless, automated execution via Windows Task Scheduler or manual administrator execution.

.PARAMETER BackupRoot
    Destination directory where timestamped backups and backup.log are stored.
    Default: 'backups' (relative to repository root).

.PARAMETER RetentionDays
    Number of days to keep backup archives before automatic pruning. Default: 30.

.PARAMETER DataDir
    Path to data directory containing salu.db. Default: 'data'.

.PARAMETER MediaDir
    Path to media library uploads directory. Default: 'media'.

.PARAMETER SqlitePath
    Optional explicit path to sqlite3.exe CLI tool.

.PARAMETER NoCompression
    Switch to store media files uncompressed instead of generating a .zip archive.

.PARAMETER Quiet
    Suppresses standard console output (errors are still written to stderr and backup.log).

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup.ps1
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup.ps1 -RetentionDays 60 -BackupRoot "D:\Backups\SALU"
#>

[CmdletBinding()]
param (
    [string]$BackupRoot = "backups",
    [int]$RetentionDays = 30,
    [string]$DataDir = "data",
    [string]$MediaDir = "media",
    [string]$SqlitePath = "",
    [switch]$NoCompression,
    [switch]$Quiet
)

# Set error handling preference
$ErrorActionPreference = 'Stop'

# 1. Resolve Project Root and Paths
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([System.IO.Path]::IsPathRooted($BackupRoot)) {
    $backupRootResolved = $BackupRoot
} else {
    $backupRootResolved = Join-Path $projectRoot $BackupRoot
}

if ([System.IO.Path]::IsPathRooted($DataDir)) {
    $dataDirResolved = $DataDir
} else {
    $dataDirResolved = Join-Path $projectRoot $DataDir
}

if ([System.IO.Path]::IsPathRooted($MediaDir)) {
    $mediaDirResolved = $MediaDir
} else {
    $mediaDirResolved = Join-Path $projectRoot $MediaDir
}

$dbSourceFile = Join-Path $dataDirResolved "salu.db"
$dbWalFile = Join-Path $dataDirResolved "salu.db-wal"
$dbShmFile = Join-Path $dataDirResolved "salu.db-shm"

# Ensure Backup Root exists
if (-not (Test-Path $backupRootResolved)) {
    New-Item -ItemType Directory -Path $backupRootResolved -Force | Out-Null
}

$logFilePath = Join-Path $backupRootResolved "backup.log"

# Logging helper
function Log-Msg {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$ts] [$Level] $Message"
    Add-Content -Path $logFilePath -Value $logLine -Encoding UTF8

    if (-not $Quiet) {
        $color = switch ($Level) {
            "INFO"    { "Cyan" }
            "SUCCESS" { "Green" }
            "WARNING" { "Yellow" }
            "ERROR"   { "Red" }
            Default   { "White" }
        }
        Write-Host "[$Level] $Message" -ForegroundColor $color
    }
}

Log-Msg "================================================================="
Log-Msg "Starting SALU automated backup run..."
Log-Msg "Project Root : $projectRoot"
Log-Msg "Backup Root  : $backupRootResolved"
Log-Msg "Retention    : $RetentionDays days"

# 2. Generate Timestamp and Target Backup Folder
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$targetBackupDir = Join-Path $backupRootResolved "backup_$timestamp"
New-Item -ItemType Directory -Path $targetBackupDir -Force | Out-Null
Log-Msg "Target folder created: $targetBackupDir"

$manifest = [ordered]@{
    timestamp = (Get-Date -Format "o")
    backupName = "backup_$timestamp"
    database = $null
    media = $null
    system = [ordered]@{
        computerName = $env:COMPUTERNAME
        userName = $env:USERNAME
        osVersion = [System.Environment]::OSVersion.VersionString
        retentionDays = $RetentionDays
    }
}

# 3. Locate SQLite CLI Tool
if ([string]::IsNullOrWhiteSpace($SqlitePath)) {
    $sqliteCmd = Get-Command sqlite3.exe -ErrorAction SilentlyContinue
    if ($sqliteCmd) {
        $SqlitePath = $sqliteCmd.Source
    } else {
        $candidateSqlitePaths = @(
            (Join-Path $projectRoot "tools\sqlite3.exe"),
            (Join-Path $projectRoot "scripts\sqlite3.exe"),
            "C:\tools\sqlite3.exe",
            "C:\tools\sqlite\sqlite3.exe",
            "C:\ProgramData\chocolatey\bin\sqlite3.exe"
        )
        foreach ($cand in $candidateSqlitePaths) {
            if (Test-Path $cand) {
                $SqlitePath = (Resolve-Path $cand).Path
                break
            }
        }
    }
}

# 4. Perform Database Backup
$destDbFile = Join-Path $targetBackupDir "salu.db"
$dbBackupSuccess = $false
$backupMethodUsed = "none"

if (Test-Path $dbSourceFile) {
    if (-not [string]::IsNullOrWhiteSpace($SqlitePath) -and (Test-Path $SqlitePath)) {
        Log-Msg "Performing atomic online backup using sqlite3.exe ($SqlitePath)..."
        try {
            # Try sqlite3 CLI online backup first
            $escapedDest = $destDbFile.Replace("\", "/")
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = $SqlitePath
            $psi.Arguments = "`"$dbSourceFile`""
            $psi.RedirectStandardInput = $true
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.UseShellExecute = $false
            $psi.CreateNoWindow = $true

            $proc = [System.Diagnostics.Process]::Start($psi)
            $proc.StandardInput.WriteLine(".backup '$escapedDest'")
            $proc.StandardInput.WriteLine(".exit")
            $proc.WaitForExit(30000)

            if ($proc.ExitCode -eq 0 -and (Test-Path $destDbFile) -and ((Get-Item $destDbFile).Length -gt 0)) {
                $dbBackupSuccess = $true
                $backupMethodUsed = "sqlite3_online_backup"
                Log-Msg "Atomic online SQLite backup completed successfully." "SUCCESS"
            } else {
                Log-Msg "sqlite3 online backup exited with code $($proc.ExitCode); attempting WAL checkpoint and file snapshot." "WARNING"
            }
        } catch {
            Log-Msg "sqlite3 command execution failed: $_; attempting WAL checkpoint and file snapshot." "WARNING"
        }
    }

    # Fallback: WAL-safe transactional multi-file snapshot
    if (-not $dbBackupSuccess) {
        Log-Msg "Performing WAL-consistent file snapshot of SQLite database..."
        try {
            # If sqlite3 CLI is available, perform passive WAL checkpoint before copying
            if (-not [string]::IsNullOrWhiteSpace($SqlitePath) -and (Test-Path $SqlitePath)) {
                try {
                    $ckptPsi = New-Object System.Diagnostics.ProcessStartInfo
                    $ckptPsi.FileName = $SqlitePath
                    $ckptPsi.Arguments = "`"$dbSourceFile`" `"PRAGMA wal_checkpoint(TRUNCATE);`""
                    $ckptPsi.UseShellExecute = $false
                    $ckptPsi.CreateNoWindow = $true
                    $ckptProc = [System.Diagnostics.Process]::Start($ckptPsi)
                    $ckptProc.WaitForExit(10000)
                    Log-Msg "Executed SQLite WAL checkpoint (TRUNCATE) prior to snapshot." "INFO"
                } catch {
                    Log-Msg "WAL checkpoint attempt skipped: $_" "INFO"
                }
            }

            # In SQLite WAL mode, copy WAL file first, then main DB, then SHM to ensure consistency
            if (Test-Path $dbWalFile) {
                Copy-Item -Path $dbWalFile -Destination (Join-Path $targetBackupDir "salu.db-wal") -Force
            }
            Copy-Item -Path $dbSourceFile -Destination $destDbFile -Force
            if (Test-Path $dbShmFile) {
                Copy-Item -Path $dbShmFile -Destination (Join-Path $targetBackupDir "salu.db-shm") -Force
            }

            $dbBackupSuccess = $true
            $backupMethodUsed = "wal_file_snapshot"
            Log-Msg "WAL file snapshot completed successfully." "SUCCESS"
        } catch {
            Log-Msg "Failed to copy database files: $_" "ERROR"
            throw $_
        }
    }

    # Verify backup file and compute SHA-256 hash
    if (Test-Path $destDbFile) {
        $dbItem = Get-Item $destDbFile
        $hashResult = Get-FileHash -Path $destDbFile -Algorithm SHA256
        $dbSizeKB = [math]::Round($dbItem.Length / 1KB, 2)

        $manifest.database = [ordered]@{
            source = $dbSourceFile
            backupFile = "salu.db"
            sizeBytes = $dbItem.Length
            sizeKB = $dbSizeKB
            sha256 = $hashResult.Hash
            method = $backupMethodUsed
        }
        Log-Msg "Database backup verified: $dbSizeKB KB (SHA-256: $($hashResult.Hash.Substring(0, 16))...)" "SUCCESS"
    }
} else {
    Log-Msg "Source database file not found at '$dbSourceFile'. Skipping DB backup." "WARNING"
    $manifest.database = [ordered]@{
        status = "not_found"
        source = $dbSourceFile
    }
}

# 5. Perform Media Library Backup
$mediaCount = 0
$mediaSizeBytes = 0

if (Test-Path $mediaDirResolved) {
    $mediaFiles = Get-ChildItem -Path $mediaDirResolved -File -Recurse -ErrorAction SilentlyContinue
    $mediaCount = ($mediaFiles | Measure-Object).Count
    if ($mediaCount -gt 0) {
        $mediaSizeBytes = ($mediaFiles | Measure-Object -Property Length -Sum).Sum
    }
    $mediaSizeMB = [math]::Round($mediaSizeBytes / 1MB, 2)
    Log-Msg "Found $mediaCount media assets ($mediaSizeMB MB) in '$mediaDirResolved'."

    if ($mediaCount -gt 0) {
        if ($NoCompression) {
            Log-Msg "Copying media assets uncompressed..."
            $destMediaDir = Join-Path $targetBackupDir "media"
            Copy-Item -Path $mediaDirResolved -Destination $destMediaDir -Recurse -Force
            $manifest.media = [ordered]@{
                fileCount = $mediaCount
                totalSizeBytes = $mediaSizeBytes
                totalSizeMB = $mediaSizeMB
                compressed = $false
                storage = "media/"
            }
            Log-Msg "Media assets copied uncompressed." "SUCCESS"
        } else {
            $destMediaZip = Join-Path $targetBackupDir "media_$timestamp.zip"
            Log-Msg "Compressing media library into zip archive ($destMediaZip)..."
            try {
                Compress-Archive -Path "$mediaDirResolved\*" -DestinationPath $destMediaZip -CompressionLevel Optimal -Force
                $zipItem = Get-Item $destMediaZip
                $zipSizeMB = [math]::Round($zipItem.Length / 1MB, 2)
                $zipHash = (Get-FileHash -Path $destMediaZip -Algorithm SHA256).Hash

                $manifest.media = [ordered]@{
                    fileCount = $mediaCount
                    originalSizeBytes = $mediaSizeBytes
                    compressedSizeBytes = $zipItem.Length
                    compressedSizeMB = $zipSizeMB
                    compressed = $true
                    archiveFile = "media_$timestamp.zip"
                    sha256 = $zipHash
                }
                Log-Msg "Media archive created: $zipSizeMB MB (SHA-256: $($zipHash.Substring(0, 16))...)" "SUCCESS"
            } catch {
                Log-Msg "Compression failed: $_. Falling back to direct folder copy..." "WARNING"
                $destMediaDir = Join-Path $targetBackupDir "media"
                Copy-Item -Path $mediaDirResolved -Destination $destMediaDir -Recurse -Force
                $manifest.media = [ordered]@{
                    fileCount = $mediaCount
                    totalSizeBytes = $mediaSizeBytes
                    compressed = $false
                    storage = "media/"
                }
            }
        }
    } else {
        Log-Msg "Media directory contains no files. Skipping media compression." "INFO"
        $manifest.media = [ordered]@{
            fileCount = 0
            status = "empty"
        }
    }
} else {
    Log-Msg "Media directory does not exist at '$mediaDirResolved'. Skipping media backup." "WARNING"
    $manifest.media = [ordered]@{
        status = "not_found"
        source = $mediaDirResolved
    }
}

# 6. Write Cryptographic Manifest
$manifestPath = Join-Path $targetBackupDir "manifest.json"
$manifestJson = $manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.Encoding]::UTF8)
Log-Msg "Backup manifest recorded: $manifestPath"

# 7. Retention Policy Cleanup: Prune backups older than $RetentionDays
Log-Msg "Applying retention policy: purging backups older than $RetentionDays days..."
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
$purgedCount = 0

$existingBackups = Get-ChildItem -Path $backupRootResolved -Directory | Where-Object {
    $_.Name -like "backup_*"
}

foreach ($backupDir in $existingBackups) {
    $shouldPurge = $false
    if ($backupDir.CreationTime -lt $cutoffDate) {
        $shouldPurge = $true
    } elseif ($backupDir.Name -match '^backup_(\d{8})_(\d{6})$') {
        try {
            $parsedDate = [datetime]::ParseExact($matches[1], 'yyyyMMdd', $null)
            if ($parsedDate -lt $cutoffDate) {
                $shouldPurge = $true
            }
        } catch { }
    }

    if ($shouldPurge) {
        try {
            Log-Msg "Purging expired backup directory: $($backupDir.FullName) (Created: $($backupDir.CreationTime.ToString('yyyy-MM-dd')))..." "INFO"
            Remove-Item -Path $backupDir.FullName -Recurse -Force
            $purgedCount++
        } catch {
            Log-Msg "Failed to remove expired backup directory $($backupDir.FullName): $_" "WARNING"
        }
    }
}

Log-Msg "Retention cleanup completed: $purgedCount old backup(s) pruned." "INFO"
Log-Msg "================================================================="
Log-Msg "SALU Backup completed successfully at $targetBackupDir" "SUCCESS"
Log-Msg "================================================================="
