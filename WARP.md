# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

duplistatus is a Next.js 15 dashboard application for monitoring Duplicati backup operations. It consists of:

1. **Web Application (Next.js)**: Handles UI and REST API endpoints under `/api/*`
2. **Custom Node Server** (`duplistatus-server.ts`): Custom server that manages security (`.duplistatus.key` permissions), static file serving for embedded docs, and starts the Next.js app
3. **Cron Service** (`src/cron-service/`): Separate process running scheduled background tasks (overdue checks, notifications) with its own REST API on a separate port

Data is persisted in a local SQLite database at `data/backups.db` using WAL (Write-Ahead Logging) mode for better concurrency.

## Essential Commands

### Development
```bash
# Install dependencies (pnpm v10+ required, enforced by preinstall script)
pnpm install

# Start Next.js dev server (port 8666)
pnpm dev

# Start cron service in watch mode (port 8667)
pnpm cron:dev

# Lint and typecheck
pnpm lint
pnpm typecheck
```

### Production
```bash
# Build (runs pre-checks: key file validation, version update)
pnpm build

# Start production server (port 9666, includes both web + cron)
pnpm start

# Start only cron service in production
pnpm cron:start
```

### Docker
```bash
# Build and start container
pnpm docker-up

# Stop container
pnpm docker-down

# Clean Docker artifacts
pnpm docker-clean
```

### Utility Scripts
```bash
# Generate test data (destructive: replaces DB)
pnpm run generate-test-data

# Show current overdue notifications
pnpm show-overdue-notifications

# Manually run overdue check with specific timestamp
pnpm run-overdue-check "YYYY-MM-DD HH:MM:SS"

# Test cron port connectivity
pnpm test-cron-port

# Test SMTP connections
pnpm test-smtp-connections
```

### Admin Recovery / Password Reset
```bash
# Reset user password in Docker container
docker exec -it duplistatus /app/admin-recovery <username> <new-password>

# Reset admin password (example)
docker exec -it duplistatus /app/admin-recovery admin NewPassword123

# Reset password locally (if running without Docker)
./admin-recovery <username> <new-password>
```

## Architecture

### Directory Structure

- **`src/app/`**: Next.js App Router pages and API routes
  - **`src/app/api/`**: REST API endpoints (auth, backups, servers, notifications, configuration, etc.)
  - **`src/app/*/page.tsx`**: UI pages (dashboard, detail views, settings, login)
  
- **`src/components/`**: React components
  - **`src/components/ui/`**: Reusable UI components (Radix UI + Tailwind)
  - **`src/components/dashboard/`**: Dashboard-specific components
  - **`src/components/server-details/`**: Server detail page components
  - **`src/components/settings/`**: Settings page components

- **`src/contexts/`**: React context providers for global state (auth, config, theme, selections)

- **`src/lib/`**: Shared utilities and core logic
  - **`src/lib/db.ts`**: SQLite database connection and singleton management
  - **`src/lib/db-migrations.ts`**: Database schema migrations
  - **`src/lib/db-utils.ts`**: Database query utilities
  - **`src/lib/auth/`**: Authentication and session management
  - **`src/lib/cron-client.ts`**: Client for communicating with cron service
  - **`src/lib/notifications/`**: Notification system (NTFY, SMTP)
  - **`src/lib/audit-logger.ts`**: Audit logging system
  - **`src/lib/types.ts`**: Shared TypeScript type definitions

- **`src/cron-service/`**: Independent cron service (see `src/cron-service/README.md`)

- **`scripts/`**: Admin and utility scripts (clean-db, generate-test-data, duplistatus-cron.sh)

- **`docs/`**: User-facing documentation

- **`website/`**: Docusaurus documentation site (embedded in production at `/docs/`)

### Key Files

- **`duplistatus-server.ts`**: Custom Node server entry point
  - Validates `.duplistatus.key` file permissions (must be 0400)
  - Serves static documentation from `public/docs/`
  - Handles graceful shutdown with proper WAL checkpoint
  - Exposes environment variable health checks

- **`docker-entrypoint.sh`**: Container entry point
  - Starts both server and cron service with signal handling
  - Ensures proper shutdown order (cron first, then server)
  - Runs final WAL checkpoint on exit

- **`data/.duplistatus.key`**: Security key file (0400 permissions required)
  - Server will refuse to start if permissions are incorrect
  - Auto-generated on first run

### Data Flow

1. **Backup Upload**: Duplicati servers POST backup reports to `/api/upload`
   - In development: JSON dumped to `data/*.json` files
   - In production: Data inserted into SQLite and audit logged
   - Notifications sent via NTFY/SMTP if configured

2. **Cron Tasks**: Background tasks triggered by cron service
   - Overdue backup checks (default: every 5 minutes)
   - Configurable via database `cron_service` config

3. **Database Migrations**: Automatic on startup
   - Creates backup at `data/bkp/backups-copy-*.db` before migration
   - Managed by `DatabaseMigrator` in `src/lib/db-migrations.ts`

### Port Configuration

- **Development**:
  - Web app: 8666 (PORT=8666)
  - Cron service: 8667 (CRON_PORT=8667)

- **Production**:
  - Web app: 9666 (PORT=9666)
  - Cron service: 9667 (CRON_PORT=9667 or PORT+1)

Environment variables `PORT` and `CRON_PORT` control these values.

## Important Conventions

### Package Manager
- **MUST use pnpm** (not npm or yarn)
- Enforced by `preinstall` script in package.json
- Version 10+ required (see `packageManager` field)

### Node Version
- Node.js >= 20.19.0 required (see `engines` in package.json)

### TypeScript
- Always use proper TypeScript interfaces, never `any`
- Path alias `@/*` maps to `./src/*`
- Strict mode enabled

### Database
- SQLite with WAL mode for concurrency
- Global singleton pattern to prevent multiple connections during hot reload
- All database operations must use transactions for data consistency
- Graceful shutdown handlers ensure WAL checkpoint on exit

### Security
- `.duplistatus.key` file must have 0400 permissions (read-only for owner)
- Server startup will fail if permissions are incorrect
- Key file is auto-generated on first run
- SMTP credentials are masked in logs

### Testing & Validation
- **No automated unit tests** exist in this repo
- Use provided scripts in `scripts/` to exercise functionality
- Always run `pnpm lint` and `pnpm typecheck` before committing
- Use `pnpm build` to verify production build succeeds

## Integrations

### Duplicati Configuration
Duplicati servers must POST backup reports to this endpoint:
```
--send-http-url=http://HOST:PORT/api/upload
```

Required fields in POST data:
- `Extra.machine-id`: Server identifier
- `Extra.machine-name`: Server display name
- `Extra.backup-name`: Backup job name
- `Extra.backup-id`: Backup job ID
- `Data.ParsedResult`: Backup status
- `Data.BeginTime`: Start timestamp
- `Data.Duration`: Duration string

See `src/app/api/upload/route.ts` for full validation logic.

### Notifications
- **NTFY**: Push notifications for backup events
- **SMTP**: Email notifications (optional)
- Environment variables read at server startup
- SMTP credentials are masked in logs

### Docker Images
- Published to Docker Hub: `wsjbr/duplistatus`
- Published to GHCR: `ghcr.io/wsj-br/duplistatus`

## Development Guidelines

### When Making Changes

1. **Database Schema Changes**:
   - Add migration logic in `src/lib/db-migrations.ts`
   - Ensure backup flow creates `backups-copy-*.db` files
   - Test migration with existing data

2. **Security-Related Changes**:
   - Preserve `.duplistatus.key` permission logic unless intentionally changing
   - Never log sensitive information (passwords, keys, tokens)
   - Always use audit logging for user actions and system changes

3. **Documentation Updates**:
   - Update `docs/DEVELOPMENT.md` for setup/environment changes
   - Update `docs/INSTALL.md` for installation/configuration changes
   - Keep changelog in `docs/CHANGELOG.md` (per project rules)

4. **API Changes**:
   - Update `src/lib/types.ts` for new interfaces
   - Maintain backward compatibility when possible
   - Document breaking changes in migration guide

5. **Cron Service**:
   - See `src/cron-service/README.md` for task lifecycle
   - New tasks must be registered in `service.ts`
   - Update cron configuration schema in `src/lib/types.ts`

6. **User Management**:
   - Use `admin-recovery` script to reset passwords
   - Script works both in Docker and locally
   - All password resets are logged in audit trail
   - Default admin user is created on first database initialization

### Code Patterns

**Calling cron endpoints from UI**:
```typescript
import { cronClient } from '@/lib/cron-client';

// Get service status
const status = await cronClient.getStatus();

// Trigger a task manually
await cronClient.triggerTask('overdue-backup-check');
```

**Database transactions**:
```typescript
const transaction = db.transaction(() => {
  dbOps.insertServerIfNotExistsWithDefaults.run({ id, name });
  dbOps.insertBackup.run({ /* backup data */ });
});
transaction();
```

**Audit logging**:
```typescript
await AuditLogger.logBackupOperation(
  'backup_upload',
  userId,
  username,
  backupId,
  details,
  ipAddress,
  userAgent
);
```

### DRY Principle
Always follow the DRY (Don't Repeat Yourself) principle. Reuse functions from `src/lib/` rather than duplicating logic.

## Security Features

### API Key Authentication (v4.1+)

Protege o endpoint `/api/upload` contra uploads não autorizados:

- **Status**: Parcialmente implementado (migração do banco concluída)
- **Documentação completa**: `docs/API_KEY_AUTHENTICATION.md`
- **Configuração**: Opcional e desabilitada por padrão para compatibilidade
- **Uso no Duplicati**: `--send-http-url=http://HOST:PORT/api/upload?api_key=YOUR_KEY`

**Arquitetura**:
- Tabela `api_keys` no banco de dados
- Keys armazenadas como hash bcrypt
- Autenticação via query parameter (Duplicati não suporta headers customizados)
- Auditoria completa de tentativas de acesso
- UI de gerenciamento para admins (pendente)

## Additional Resources

- **API Key Authentication**: `docs/API_KEY_AUTHENTICATION.md`
- **AI Development Guide**: `docs/HOW-I-BUILD-WITH-AI.md` and `website/docs/development/ai-development.md`
- **Cron Service Details**: `src/cron-service/README.md`
- **User Guide**: https://wsj-br.github.io/duplistatus/
- **API Reference**: https://wsj-br.github.io/duplistatus/api-reference/overview
