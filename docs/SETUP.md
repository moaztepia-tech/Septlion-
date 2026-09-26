# Setup

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
cd apps/api && ./apply-rls.sh && cd ../..
pnpm db:seed
pnpm dev
```

The seed creates:
- `buyer@demo.septlion.com` / `ChangeMe123!`
- `sales@demo.septlion.com` / `ChangeMe123!`

Use the printed organization IDs and SKU ID.
