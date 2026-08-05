#!/usr/bin/env node
/**
 * One-time file migration: Supabase Storage → Azure Blob Storage.
 *
 * Copies every file under every Supabase bucket into the matching Azure
 * container. Database rows in `assessment_attachments` (and any other
 * table that stores a `storage_path`) don't need updating — the app
 * stores the path, not the host, and lib/azure/storage.ts serves the
 * same shape.
 *
 * Prereqs (vendor day-one):
 *   SUPABASE_URL                  — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     — service-role key (bypasses RLS)
 *   AZURE_STORAGE_CONNECTION_STRING — Azure Storage account connection
 *
 * Usage:
 *   node scripts/migrate-files.mjs                          # dry-run: counts + estimates
 *   node scripts/migrate-files.mjs --commit                 # actually copy
 *   node scripts/migrate-files.mjs --commit --bucket=assessment-evidence
 *   node scripts/migrate-files.mjs --verify                 # spot-check checksums
 *
 * Notes:
 *   - Idempotent per file: skip when target already exists and matches size.
 *   - Concurrency: 8 in flight (tune via --concurrency=N).
 *   - Buckets migrated: everything Supabase has, in one pass. Explicit
 *     --bucket=NAME limits to one bucket.
 */

import { createClient } from '@supabase/supabase-js';
import { BlobServiceClient } from '@azure/storage-blob';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const COMMIT = args.commit === 'true';
const VERIFY = args.verify === 'true';
const CONCURRENCY = parseInt(args.concurrency ?? '8', 10);
const BUCKET_FILTER = args.bucket ?? null;

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`✗ Missing env var ${name}`);
    process.exit(1);
  }
  return process.env[name];
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  const supaUrl = requireEnv('SUPABASE_URL');
  const supaKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const azureConn = requireEnv('AZURE_STORAGE_CONNECTION_STRING');

  const supabase = createClient(supaUrl, supaKey);
  const azure = BlobServiceClient.fromConnectionString(azureConn);

  // Discover buckets. Supabase's admin API is what lists them.
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  if (bucketsErr) {
    console.error('✗ Could not list buckets: ' + bucketsErr.message);
    process.exit(1);
  }
  let bucketList = buckets.map((b) => b.name);
  if (BUCKET_FILTER) bucketList = bucketList.filter((n) => n === BUCKET_FILTER);
  log(`Buckets in scope: ${bucketList.join(', ') || '(none)'}`);

  let totalFiles = 0;
  let totalBytes = 0;
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const bucket of bucketList) {
    log(`\n▶ ${bucket}`);
    const container = azure.getContainerClient(bucket);
    if (COMMIT) {
      await container.createIfNotExists();
    }

    const files = await listAllFiles(supabase, bucket);
    log(`  ${files.length} file(s)`);
    totalFiles += files.length;

    // Process in bounded-concurrency batches.
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (f) => {
        totalBytes += f.metadata?.size ?? 0;
        if (!COMMIT && !VERIFY) return;
        try {
          const blob = container.getBlockBlobClient(f.path);
          if (COMMIT) {
            const exists = await blob.exists();
            if (exists) {
              const props = await blob.getProperties();
              if (props.contentLength === f.metadata?.size) {
                skipped++;
                return;
              }
            }
            const { data: dl, error: dlErr } = await supabase.storage
              .from(bucket)
              .download(f.path);
            if (dlErr || !dl) {
              failed++;
              errors.push(`${bucket}/${f.path}: ${dlErr?.message ?? 'download failed'}`);
              return;
            }
            const buf = Buffer.from(await dl.arrayBuffer());
            await blob.uploadData(buf, {
              blobHTTPHeaders: f.metadata?.mimetype
                ? { blobContentType: f.metadata.mimetype }
                : undefined,
            });
            copied++;
          }
          if (VERIFY) {
            const exists = await blob.exists();
            if (!exists) {
              failed++;
              errors.push(`${bucket}/${f.path}: verify — target missing`);
            }
          }
        } catch (e) {
          failed++;
          errors.push(`${bucket}/${f.path}: ${e?.message ?? String(e)}`);
        }
      }));
      process.stdout.write(`  ${Math.min(i + CONCURRENCY, files.length)}/${files.length}\r`);
    }
    console.log();
  }

  log(`\n=== Summary ===`);
  log(`Total files:        ${totalFiles}`);
  log(`Total bytes:        ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  if (COMMIT) {
    log(`Copied:             ${copied}`);
    log(`Skipped (present):  ${skipped}`);
  }
  if (failed > 0) {
    log(`Failed:             ${failed}`);
    console.error('\nFirst 10 errors:');
    errors.slice(0, 10).forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  if (!COMMIT && !VERIFY) {
    log(`\nDry-run. Re-run with --commit to actually copy.`);
  }
}

async function listAllFiles(supabase, bucket) {
  // Recursively list every file. Supabase's list() returns one page
  // per prefix — we walk the tree so nested folders are captured.
  const out = [];
  const queue = [''];
  while (queue.length) {
    const prefix = queue.shift();
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) {
        console.error(`  ! list error on ${bucket}/${prefix}: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      for (const item of data) {
        // Folder entries have id === null in Supabase's API.
        if (item.id === null || item.metadata?.eTag === undefined) {
          queue.push(prefix ? `${prefix}/${item.name}` : item.name);
        } else {
          out.push({ path: prefix ? `${prefix}/${item.name}` : item.name, metadata: item.metadata });
        }
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  return out;
}

main().catch((e) => {
  console.error('✗ ' + (e?.stack ?? e));
  process.exit(1);
});
