'use client';

import { useRef, useState, useTransition } from 'react';
import { Paperclip, Trash2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  uploadAssessmentAttachmentAction,
  deleteAssessmentAttachmentAction,
  getAttachmentDownloadUrlAction,
} from '@/lib/attachments/actions';

export interface Attachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

function formatBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentUploader({
  assessmentId,
  initialAttachments,
  locked,
}: {
  assessmentId: string;
  initialAttachments: Attachment[];
  locked?: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = () => fileRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await uploadAssessmentAttachmentAction(assessmentId, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAttachments(prev => [
        ...prev,
        {
          id: result.id,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDelete = (id: string) => {
    if (!confirm('Delete this attachment?')) return;
    startTransition(async () => {
      await deleteAssessmentAttachmentAction(id);
      setAttachments(prev => prev.filter(a => a.id !== id));
    });
  };

  const onDownload = async (id: string, fileName: string) => {
    const result = await getAttachmentDownloadUrlAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const a = document.createElement('a');
    a.href = result.url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Evidence attachments</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Interview recordings, certificates, photos. Max 25MB each.</div>
        </div>
        {!locked && (
          <>
            <input ref={fileRef} type="file" hidden onChange={onChange} />
            <Button type="button" variant="secondary" onClick={onPick} disabled={uploading}>
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</> : <><Paperclip className="h-3.5 w-3.5" />Attach file</>}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="text-[12px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mb-3">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="text-[12.5px] text-ach-navy/55 italic">No attachments yet.</div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-2.5 rounded-[10px] border-[0.5px] border-ach-border bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="h-3.5 w-3.5 text-ach-navy/55 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] text-ach-navy truncate">{a.file_name}</div>
                  <div className="text-[11px] text-ach-navy/55">
                    {formatBytes(a.size_bytes)} · {new Date(a.uploaded_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onDownload(a.id, a.file_name)}
                  className="p-1.5 rounded-[8px] text-ach-navy/60 hover:bg-ach-page hover:text-ach-navy transition-colors"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={pending}
                    className="p-1.5 rounded-[8px] text-ach-navy/60 hover:bg-ach-rose/10 hover:text-[#8B3A4F] transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
