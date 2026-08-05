'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'assessment-evidence';
const MAX_SIZE = 25 * 1024 * 1024; // 25MB per file

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

export async function deleteAssessmentAttachmentAction(attachmentId: string) {
  const supabase = createClient();
  const { data: row } = await supabase
    .from('assessment_attachments').select('storage_path, assessment_id').eq('id', attachmentId).maybeSingle();
  if (row) {
    await supabase.storage.from(BUCKET).remove([(row as { storage_path: string }).storage_path]);
    await supabase.from('assessment_attachments').delete().eq('id', attachmentId);
  }
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
