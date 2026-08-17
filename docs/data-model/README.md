# HIM Platform · Data Model

Visual schema of the HIM Platform database.

## Files

| File | What it is | When to look at it |
|---|---|---|
| `him_schema.png` | Rendered ER diagram, colour-coded by domain | Quick visual overview |
| `him_schema.svg` | Vector version — zoom without pixelation | Print / high-quality reference |
| `him_schema.dot` | Graphviz source | Regenerate the diagram |
| `generate.py` | Script that parses `supabase/migrations/*.sql` and produces the above | Regenerate after schema changes |

## Regenerate

Whenever migrations change:

```bash
cd docs/data-model
python3 generate.py
```

Re-runs the parser, updates the `.dot` / `.svg` / `.png` files.

## What it shows

- **82 tables** grouped into 11 functional domains
- **101 foreign-key relationships** (arrows)
- Each domain has its own colour band + cluster

Domains covered:

| Domain | What lives in it |
|---|---|
| People & Programme | Candidates, cohorts, projects, consent |
| Assessment engine | Assessments and their responses |
| HIM framework | The 7 domains × 72 metrics × 148 indicators |
| Partners & placements | Employer partners + related metadata |
| Employment | Placements, retention checks, milestones |
| Training | Training programmes, sessions, attendance, certificates |
| Reporting | Cohort reports, evidence packs, quotes |
| Pricing | Dynamic Pricing Tool tables + dev-fund tracking |
| Bidding | Bid support packs |
| AI + Governance | AI cache, audit, Delphi, translations, TOMs |
| Other | Reference / auth-adjacent tables |

## Note on completeness

`partner_invitations` and `partner_users` (Azure post-migration tables) live in the `azure-app/` overlay and don't appear here — they're added by migration 060 in that folder, applied post-migration to Azure Postgres. When HIM runs on Azure they'll appear in the equivalent regenerated diagram.

## Source of truth

The diagram is a **rendered view** of the data model. The **actual source of truth** is the SQL migrations in `supabase/migrations/*.sql`. If the diagram and a migration disagree, the migration wins — regenerate.
