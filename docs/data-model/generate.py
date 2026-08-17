#!/usr/bin/env python3
"""Parse HIM Postgres migrations and generate an ER diagram (Graphviz DOT)."""
import re
import os
import sys
from pathlib import Path

MIGRATIONS_DIR = Path("/home/user/ACH-HIM-Platform/supabase/migrations")
OUT_DIR = Path("/tmp/claude-0/-home-user-ACH-HIM-Platform/610af84a-fa07-50b8-a791-a8cb78da25b6/scratchpad/schema")

DOMAIN_GROUPS = {
    "People & Programme": ["candidates", "cohorts", "cohort_candidates", "projects", "project_activities",
                            "project_capabilities", "project_data_providers", "project_training_programmes",
                            "candidate_consent", "candidate_support"],
    "Assessment engine": ["assessments", "assessment_responses", "assessment_factor_responses",
                          "assessment_attachments", "activity_factors", "factor_domains", "follow_up_dispatches"],
    "HIM framework": ["domains", "factors", "indicators", "equivalence_applications", "equivalence_values"],
    "Partners & placements": ["partners", "partner_contacts", "partner_access_tokens", "partner_shortlist",
                              "partner_question_sets", "partner_question_items", "partner_tier_status",
                              "partner_tier_history", "partner_growth_observations", "cohort_partners"],
    "Employment": ["placements", "placement_offers", "placement_milestones", "placement_retention_checks",
                   "milestone_reviews", "beneficiary_outcomes"],
    "Training": ["training_catalogue", "training_programmes", "training_enrolments", "training_sessions",
                 "training_session_notes", "training_attendance", "training_certificates",
                 "training_learning_outcomes", "training_learning_outcome_map", "training_requests"],
    "Reporting": ["evidence_packs", "evidence_pack_sections", "cohort_reports", "cohort_narrative_synthesis",
                  "cohort_toms_claims", "engagement_reports", "career_progression_reports", "featured_quotes",
                  "candidate_interviews"],
    "Pricing": ["pricing_parameters", "pricing_quotes", "pricing_quote_lines", "dev_fund_credits",
                "development_fund_balances", "sroi_proxies"],
    "Bidding": ["bids", "bid_financial_frameworks", "bid_framework_domain_proxies"],
    "AI + Governance": ["ai_draft_cache", "ai_draft_calls", "ai_score_suggestions", "audit_entries",
                        "candidate_training", "delphi_experts", "delphi_panels", "delphi_rounds",
                        "delphi_responses", "inclusion_assessments", "inclusion_dimensions",
                        "translation_snapshots", "toms_codes", "toms_crosswalk"],
    "Partner sign-in (new)": ["partner_invitations", "partner_users"],
}

# Colour palette per domain
DOMAIN_COLOURS = {
    "People & Programme":       "#D9E7C7",
    "Assessment engine":        "#C7E1E7",
    "HIM framework":            "#E7C7DE",
    "Partners & placements":    "#F5DBDF",
    "Employment":               "#F4E4C4",
    "Training":                 "#D6DCF0",
    "Reporting":                "#E9E9E9",
    "Pricing":                  "#FCE5B3",
    "Bidding":                  "#F0D6C7",
    "AI + Governance":          "#D4D4D4",
    "Partner sign-in (new)":    "#F5DBDF",
}

def parse_sql(text):
    """Return list of (table_name, [(fk_column, fk_table)]) tuples."""
    tables = {}
    fks = []
    # Remove SQL comments (both -- line and /* block */)
    text = re.sub(r'--[^\n]*', '', text)
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    # Find each CREATE TABLE and capture its body
    for m in re.finditer(r'create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-z_]+)\s*\(([^;]+?)\)\s*;', text, re.IGNORECASE | re.DOTALL):
        tname = m.group(1).lower()
        body = m.group(2)
        tables[tname] = body
        # Foreign key patterns:
        # references (public.)?<table>[(col)]
        for ref_m in re.finditer(r'references\s+(?:public\.)?([a-z_]+)\s*\(', body, re.IGNORECASE):
            target = ref_m.group(1).lower()
            fks.append((tname, target))
    # Also catch CREATE OR REPLACE VIEW (skip — not tables)
    return tables, fks

def build_dot(all_tables, all_fks):
    lines = []
    lines.append('digraph HIM_schema {')
    lines.append('  graph [rankdir=LR, splines=ortho, nodesep=0.30, ranksep=0.60, fontname="Helvetica"];')
    lines.append('  node [shape=box, style="filled,rounded", fontname="Helvetica", fontsize=11, margin="0.12,0.06"];')
    lines.append('  edge [color="#555555", arrowhead=vee, arrowsize=0.7];')
    lines.append('')

    # Cluster by domain
    ungrouped = set(all_tables) - {t for lst in DOMAIN_GROUPS.values() for t in lst}
    for i, (domain, tables_in) in enumerate(DOMAIN_GROUPS.items()):
        present = [t for t in tables_in if t in all_tables]
        if not present:
            continue
        colour = DOMAIN_COLOURS.get(domain, "#eeeeee")
        lines.append(f'  subgraph cluster_{i} {{')
        lines.append(f'    label = "{domain}";')
        lines.append(f'    fontsize = 13;')
        lines.append(f'    fontname = "Helvetica-Bold";')
        lines.append(f'    style = filled;')
        lines.append(f'    fillcolor = "#f9f9f9";')
        lines.append(f'    color = "#bbbbbb";')
        for t in present:
            lines.append(f'    "{t}" [fillcolor="{colour}"];')
        lines.append('  }')
        lines.append('')

    if ungrouped:
        lines.append('  subgraph cluster_other {')
        lines.append('    label = "Other";')
        for t in sorted(ungrouped):
            lines.append(f'    "{t}" [fillcolor="#eeeeee"];')
        lines.append('  }')

    # Foreign key edges
    seen = set()
    for src, tgt in all_fks:
        if (src, tgt) in seen or src == tgt:
            continue
        if tgt not in all_tables:
            continue
        seen.add((src, tgt))
        lines.append(f'  "{src}" -> "{tgt}";')

    lines.append('}')
    return '\n'.join(lines)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_tables = {}
    all_fks = []
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        with open(f) as fh:
            text = fh.read()
        tables, fks = parse_sql(text)
        all_tables.update(tables)
        all_fks.extend(fks)

    print(f"Parsed {len(all_tables)} tables, {len(all_fks)} foreign-key relationships")

    dot = build_dot(all_tables, all_fks)
    dot_path = OUT_DIR / "him_schema.dot"
    dot_path.write_text(dot)
    print(f"Wrote {dot_path}")

    # Render SVG + PNG
    import subprocess
    svg_path = OUT_DIR / "him_schema.svg"
    png_path = OUT_DIR / "him_schema.png"
    subprocess.run(["dot", "-Tsvg", str(dot_path), "-o", str(svg_path)], check=True)
    subprocess.run(["dot", "-Tpng", "-Gdpi=140", str(dot_path), "-o", str(png_path)], check=True)
    print(f"Wrote {svg_path}")
    print(f"Wrote {png_path}")

    # Also produce a Mermaid version for the repo (renders inline in GitHub)
    mermaid_lines = ["```mermaid", "erDiagram"]
    for src, tgt in sorted(set([(s, t) for s, t in all_fks if s != t and t in all_tables])):
        mermaid_lines.append(f"    {tgt} ||--o{{ {src} : \"has\"")
    mermaid_lines.append("```")
    (OUT_DIR / "him_schema.mmd.md").write_text('\n'.join(mermaid_lines))
    print(f"Wrote mermaid diagram")


if __name__ == "__main__":
    main()
