# HIM · Azure-native

Replica of the parent Supabase/Vercel app (`../`) built to run in ACH's Microsoft environment. Every page, component and server action from the parent runs verbatim — data access is transparently routed through an Azure adapter (Postgres · Blob Storage · Entra ID) so no application code needed touching.

**This folder is an overlay, not a full copy.** Only the ~15 Azure-specific files are tracked here; parent files bootstrap in on demand.

```bash
cd azure-app
bash bootstrap.sh                # copies parent files in (idempotent, ~5 seconds)
cp .env.example .env             # fill DATABASE_URL + Entra values
npm install
npm run db:migrate               # runs every supabase/migrations/*.sql on Azure Postgres
npm run dev                      # http://localhost:3100
```

See [`AZURE-HANDOVER.md`](./AZURE-HANDOVER.md) for the full provisioning + handover pack (stack, resource provisioning, vendor scope, nonprofit discount, migration scripts, sign-in flow).
