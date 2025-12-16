# API Key Authentication Implementation Guide

## Status: Parcialmente Implementado

Este documento descreve a implementação do sistema de autenticação por API Key para o endpoint `/api/upload`.

## Motivação

Proteger o endpoint `/api/upload` contra uploads não autorizados de servidores desconhecidos.

## Solução

Como o Duplicati não suporta nativamente o envio de headers HTTP customizados com `--send-http-url`, a autenticação é feita via **query parameter** na URL:

```bash
--send-http-url=http://HOST:PORT/api/upload?api_key=SEU_API_KEY_AQUI
```

## Implementação Atual

### ✅ Completado

1. **Tipos TypeScript** (`src/lib/types.ts`)
   ```typescript
   export interface ApiKey {
     id: string;
     name: string;
     key: string; // hashed API key
     created_at: string;
     last_used_at: string | null;
     enabled: boolean;
     description: string;
   }
   ```

2. **Migração do Banco de Dados** (v4.1)
   - Tabela `api_keys` criada com campos:
     - `id`: UUID da API key
     - `name`: Nome descritivo
     - `key_hash`: Hash bcrypt da key
     - `description`: Descrição opcional
     - `enabled`: Status ativo/inativo
     - `created_at`: Data de criação
     - `created_by`: Usuário que criou
     - `last_used_at`: Última utilização
     - `usage_count`: Contador de usos
   - Configuração `upload_require_api_key` (padrão: `false` para compatibilidade)
   - Índices para performance

### ⏳ Pendente

#### 1. Validação no Endpoint `/api/upload`

Adicionar em `src/app/api/upload/route.ts`:

```typescript
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    // Check if API key authentication is required
    const requireApiKey = db.prepare(
      'SELECT value FROM configurations WHERE key = ?'
    ).get('upload_require_api_key') as { value: string } | undefined;
    
    if (requireApiKey?.value === 'true') {
      // Get API key from query parameter or header
      const url = new URL(request.url);
      const apiKey = url.searchParams.get('api_key') || 
                     request.headers.get('x-api-key');
      
      if (!apiKey) {
        await AuditLogger.logSecurityEvent(
          'upload_rejected_no_api_key',
          null,
          null,
          { ip: getClientIpAddress(request) }
        );
        
        return NextResponse.json(
          { error: 'API key required' },
          { status: 401 }
        );
      }
      
      // Verify API key
      const apiKeys = db.prepare(
        'SELECT * FROM api_keys WHERE enabled = 1'
      ).all() as ApiKey[];
      
      let validKey: ApiKey | null = null;
      for (const key of apiKeys) {
        if (await bcrypt.compare(apiKey, key.key_hash)) {
          validKey = key;
          break;
        }
      }
      
      if (!validKey) {
        await AuditLogger.logSecurityEvent(
          'upload_rejected_invalid_api_key',
          null,
          null,
          { 
            ip: getClientIpAddress(request),
            attempted_key_prefix: apiKey.substring(0, 8) + '...'
          }
        );
        
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
      
      // Update last_used_at and usage_count
      db.prepare(`
        UPDATE api_keys 
        SET last_used_at = CURRENT_TIMESTAMP,
            usage_count = usage_count + 1
        WHERE id = ?
      `).run(validKey.id);
      
      // Log successful authentication
      await AuditLogger.logSecurityEvent(
        'upload_authenticated',
        null,
        null,
        { 
          api_key_name: validKey.name,
          api_key_id: validKey.id
        }
      );
    }
    
    // Continue with existing upload logic...
    const data = await request.json();
    // ...
  } catch (error) {
    // ...
  }
}
```

#### 2. API Endpoints para Gerenciamento

Criar em `src/app/api/api-keys/`:

**`route.ts`** - Listar e criar keys:
```typescript
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';

// GET - List all API keys (without showing actual keys)
export async function GET(request: NextRequest) {
  // Require admin authentication
  const session = await getSession();
  if (!session?.user?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const keys = db.prepare(`
    SELECT id, name, description, enabled, created_at, last_used_at, usage_count, created_by
    FROM api_keys
    ORDER BY created_at DESC
  `).all();
  
  return NextResponse.json({ keys });
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { name, description } = await request.json();
  
  // Generate random API key (32 characters, URL-safe)
  const apiKey = nanoid(32);
  
  // Hash the key
  const keyHash = await bcrypt.hash(apiKey, 12);
  
  const id = 'key_' + nanoid(16);
  
  db.prepare(`
    INSERT INTO api_keys (id, name, key_hash, description, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, keyHash, description || '', session.user.id);
  
  await AuditLogger.logSecurityEvent(
    'api_key_created',
    session.user.id,
    session.user.username,
    { key_name: name, key_id: id }
  );
  
  // Return the plain key ONLY ONCE (cannot be retrieved later)
  return NextResponse.json({ 
    id,
    name,
    apiKey, // ⚠️ This is the only time the key is shown
    message: 'Save this key securely. It cannot be retrieved again.'
  });
}
```

**`[id]/route.ts`** - Delete/toggle keys:
```typescript
// DELETE - Remove API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const key = db.prepare('SELECT name FROM api_keys WHERE id = ?')
    .get(params.id) as { name: string } | undefined;
    
  if (!key) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(params.id);
  
  await AuditLogger.logSecurityEvent(
    'api_key_deleted',
    session.user.id,
    session.user.username,
    { key_name: key.name, key_id: params.id }
  );
  
  return NextResponse.json({ success: true });
}

// PATCH - Toggle enabled status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { enabled } = await request.json();
  
  db.prepare('UPDATE api_keys SET enabled = ? WHERE id = ?')
    .run(enabled ? 1 : 0, params.id);
  
  await AuditLogger.logSecurityEvent(
    enabled ? 'api_key_enabled' : 'api_key_disabled',
    session.user.id,
    session.user.username,
    { key_id: params.id }
  );
  
  return NextResponse.json({ success: true });
}
```

#### 3. UI para Gerenciamento

Criar componente em `src/components/settings/api-keys-management.tsx`:

- Tabela com lista de API keys
- Botão "Create New API Key"
- Modal para criar nova key (nome + descrição)
- Mostrar key gerada uma única vez com aviso
- Botões para enable/disable keys
- Botão para deletar keys
- Mostrar last_used_at e usage_count

#### 4. Configuração de Segurança

Adicionar em página de settings:

- Toggle "Require API Key for Uploads"
- Link para gerenciamento de API keys
- Aviso: "When enabled, only requests with valid API keys will be accepted"

## Configuração no Duplicati

Após ativar a autenticação por API key:

1. Criar uma API key no duplistatus
2. Copiar a key gerada
3. Configurar no Duplicati:

```bash
--send-http-url=http://duplistatus.example.com:9666/api/upload?api_key=SUA_API_KEY_AQUI
```

## Segurança

- ✅ API keys são armazenadas como hash bcrypt no banco
- ✅ Keys são geradas com 32 caracteres aleatórios (nanoid)
- ✅ Keys podem ser desabilitadas sem deletar
- ✅ Todas as operações são auditadas
- ✅ Last usage tracking para monitoramento
- ⚠️ **IMPORTANTE**: Keys são mostradas apenas uma vez na criação
- ⚠️ Transmissão via query parameter (considere usar HTTPS)

## Backward Compatibility

A autenticação por API key é **OPCIONAL** e **desabilitada por padrão**, mantendo compatibilidade com instalações existentes.

## TODO

- [ ] Implementar validação no /api/upload
- [ ] Criar endpoints de gerenciamento
- [ ] Criar UI de gerenciamento
- [ ] Adicionar toggle nas configurações
- [ ] Atualizar documentação do usuário
- [ ] Testar com Duplicati real
