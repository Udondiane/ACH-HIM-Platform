'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'assessment-evidence';
const MAX_SIZE = 25 * 1024 * 1024; // 25MB per file

// Allow-list of accepted MIME types. Historically we accepted anything
// up to 25MB, including `.html`, `.svg`, `.js` — files that would
// execute if ever served publicly. Assessors upload PDFs, images,
// audio recordings, and Word docs; nothing else is expected.
const ALLOWED_MIME_PREFIXES = [
  'image/',       // png, jpeg, webp, heic, tiff
  'audio/',       // webm, ogg, mp3, m4a, wav
  'video/mp4',    // occasional video evidence
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

function isAllowedMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const lower = mime.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some(prefix =>
    prefix.endsWith('/') ? lower.startsWith(prefix) : lower === prefix
  );
}

export type UploadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function uploadAssessmentAttachmentAction(
  assessmentId: string,
  formData: FormData,
): Promise<UploadResult> {
  const file = formData.get('file') as File | null;
  if (!file || typeof file === 'string') return { ok: false, error: 'No file provided' };
  if (file.size === 0) return { ok: false, error: 'Empty file' };
  if (file.size > MAX_SIZE) return { ok: false, error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` };
  if (!isAllowedMime(file.type)) {
    return { ok: false, error: `File type not accepted (${file.type || 'unknown'}). Allowed: images, audio, PDF, Word/Excel, plain text.` };
  }

  const supabase = createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
  const storagePath = `${assessmentId}/${ts}-${safeName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: row, error: rowErr } = await supabase
    .from('assessment_attachments')
    .insert({
      assessment_id: assessmentId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userRes?.user?.id ?? null,
    } as never)
    .select('id')
    .single();

  if (rowErr) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: rowErr.message };
  }

  revalidatePath(`/projects/[id]/assess/${assessmentId}`, 'page');
  return { ok: true, id: (row as { id: string }).id };
}

export async function deleteAssessmentAttachmentAction(
  attachmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: row, error: readErr } = await supabase
    .from('assessment_attachments')
    .select('storage_path, assessment_id')
    .eq('id', attachmentId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: true }; // already gone; idempotent

  // Delete the DB row FIRST. If we deleted storage first and the DB
  // delete failed, we'd have a row pointing at a nonexistent blob —
  // the download flow then hard-fails. If DB delete succeeds and
  // storage delete fails, we have an orphan blob (cost only, not a
  // correctness bug) — log it so ICT can reconcile.
  const { error: rowErr } = await supabase
    .from('assessment_attachments')
    .delete()
    .eq('id', attachmentId);
  if (rowErr) return { ok: false, error: rowErr.message };

  const path = (row as { storage_path: string }).storage_path;
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([path]);
  if (storageErr) {
    // Non-fatal — the DB row is gone, so the app doesn't see the
    // attachment any more. Log an orphan for cleanup.
    console.warn(
      `[attachments] orphan blob after delete: bucket=${BUCKET} path=${path} — reason: ${storageErr.message}`,
    );
  }
  return { ok: true };
}

export async function getAttachmentDownloadUrlAction(attachmentId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: row } = await supabase
    .from('assessment_attachments').select('storage_path, file_name').eq('id', attachmentId).maybeSingle();
  if (!row) return { ok: false, error: 'Attachment not found' };
  const path = (row as { storage_path: string }).storage_path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create download URL' };
  return { ok: true, url: data.signedUrl };
}
