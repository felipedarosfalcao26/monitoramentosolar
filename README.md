# Vistoria Solar — Plataforma de Vigilância

Plataforma de monitoramento de vistorias em usinas solares fotovoltaicas: leitura de QR Codes em campo, captura automática de GPS/horário, mapa de trajeto, rotas e rondas planejadas, ocorrências, alertas e dashboard gerencial. Fases 1 e 2 concluídas.

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS
- Prisma + SQLite (dev) — troque o `datasource` em `prisma/schema.prisma` para Postgres em produção
- Autenticação por sessão JWT em cookie httpOnly (`jose`), senhas com `bcryptjs`
- QR Code: geração com `qrcode`, leitura em câmera com `html5-qrcode`
- Mapa: Leaflet + OpenStreetMap (`react-leaflet`)

## Como rodar

```bash
npm install
npm run db:migrate   # aplica as migrations do Prisma
npm run db:seed       # cria usuários e dados de exemplo
npm run dev
```

Acesse http://localhost:3000.

## Usuários de teste (criados pelo seed)

| Perfil     | E-mail                        | Senha         |
|------------|-------------------------------|---------------|
| Admin      | admin@vistoriasolar.com       | admin123      |
| Gestor     | gestor@vistoriasolar.com      | gestor123     |
| Vigilante  | vigilante@vistoriasolar.com   | vigilante123  |

## Estrutura

- `src/app/admin/*` — back-office (dashboard, usinas, equipamentos, rotas, rondas, ocorrências, mapa, relatórios, usuários)
- `src/app/scan` — fluxo mobile do vigilante (iniciar ronda → ler QR → GPS → confirmação → ocorrência)
- `src/app/api/*` — rotas da API (auth, usinas, equipamentos, QR Codes, leituras, rotas, rondas, ocorrências, alertas, upload de fotos, dashboard)
- `src/proxy.ts` — middleware de autenticação/RBAC (convenção "proxy" do Next.js 16)
- `src/lib/offlineQueue.ts` — fila local (IndexedDB/Dexie) para leituras feitas sem internet
- `prisma/schema.prisma` — modelo de dados

## Variáveis de ambiente (`.env`)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="troque-em-producao"
GEO_TOLERANCE_OK_METERS=20
GEO_TOLERANCE_ATTENTION_METERS=50
```

## Escopo da Fase 1 (concluído)

Login, usuários, usinas, equipamentos, geração/leitura de QR Code, GPS, histórico de leituras, mapa e trajeto, dashboard, relatório (com exportação CSV), controle de permissões por perfil (Administrador / Gestor / Vigilante).

## Escopo da Fase 2 (concluído)

- **Rotas planejadas**: sequência ordenada de pontos por usina, turno, dias da semana e tolerância de horário (`/admin/routes`).
- **Rondas**: o vigilante inicia uma ronda (usina + rota opcional) pelo `/scan`; cada leitura fica vinculada à ronda; ao encerrar, calcula-se pontos visitados/planejados, % de conclusão, duração e distância percorrida (`/admin/rounds`).
- **Ocorrências**: registro de campo (categoria, severidade, descrição, foto) opcionalmente vinculado a uma leitura (`/admin/occurrences`).
- **Fotos**: upload local em `public/uploads` via `/api/uploads` (trocar por S3/R2 é só reescrever esse handler).
- **Alertas automáticos**: ronda incompleta, leitura inconsistente (fora da tolerância de GPS) e ocorrência crítica — aparecem no dashboard e podem ser resolvidos.
- **Funcionamento offline**: leituras feitas sem internet são guardadas em IndexedDB (Dexie) no dispositivo e sincronizadas automaticamente ao reconectar, preservando o horário original da captura.

## Próxima fase

- Fase 3: BI avançado, integrações (SCADA/O&M/IoT), IA para análise de ocorrências, geofencing por polígono.
