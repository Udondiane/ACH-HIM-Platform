import { Clock, ArrowRight, User, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ChangeLogRow {
  id: string;
  changed_at: string;
  changed_by: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

interface StatusTransitionRow {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
}

interface AccessLogRow {
  id: string;
  accessed_at: string;
  accessed_by: string | null;
  access_type: string;
  route: string | null;
}

interface Props {
  changes: ChangeLogRow[];
  transitions: StatusTransitionRow[];
  accesses: AccessLogRow[];
}

/**
 * Change history panel for the candidate detail page.
 *
 * Shows three interleaved audit streams from migration 065:
 *   - Field edits (candidate_change_log)
 *   - Status transitions (candidate_status_transitions)
 *   - Read accesses (candidate_access_log)
 *
 * Sorted by timestamp, newest first. Field-level display formats
 * old→new values inline, truncating long text so the panel stays
 * scannable at a glance.
 */
export function ChangeHistoryPanel({ changes, transitions, accesses }: Props) {
  type Event =
    | { kind: 'change'; row: ChangeLogRow }
    | { kind: 'status'; row: StatusTransitionRow }
    | { kind: 'access'; row: AccessLogRow };

  const events: Event[] = [
    ...changes.map(row => ({ kind: 'change' as const, row })),
    ...transitions.map(row => ({ kind: 'status' as const, row })),
    ...accesses.map(row => ({ kind: 'access' as const, row })),
  ];
  events.sort((a, b) => {
    const ta = new Date(a.kind === 'change' ? a.row.changed_at : a.kind === 'status' ? a.row.changed_at : a.row.accessed_at).getTime();
    const tb = new Date(b.kind === 'change' ? b.row.changed_at : b.kind === 'status' ? b.row.changed_at : b.row.accessed_at).getTime();
    return tb - ta;
  });

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Change history</div>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-ach-navy/60 italic">
            No recorded changes or accesses yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Change history</div>
        <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
          Every field edit, status transition and record view — newest first. Populated automatically by database triggers + server-side access logging.
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-ach-border">
          {events.slice(0, 100).map((ev, i) => (
            <li key={i} className="py-2.5 text-[12.5px]">
              <EventRow ev={ev} />
            </li>
          ))}
        </ul>
        {events.length > 100 && (
          <div className="text-[11px] text-ach-navy/50 pt-2 mt-1 border-t-[0.5px] border-ach-border">
            Showing 100 most recent of {events.length} total events.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventRow({ ev }: { ev:
  | { kind: 'change'; row: ChangeLogRow }
  | { kind: 'status'; row: StatusTransitionRow }
  | { kind: 'access'; row: AccessLogRow }
}) {
  const ts = ev.kind === 'change' ? ev.row.changed_at
    : ev.kind === 'status' ? ev.row.changed_at
    : ev.row.accessed_at;
  const when = new Date(ts).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const actor = ev.kind === 'change' ? ev.row.changed_by
    : ev.kind === 'status' ? ev.row.changed_by
    : ev.row.accessed_by;

  if (ev.kind === 'change') {
    const oldVal = truncate(ev.row.old_value);
    const newVal = truncate(ev.row.new_value);
    return (
      <div className="flex items-start gap-2.5">
        <User className="h-3.5 w-3.5 mt-0.5 text-ach-navy/40 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-ach-navy">
            Edited <span className="font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">{ev.row.field_name}</span>
          </div>
          <div className="text-[11.5px] text-ach-navy/70 mt-0.5 [overflow-wrap:anywhere]">
            <span className="text-ach-navy/45">{oldVal || 'empty'}</span>
            <ArrowRight className="inline h-3 w-3 mx-1 text-ach-navy/40" />
            <span>{newVal || 'empty'}</span>
          </div>
          <div className="text-[10.5px] text-ach-navy/50 mt-0.5">{when} {actor && `· by user ${actor.slice(0, 8)}…`}</div>
        </div>
      </div>
    );
  }

  if (ev.kind === 'status') {
    return (
      <div className="flex items-start gap-2.5">
        <Clock className="h-3.5 w-3.5 mt-0.5 text-[#B8843C] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-ach-navy">
            Status changed:{' '}
            <span className="font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">{ev.row.from_status ?? '(created)'}</span>
            <ArrowRight className="inline h-3 w-3 mx-1 text-ach-navy/40" />
            <span className="font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">{ev.row.to_status}</span>
          </div>
          <div className="text-[10.5px] text-ach-navy/50 mt-0.5">{when} {actor && `· by user ${actor.slice(0, 8)}…`}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <Eye className="h-3.5 w-3.5 mt-0.5 text-ach-navy/40 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-ach-navy/75">
          Record {ev.row.access_type === 'view' ? 'viewed' : ev.row.access_type === 'export' ? 'exported' : 'included in report'}
          {ev.row.route && <span className="text-ach-navy/50 ml-1 font-mono text-[11px]">{ev.row.route}</span>}
        </div>
        <div className="text-[10.5px] text-ach-navy/50 mt-0.5">{when} {actor && `· by user ${actor.slice(0, 8)}…`}</div>
      </div>
    </div>
  );
}

function truncate(v: string | null | undefined, max = 80): string {
  if (!v) return '';
  return v.length > max ? v.slice(0, max) + '…' : v;
}
