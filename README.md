# Shah Abdul Latif University (SALU) Web Portal & CMS
## Windows Server & IIS Production Deployment Runbook

Official web portal and headless content management system for **Shah Abdul Latif University (SALU), Khairpur, Sindh, Pakistan** (`salu.edu.pk`).

---

## 1. Architectural Overview

The SALU Web Portal is built on a high-performance decoupled Next.js and Payload CMS stack, specifically architected to run on the university's on-premise Windows Server infrastructure behind Microsoft Internet Information Services (IIS).

```
                                      [ Internet / Intranet Clients ]
                                                     │
                                                     ▼
                                      [ HTTPS: 443 / HTTP: 80 ]
                        ┌─────────────────────────────────────────────────────────┐
                        │          Microsoft Internet Information Services        │
                        │                          (IIS 10.0+)                    │
                        │  - SSL / TLS Termination (Let's Encrypt / CA Cert)      │
                        │  - IIS URL Rewrite 2.1 Module                           │
                        │  - IIS Application Request Routing (ARR 3.0) Proxy      │
                        │  - WebSocket Tunneling & HTTP Security Headers          │
                        │  - Outbound Static Asset Caching (immutable)            │
                        └────────────────────────────┬────────────────────────────┘
                                                     │
                                         Reverse Proxy (HTTP)
                                         Forwarded Headers
                                         to http://localhost:3000
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Windows Service: SALU-Website (Managed via NSSM)                      │
│                                                                                                 │
│   Node.js (>=20.9.0 / v25) Standalone Server Process                                            │
│   Entry: node.exe .next/standalone/server.js                                                    │
│   Port : 3000 | Environment: production                                                         │
│                                                                                                 │
│   ┌──────────────────────────────────────────────┐  ┌────────────────────────────────────────┐  │
│   │             Next.js 16 (App Router)          │  │       Payload CMS 3.90.2 (/admin)      │  │
│   │ - Server-Side Rendering (SSR)                │  │ - Role-Based Access Control (RBAC)     │  │
│   │ - On-Demand ISR Cache Invalidation           │  │ - Lexical Rich Text & Media Engine     │  │
│   │ - GSAP / Lenis Animation Engine              │  │ - 7 Collections & 4 Site Globals       │  │
│   │ - 2022 Recovered Historical URL Catch-All    │  │ - Dynamic Revalidation Hooks           │  │
│   └──────────────────────────────────────────────┘  └────────────────────────────────────────┘  │
│                                         │                            │                          │
│                                         ▼                            ▼                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                Embedded SQLite Storage                                   │  │
│   │ - Main Database File : data/salu.db (Write-Ahead Logging / WAL Mode)                     │  │
│   │ - Upload Media Assets: media/ (Auto WebP generation via Sharp)                           │  │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                                       │
│                                         ▼                                                       │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                      Automated Scheduled Tasks (Windows Task Scheduler)                  │  │
│   │ - scripts/backup.ps1 : Atomic online SQLite backup + Media ZIP + 30-day retention prune │  │
│   │ - Output Directory   : backups/backup_YYYYMMDD_HHMMSS/                                   │  │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Technologies
- **Frontend & Server Framework**: Next.js 16 (App Router, Standalone packaging).
- **Content Management System**: Payload CMS 3.90.2 (Embedded headless CMS, administrative interface at `/admin`).
- **Database Engine**: SQLite 3 with Write-Ahead Logging (`WAL` mode) via `@payloadcms/db-sqlite`.
- **Media Engine**: Sharp 0.35.5 (automatic WebP conversions and responsive breakpoint generation).
- **Process Supervisor**: NSSM (Non-Sucking Service Manager) configured as Windows Service `SALU-Website`.
- **Edge Reverse Proxy**: Microsoft IIS 10.0+ with URL Rewrite 2.1 and Application Request Routing (ARR) 3.0.

---

## 2. Server Prerequisites & Environment Preparation

### Hardware Requirements
- **Operating System**: Windows Server 2016, 2019, 2022, or Windows 10/11 Pro (x64).
- **Processor**: Minimum 4 CPU cores (8 cores recommended for high concurrent traffic).
- **Memory**: Minimum 8 GB RAM (16 GB recommended).
- **Storage**: Minimum 60 GB SSD / NVMe available disk space.

### Software Requirements
1. **Node.js**: Node.js LTS (>=20.9.0; Node v22 or v25 supported).
   - Verify in PowerShell: `node.exe --version`
2. **Microsoft IIS 10.0+** with the following features enabled:
   - Web Server (IIS)
   - Common HTTP Features (Static Content, Default Document, HTTP Errors)
   - Application Development -> WebSocket Protocol
   - Performance -> Static & Dynamic Content Compression
3. **IIS Modules**:
   - [URL Rewrite Module 2.1](https://www.iis.net/downloads/microsoft/url-rewrite)
   - [Application Request Routing (ARR) 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)
4. **Service Manager**:
   - [NSSM (Non-Sucking Service Manager)](https://nssm.cc/download) (Version 2.24+).
5. **SQLite CLI (Optional but Recommended)**:
   - `sqlite3.exe` for database diagnostics and backup commands.

---

## 3. Step-by-Step Installation & Build Guide

### Step 1: Deploy Application Directory
Place or clone the project repository into the target server directory (e.g. `C:\inetpub\wwwroot\salu-website`):

```powershell
# Open Windows PowerShell as Administrator
cd "C:\inetpub\wwwroot\salu-website"
```

> **IMPORTANT (Windows PowerShell Note):**
> On Windows Server, PowerShell may block executing `npm.ps1` due to execution policies. Always use `npm.cmd` rather than `npm` in PowerShell.

### Step 2: Configure Environment Variables (`.env`)
Create `.env` at the project root by copying `.env.example`:

```powershell
Copy-Item .env.example .env
```

Edit `.env` using Notepad or PowerShell:

```env
# Cryptographic secret for signing admin JWT sessions (Set to a secure 64+ char random string)
PAYLOAD_SECRET=salu_prod_secret_f8b1c4e92a7d6530184e2c90a3b7d1e892c5a7f4e1

# SQLite database file URI (points to data/salu.db)
DATABASE_URI=file:./data/salu.db

# Canonical public base URL
NEXT_PUBLIC_SITE_URL=https://salu.edu.pk
```

### Step 3: Install Node Dependencies
Install production dependencies:

```powershell
npm.cmd ci --omit=dev
# Or for full development / build tools:
npm.cmd install
```

### Step 4: Execute Production Build
Run the production build script with Node memory expansion:

```powershell
npm.cmd run build
```

This compiles Next.js pages, optimizes server components, and produces the standalone distribution bundle inside `.next\standalone`.

---

## 4. Microsoft IIS Configuration Guide

### 4.1 Enable ARR Reverse Proxy
Before IIS can forward traffic to the internal Node.js port, the ARR proxy capability must be enabled at the server level:

1. Open **Internet Information Services (IIS) Manager**.
2. Click on the root **Server Name** node in the Connections pane.
3. In the center pane, double-click **Application Request Routing**.
4. In the Actions pane on the right, click **Server Proxy Settings...**.
5. Check **Enable proxy**.
6. Set **HTTP Version** to `Pass through`.
7. Uncheck **Reverse rewrite host in response headers** (Next.js handles host headers).
8. Click **Apply** in the right-hand panel.

Or execute via elevated PowerShell / Command Prompt:
```cmd
%windir%\system32\inetsrv\appcmd.exe set config -section:system.webServer/proxy /enabled:"True" /commit:apphost
```

### 4.2 Register Allowed Server Variables (CRITICAL)
In `web.config`, custom server variables (`HTTP_X_FORWARDED_PROTO`, `HTTP_X_FORWARDED_HOST`, `HTTP_X_REAL_IP`, `HTTP_X_FORWARDED_FOR`) are set during request rewrite. To prevent **HTTP 500.50 URL Rewrite Module Errors**, register these variables in IIS once:

Execute in an elevated Administrator Command Prompt:

```cmd
%windir%\system32\inetsrv\appcmd.exe set config "SALU-Website" /section:rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_PROTO']"
%windir%\system32\inetsrv\appcmd.exe set config "SALU-Website" /section:rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_HOST']"
%windir%\system32\inetsrv\appcmd.exe set config "SALU-Website" /section:rewrite/allowedServerVariables /+"[name='HTTP_X_REAL_IP']"
%windir%\system32\inetsrv\appcmd.exe set config "SALU-Website" /section:rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_FOR']"
```
*(Replace `"SALU-Website"` with the exact name of your IIS Site if different).*

### 4.3 Configure IIS Site & Bindings
1. In IIS Manager, right-click **Sites** -> **Add Website...**.
   - **Site name**: `SALU-Website`
   - **Physical path**: `C:\inetpub\wwwroot\salu-website`
   - **Binding**: Type `http`, IP Address `All Unassigned`, Port `80`, Host name `salu.edu.pk` (or server IP/domain).
2. Add HTTPS Binding (Port 443):
   - Right-click `SALU-Website` -> **Edit Bindings...**.
   - Add `https`, Port `443`, select your university SSL/TLS certificate.
3. Configure File System Permissions (ACLs):
   Grant write permissions for the application pool identity to `data\`, `media\`, and `logs\`:
   ```powershell
   icacls "C:\inetpub\wwwroot\salu-website\data" /grant "IIS_IUSRS:(OI)(CI)M" /grant "NETWORK SERVICE:(OI)(CI)M"
   icacls "C:\inetpub\wwwroot\salu-website\media" /grant "IIS_IUSRS:(OI)(CI)M" /grant "NETWORK SERVICE:(OI)(CI)M"
   icacls "C:\inetpub\wwwroot\salu-website\logs" /grant "IIS_IUSRS:(OI)(CI)M" /grant "NETWORK SERVICE:(OI)(CI)M"
   ```

### 4.4 `web.config` Features Summary
The included `web.config` at the project root automatically handles:
- **Reverse Proxy**: Rewrites inbound traffic to `http://localhost:3000/{R:1}`.
- **Protocol Forwarding**: Accurately sets `HTTP_X_FORWARDED_PROTO` to `https` or `http`.
- **Upload Size Limit**: Configures `maxAllowedContentLength="52428800"` (50MB) matching Payload CMS limits.
- **Hidden Segments Protection**: Denies direct web access to `data/`, `backups/`, `.env`, `.git/`, and `logs/`.
- **Static Asset Caching**: Emits `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/` and `/media/`.
- **WebSocket Transport**: Native WebSocket proxy tunneling for live client updates.
- **Security Headers**: HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.

---

## 5. Windows Service Management (`scripts/setup-service.ps1`)

The Next.js standalone process runs as a persistent Windows Service managed by **NSSM (Non-Sucking Service Manager)**. This guarantees automatic start on boot, recovery on unexpected crashes, and log rotation.

### 5.1 Service Operations Commands

Execute in PowerShell (Run as Administrator):

```powershell
# 1. Install and Start the Windows Service
powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Install

# 2. Check Service Health & Status
powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Status

# 3. Restart Service (e.g. after updating environment variables)
powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Restart

# 4. Stop Service
powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Stop

# 5. Start Service
powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Start

# 6. Uninstall Service (for maintenance / decommissioning)
powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Uninstall
```

### 5.2 What `setup-service.ps1` Automates
1. **Asset Staging**: Next.js standalone packaging omits static files. The script automatically stages:
   - `.next\static` -> `.next\standalone\.next\static`
   - `public` -> `.next\standalone\public`
2. **Environment Variable Injection**: Extracts parameters from `.env` and sets `PORT=3000`, `NODE_ENV=production`, `DATABASE_URI`, and `PAYLOAD_SECRET`.
3. **Resilience & Auto-Restart**:
   - `AppExit Default Restart` with exponential 5-second backoff.
   - Throttles crash loops if restarting within 1.5 seconds.
4. **Log Rotation**:
   - Standard output: `logs\salu_service.log`
   - Standard error: `logs\salu_error.log`
   - Rotates automatically upon reaching 10 MB or daily intervals.

---

## 6. Database Operations & Content Migration

### 6.1 SQLite Architecture & WAL Mode
The database is located at `data\salu.db`. For production concurrency under IIS:
- **Write-Ahead Logging (WAL)** MUST be active to permit non-blocking concurrent reads while writes occur:
  ```powershell
  # Verify WAL mode using sqlite3 CLI
  sqlite3.exe data\salu.db "PRAGMA journal_mode;"
  # Output must be: wal

  # If not WAL mode, enable it:
  sqlite3.exe data\salu.db "PRAGMA journal_mode=WAL;"
  ```

### 6.2 Initial Admin Bootstrap & Seed
To bootstrap an empty database with default roles, navigation, and settings:

```powershell
npm.cmd run seed
```

- When visiting `/admin` on a fresh database, the first user created is automatically elevated to the **Admin** role.
- Subsequent users registered default to the **Editor** role.

### 6.3 Historical Content Migration (2022 Archive)
To import all 2022 scraped academic faculties, 31 departments, news posts, and pages:

```powershell
# Run the migration import pipeline
npm.cmd run import
```

The importer populates:
- 7 Faculties (`faculties` collection)
- 31 Academic Departments (`departments` collection)
- 117+ News Articles (`news` collection)
- Historical Pages with nested paths (`pages` collection)
- Downloadable Documents & Tenders (`documents` collection)
- Media Assets (`media` collection)

### 6.4 Dynamic Revalidation (Zero-Rebuild Publishing)
When editors publish or modify content in `/admin`:
- Payload CMS hooks invoke `revalidatePath('/', 'layout')`.
- Next.js immediately invalidates cached pages in memory.
- The next public request displays the latest content instantly **without restarting the service or rebuilding the application**.

---

## 7. Automated Backups & Disaster Recovery (`scripts/backup.ps1`)

The production backup utility performs transactional hot backups of the SQLite database and compresses the media library with automated 30-day retention pruning.

### 7.1 Running Backups Manually

```powershell
# Execute standard backup (saves to backups\backup_YYYYMMDD_HHMMSS\)
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup.ps1

# Custom retention (e.g. 60 days) and custom destination:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup.ps1 -RetentionDays 60 -BackupRoot "D:\UniversityBackups\SALU"
```

### 7.2 Backup Archive Contents
Each backup folder (`backups\backup_YYYYMMDD_HHMMSS\`) contains:
1. `salu.db`: Consistent SQLite snapshot (created via `sqlite3 .backup` or transactional WAL copy).
2. `media_YYYYMMDD_HHMMSS.zip`: Compressed archive of all media library assets (`media\`).
3. `manifest.json`: JSON metadata including SHA-256 checksums, byte counts, and execution details.

### 7.3 Schedule Daily Automated Backups via Windows Task Scheduler
To run backups automatically every day at 02:00 AM under the `SYSTEM` account:

```powershell
# Open PowerShell as Administrator
schtasks.exe /create /tn "SALU_Daily_Backup" `
  /tr "powershell.exe -ExecutionPolicy Bypass -File C:\inetpub\wwwroot\salu-website\scripts\backup.ps1" `
  /sc daily /st 02:00 /ru "SYSTEM" /f
```

To test execution immediately:
```powershell
schtasks.exe /run /tn "SALU_Daily_Backup"
```

### 7.4 Disaster Recovery & Restore Procedure
In the event of server failure or database corruption:

1. **Stop the Windows Service**:
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Stop
   ```
2. **Select Target Backup**:
   Choose the desired backup folder in `backups\backup_YYYYMMDD_HHMMSS\`.
3. **Restore Database**:
   ```powershell
   # Move existing database to safe location
   Move-Item data\salu.db "data\salu_corrupt_$(Get-Date -Format 'yyyyMMdd').db"
   Remove-Item data\salu.db-wal, data\salu.db-shm -ErrorAction SilentlyContinue

   # Copy restored database
   Copy-Item "backups\backup_YYYYMMDD_HHMMSS\salu.db" "data\salu.db"
   ```
4. **Restore Media**:
   ```powershell
   Expand-Archive -Path "backups\backup_YYYYMMDD_HHMMSS\media_*.zip" -DestinationPath "media" -Force
   ```
5. **Start Service & Verify**:
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Start
   powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1 -Action Status
   ```

---

## 8. Alternative Deployment: In-Process `iisnode`

If your Windows Server policies forbid installing ARR or running background Windows Services:

1. Install **iisnode (x64)**: [iisnode GitHub Releases](https://github.com/Azure/iisnode/releases).
2. Open `web.config`:
   - Comment out the `<rewrite>` section for the ARR Reverse Proxy.
   - Uncomment the `<handlers>`, `<iisnode>`, and alternative `<rewrite>` sections provided at the bottom of `web.config`.
3. Ensure `.next\standalone\server.js` exists.
4. iisnode will manage the Node.js process life-cycle directly inside IIS worker processes (`w3wp.exe`).

---

## 9. Operations Runbook & Troubleshooting Guide

| Issue / Symptom | Probable Cause | Corrective Action |
|---|---|---|
| **HTTP 500.50 URL Rewrite Module Error** | IIS does not allow setting `HTTP_X_FORWARDED_*` variables in `web.config`. | Execute the `appcmd.exe` commands in **Section 4.2** to register Allowed Server Variables in IIS. |
| **HTTP 502.3 / 502.5 Bad Gateway** | The background Node.js service is stopped or crashed on startup. | 1. Run `.\scripts\setup-service.ps1 -Action Status`.<br>2. Check `logs\salu_error.log` for stack traces.<br>3. Verify `.next\standalone\server.js` exists. |
| **Styles/Scripts 404 (Missing CSS/JS)** | Standalone bundle lacks static assets. | Re-run `.\scripts\setup-service.ps1 -Action Install` to stage `.next\static` and `public` into `.next\standalone`. |
| **SQLite Error: `database is locked`** | Database file is accessed simultaneously without WAL mode or locks held by external process. | 1. Run `sqlite3 data\salu.db "PRAGMA journal_mode=WAL;"`.<br>2. Verify no backup tools are locking `salu.db` without using the SQLite backup API. |
| **Media Uploads Fail (HTTP 413 or 500)** | Upload exceeds IIS request size limit or directory permissions missing. | 1. Verify `web.config` has `maxAllowedContentLength="52428800"`.<br>2. Verify IIS user has write access to `media\`: `icacls media /grant "IIS_IUSRS:(OI)(CI)M"`. |
| **PowerShell script execution blocked** | Windows PowerShell ExecutionPolicy restriction (`Restricted`). | Always invoke scripts with `-ExecutionPolicy Bypass`, e.g.: `powershell.exe -ExecutionPolicy Bypass -File .\scripts\setup-service.ps1`. |
| **Port 3000 Conflict** | Another process is binding to port 3000. | Check using `netstat -ano \| findstr :3000`. Stop conflicting process or change port using `-Port 3001` in `setup-service.ps1` and update `web.config`. |

### Useful Health Check & Monitoring Commands
```powershell
# Test local backend health directly (bypassing IIS):
Invoke-RestMethod -Uri "http://127.0.0.1:3000" -Method Head

# Test public IIS reverse proxy:
Invoke-RestMethod -Uri "http://localhost" -Method Head

# Monitor real-time application logs:
Get-Content -Path .\logs\salu_service.log -Wait -Tail 30

# Monitor real-time error logs:
Get-Content -Path .\logs\salu_error.log -Wait -Tail 30
```

---

## 10. Summary of Deliverables

- **`web.config`**: Enterprise IIS reverse proxy configuration with URL Rewrite, ARR, WebSocket upgrade, 50MB uploads, static asset caching, and security headers.
- **`scripts\setup-service.ps1`**: Automated NSSM Windows Service installer, supervisor, and standalone asset stager with crash recovery.
- **`scripts\backup.ps1`**: Hot backup utility supporting SQLite WAL mode, media archiving, cryptographic manifests, and automated 30-day retention pruning.
- **`README.md`**: Complete, production-grade deployment and operations documentation for university systems administrators.
