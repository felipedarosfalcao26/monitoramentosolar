# Vistoria Solar — Plataforma de Vigilância

Plataforma de monitoramento de vistorias em usinas solares fotovoltaicas: leitura de QR Codes em campo, captura automática de GPS/horário, mapa de trajeto, dashboard gerencial e relatórios. MVP (Fase 1).

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

- `src/app/admin/*` — back-office (dashboard, usinas, equipamentos, mapa, relatórios, usuários)
- `src/app/scan` — fluxo mobile do vigilante (ler QR → GPS → confirmação)
- `src/app/api/*` — rotas da API (auth, usinas, equipamentos, QR Codes, leituras, dashboard)
- `src/proxy.ts` — middleware de autenticação/RBAC (convenção "proxy" do Next.js 16)
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

## Próximas fases

- Fase 2: rotas planejadas, rondas, ocorrências, fotos, alertas, geofencing, funcionamento offline.
- Fase 3: BI avançado, integrações (SCADA/O&M/IoT), IA para análise de ocorrências.
