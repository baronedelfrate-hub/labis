# LIS - Fase 2: Coleta, Resultados e Liberação

Multi-tenant já implementado — todas as tabelas novas seguem o mesmo padrão (`company_id` + RLS via `get_user_company_id()` + escrita gated por `profiles.active = true`).

## 1. Backend (Supabase)

### Enums
- `sample_status`: `pendente`, `coletada`, `recebida`, `rejeitada`.

### Tabela `samples`
Campos: `company_id`, `order_id`, `sample_number` (int, sequencial por pedido via trigger com lock de linha em `orders`), `material`, `sector`, `status` (default `pendente`), `collected_at`, `collected_by`, `received_at`, `received_by`, `rejection_reason`.
- Unique `(order_id, sample_number)`.
- RLS: SELECT por company; INSERT/UPDATE por company + `profiles.active = true`; DELETE só admin.

### Alteração em `order_items`
- Adiciona `sample_id uuid references samples(id)`.
- Backfill: para cada `order_items.sample_number` texto existente, cria uma `sample` correspondente com material do exame e vincula. Depois `DROP COLUMN sample_number`.
- Enum `order_item_status` já existe (`pendente`, `coletado`, `com_resultado`, `liberado`).

### Tabela `results`
Campos: `company_id`, `order_item_id` (unique FK), `value` (text), `reference_min`, `reference_max` (numeric null), `unit` (text null), `observation` (text), `entered_by`, `entered_at` (default now()), `released` (bool default false), `released_by`, `released_at`. Reference/unit são snapshot do exame no momento do lançamento (nunca recalculados).
- RLS: SELECT por company; INSERT/UPDATE por company + role em (`tecnico`, `bioquimico`, `admin`) + `active`.
- **Trava de liberação por coluna** (RLS de linha não distingue mudar `value` de mudar `released`): trigger `BEFORE UPDATE` em `results` que, quando a transição `released` false→true acontece, verifica se `auth.uid()` tem role `bioquimico` ou `admin` — caso contrário `RAISE EXCEPTION 'Sem permissão para liberar resultado'`. O mesmo trigger seta `released_by = auth.uid()` e `released_at = now()` no momento da transição, para não depender do frontend enviar esses campos corretamente. Frontend continua escondendo o botão, mas a autoridade é o trigger.

### Sincronização de status (`sync_order_item_status`)
Trigger em `samples` e `results` (AFTER INSERT/UPDATE/DELETE) que recomputa `order_items.status` do(s) item(ns) afetado(s):
- `results.released = true` → `liberado`
- result lançado, `released = false` → `com_resultado`
- **sample vinculada em `rejeitada` OU sem sample** → `pendente` (volta pro início do fluxo — precisa recoletar)
- sample em `coletada`/`recebida` sem result → `coletado`

Rejeição não é estado terminal do exame: o `order_item` volta a `pendente` e reaparece na tela de Coleta como aguardando **nova coleta**. Na prática o fluxo cria uma nova sample para aquele material; a sample rejeitada fica no histórico.

### Geração automática de samples no pedido
Trigger AFTER INSERT em `order_items` que agrupa por `exams.material` dentro do `order_id` e cria/reaproveita 1 sample **ativa** (não-rejeitada) por material distinto, vinculando `order_items.sample_id`. Quando a sample de um material é rejeitada, o próximo evento de coleta cria uma nova sample para os `order_items` daquele material.

### Índices
`samples(order_id)`, `samples(company_id, status)`, `results(order_item_id)` (unique).

## 2. Frontend

Novas rotas em `src/routes/_authenticated/`:

- `coleta.tsx` — lista pedidos do dia com samples `pendente`/`coletada`, agrupadas por material. Ações: **Coletar** (batch, seta `collected_at/by`, status → `coletada`), **Receber** (status → `recebida`), **Rejeitar** (dialog com motivo, status → `rejeitada`). Pedidos com `order_items` de volta em `pendente` após rejeição aparecem destacados com badge **"Recoleta"** (heurística: existe sample anterior `rejeitada` para o mesmo `order_id` + material) para a recepção não achar que é uma coleta inicial esquecida.
- `resultados.tsx` — role `tecnico`/`bioquimico`/`admin`. Lista `order_items` com sample `recebida` e sem `results`, filtro por setor (`exams.sector`). Form inline: `value` + `observation`, mostrando `reference_min/max` e `unit` do exame; salva copiando esses valores como snapshot.
- `liberacao.tsx` — role `admin`/`bioquimico`. Lista `order_items` com result lançado e `released=false`. Ação **Liberar** individual e **Liberar pedido** (batch por `order_id`). Envia apenas `released=true`; `released_by`/`released_at` são preenchidos pelo trigger.

Atualização em `pedidos.$orderId.tsx`:
- Coluna de status por exame com badge colorido (cinza=pendente, amarelo=coletado, azul=com resultado, verde=liberado).
- Linhas com result (lançado ou liberado) são expansíveis mostrando `value`, `unit`, referência e observação.

Sidebar: novas entradas **Coleta**, **Resultados**, **Liberação** com visibilidade por role. Hook `useMyRoles()` para gate de UI; RLS + trigger continuam sendo a autoridade.

## 3. Migrations (ordem)

1. Enum `sample_status`.
2. Tabela `samples` + GRANTs + RLS + policies + trigger de `sample_number` sequencial.
3. Tabela `results` + GRANTs + RLS + policies + trigger `check_result_release` (BEFORE UPDATE).
4. `order_items`: add `sample_id`, backfill a partir de `sample_number` texto, drop coluna antiga.
5. Trigger `sync_order_item_status` (samples + results, cobrindo rejeição → pendente).
6. Trigger `auto_create_samples_for_order_item`.
7. Índices.

## Próximo passo

Ao aprovar: rodo o migration, implemento as 3 telas novas + atualização do detalhe de pedido, atualizo sidebar e hook de roles.
