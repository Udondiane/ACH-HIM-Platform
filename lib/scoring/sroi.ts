/* SROI translation: convert per-domain capability uplift into a £
   social value figure using SROI proxy values per domain.

   Approach: proportional valuation. A candidate whose Employment
   capability rose from 1.5 -> 3.5 (an uplift of 2.0 on a 0-5 scale)
   contributes (2.0 / 5) * proxy_value to the SROI total for Employment.
   This treats the proxy as the value of FULL capability achievement
   and reports a proportional fraction based on observed change. */

export interface SroiProxy {
  capability: string;
  proxy_label: string;
  proxy_value_pence: number;
}

export interface DomainUplift {
  domain: string;
  upliftCompleters: number | null;
  upliftItt: number | null;
  completersN: number;
  starterN: number;
}

export interface SroiClaim {
  capability: string;
  proxy_label: string;
  proxy_value_gbp: number;
  uplift_completers: number | null;
  uplift_itt: number | null;
  completersN: number;
  starterN: number;
  total_completers_gbp: number;
  total_itt_gbp: number;
}

export function computeSroi(uplift: DomainUplift[], proxies: SroiProxy[]): {
  byDomain: SroiClaim[];
  totalCompleters: number;
  totalItt: number;
} {
  const proxyMap = new Map(proxies.map(p => [p.capability, p]));
  const byDomain: SroiClaim[] = [];
  let totalCompleters = 0;
  let totalItt = 0;

  for (const u of uplift) {
    const p = proxyMap.get(u.domain);
    if (!p) continue;
    const proxyGbp = p.proxy_value_pence / 100;
    /* Proportional uplift on 0-5 scale -> fraction of proxy applied
       per candidate, summed across the cohort. ITT denominator is
       starterN; completers denominator is completersN. */
    const fractionCompleters = u.upliftCompleters != null ? Math.max(0, u.upliftCompleters / 5) : 0;
    const fractionItt = u.upliftItt != null ? Math.max(0, u.upliftItt / 5) : 0;
    const totalC = fractionCompleters * proxyGbp * u.completersN;
    const totalI = fractionItt * proxyGbp * u.starterN;
    byDomain.push({
      capability: u.domain,
      proxy_label: p.proxy_label,
      proxy_value_gbp: proxyGbp,
      uplift_completers: u.upliftCompleters,
      uplift_itt: u.upliftItt,
      completersN: u.completersN,
      starterN: u.starterN,
      total_completers_gbp: totalC,
      total_itt_gbp: totalI,
    });
    totalCompleters += totalC;
    totalItt += totalI;
  }

  return { byDomain, totalCompleters, totalItt };
}
