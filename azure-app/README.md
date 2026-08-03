# HIM · Azure-native

Replica of the parent Supabase/Vercel app (`../`) built to run in ACH's Microsoft environment. Every page, component and server action is copied in verbatim — data access is transparently routed through an Azure adapter (Postgres · Blob Storage · Entra ID) so no application code needed touching.

```bash
cd azure-app
cp .env.example .env             # fill DATABASE_URL + Entra values
npm install
npm run db:migrate               # runs every supabase/migrations/*.sql on Azure Postgres
npm run dev                      # http://localhost:3100
```

See [`AZURE-HANDOVER.md`](./AZURE-HANDOVER.md) for the full provisioning + handover pack (stack diagram, resource provisioning steps, three vendor work items, nonprofit-discount setup).
