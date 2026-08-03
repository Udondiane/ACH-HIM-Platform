import { cn } from '@/lib/utils';

/**
 * Displays a candidate's identity — the name in normal mode, the
 * candidate reference in privacy mode. The swap is CSS-driven and keys
 * off the `privacy-mode` class on <body> managed by PrivacyModeToggle.
 *
 * Both name and reference are rendered into the DOM so the swap is
 * instant and CSS-only — no re-render required when the user toggles.
 *
 * Usage:
 *   <CandidateIdentity candidate={c} />
 *   <CandidateIdentity candidate={c} showRef />  // ref appears next to name in normal mode
 */
export function CandidateIdentity({
  candidate,
  showRef = false,
  className = '',
}: {
  candidate: {
    candidate_ref: string;
    given_name?: string | null;
    family_name?: string | null;
    preferred_name?: string | null;
  };
  showRef?: boolean;
  className?: string;
}) {
  const displayName = [candidate.preferred_name || candidate.given_name, candidate.family_name]
    .filter(Boolean)
    .join(' ')
    .trim() || candidate.candidate_ref;

  return (
    <span className={cn('inline', className)}>
      <span className="identity-name">
        {displayName}
        {showRef && <span className="text-ach-navy/45 ml-1.5 text-[0.9em]">·&nbsp;{candidate.candidate_ref}</span>}
      </span>
      <span className="identity-ref">{candidate.candidate_ref}</span>
    </span>
  );
}
