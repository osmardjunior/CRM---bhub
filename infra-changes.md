# Infra Changes — Evolution API (Railway)

**Data:** 2026-05-26
**Serviço:** noble-wisdom (Evolution API v2.3.7)
**URL:** https://noble-wisdom-production-168b.up.railway.app

## Diagnóstico (antes das mudanças)
- 146 instâncias no total (16 open, 23 connecting, 107 close)
- 130 instâncias mortas consumindo recursos
- 2.4M mensagens no Baileys DB
- 87 desconexões por `device_removed` (401)
- 31 desconexões por `Connection Failure` (403) — indica perda de sessão
- Sem volume persistente em `/evolution/instances`
- Variáveis críticas ausentes

## Mudanças Aplicadas

### 1. Volume persistente
- [x] Criado volume Railway montado em `/evolution/instances` (5GB) — via UI Railway

### 2. Variáveis de ambiente (adicionadas via GraphQL API)
- [x] `CACHE_REDIS_SAVE_INSTANCES=true`
- [x] `CACHE_LOCAL_ENABLED=false`
- [x] `DEL_INSTANCE=false`
- [x] `QRCODE_LIMIT=10`
- [x] `DATABASE_SAVE_DATA_LABELS=true`
- [x] `DATABASE_SAVE_DATA_HISTORIC=true`
- [x] `LANGUAGE=pt-BR`
- [x] `LOG_BAILEYS=error`
- [x] `LOG_LEVEL=ERROR,WARN`
- [x] `DEBUG=false`

### 3. Variáveis existentes (verificadas OK)
- [x] `DATABASE_PROVIDER=postgresql`
- [x] `DATABASE_SAVE_DATA_INSTANCE=true`
- [x] `CACHE_REDIS_ENABLED=true`
- [x] `DATABASE_CONNECTION_URI` — postgresql://...@crossover.proxy.rlwy.net:57373/railway

### 4. Healthcheck
- [x] Path: `/`
- [x] Timeout: 30s
- [x] Restart policy: ON_FAILURE (max 5 retries)

### 5. Redeploy + monitoramento
- [x] Redeploy do serviço (deploy ID: a02c22d7-0e87-4f8e-abab-51a26a1a020a)
- [x] API respondendo: `{"status":200,"message":"Welcome to the Evolution API, it is working!","version":"2.3.7"}`
- [x] Sem erros de QR code loop
- [ ] Instâncias em `connecting` precisam novo QR (sessões perdidas — ver nota abaixo)

## Resultado Pós-Redeploy

| Estado | Quantidade | Nota |
|--------|-----------|------|
| **close** | 107 | Instâncias mortas (device_removed/conn_failure antigos) |
| **connecting** | 39 | Tentando reconectar — sessões perdidas |
| **open** | 0 | Nenhuma reconectou automaticamente |

### Nota: Sessões perdidas no redeploy
Como **não havia volume persistente antes**, os dados de sessão Baileys estavam apenas no filesystem efêmero do container. Ao reiniciar, TODAS as sessões foram perdidas. As 26 instâncias que estavam ativas (sem disconnect prévio) agora precisam de **novo QR code**.

**A partir de agora**, com o volume em `/evolution/instances` + `CACHE_REDIS_SAVE_INSTANCES=true`, as sessões serão persistidas entre restarts.

### Ação necessária
As instâncias ativas precisam ser reconectadas via QR code no CRM.

## Comandos Executados

```
# 1. Set 10 variáveis via Railway GraphQL API (backboard.railway.app/graphql/v2)
mutation variableCollectionUpsert — projectId: f5dc7de7, envId: 598ba72e, serviceId: 728e7d6a

# 2. Configurar healthcheck + restart policy
mutation serviceInstanceUpdate — healthcheckPath: "/", healthcheckTimeout: 30, restartPolicyType: ON_FAILURE

# 3. Volume criado via UI Railway
Mount: /evolution/instances, Size: 5GB

# 4. Redeploy
mutation deploymentRedeploy — deployId: 9b4a1012 → novo deploy a02c22d7 (SUCCESS)
```

## IDs Railway
- Project: `f5dc7de7-eaad-4dba-98f2-b5dc08eda3ed` (stunning-analysis)
- Environment: `598ba72e-dc4e-4db0-aba8-9121660aeeb1`
- Service: `728e7d6a-bfd9-4d71-8896-8612e900c506` (noble-wisdom)
