/**
 * Azure Blob Storage adapter, shaped like Supabase's client.storage.
 *   client.storage.from(bucket).upload(path, body, opts)
 *   client.storage.from(bucket).download(path)
 *   client.storage.from(bucket).remove([paths])
 *   client.storage.from(bucket).list(prefix)
 *   client.storage.from(bucket).getPublicUrl(path)
 *
 * Buckets map 1:1 to Azure containers. Names lowercased/dashed per Azure rules.
 * Env: AZURE_STORAGE_CONNECTION_STRING (dev) or AZURE_STORAGE_ACCOUNT_NAME +
 * managed identity (prod).
 */

import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

let svc: BlobServiceClient | null = null;

function client(): BlobServiceClient {
  if (svc) return svc;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (conn) {
    svc = BlobServiceClient.fromConnectionString(conn);
  } else if (account) {
    svc = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      new DefaultAzureCredential(),
    );
  } else {
    throw new Error(
      '[azure-storage] set AZURE_STORAGE_CONNECTION_STRING (dev) or AZURE_STORAGE_ACCOUNT_NAME + managed identity (prod).',
    );
  }
  return svc;
}

class BlobBucket {
  constructor(private readonly bucket: string) {}
  private blob(path: string): BlockBlobClient {
    return client().getContainerClient(this.bucket).getBlockBlobClient(path);
  }
  async upload(path: string, body: Buffer | Uint8Array | Blob | ArrayBuffer, opts?: { contentType?: string; upsert?: boolean }) {
    try {
      const b = this.blob(path);
      if (!opts?.upsert && (await b.exists())) {
        return { data: null, error: { message: `Object ${path} exists`, code: 'AlreadyExists' } };
      }
      const buf: Buffer = body instanceof Buffer
        ? body
        : Buffer.from(body instanceof ArrayBuffer ? body : (body as any).buffer ?? await (body as Blob).arrayBuffer());
      await b.uploadData(buf, {
        blobHTTPHeaders: opts?.contentType ? { blobContentType: opts.contentType } : undefined,
      });
      return { data: { path, id: path, fullPath: `${this.bucket}/${path}` }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }
  async download(path: string) {
    try {
      const dl = await this.blob(path).download();
      const chunks: Buffer[] = [];
      for await (const c of dl.readableStreamBody!) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      const buffer = Buffer.concat(chunks);
      return { data: new Blob([buffer]), error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }
  async remove(paths: string[]) {
    const errors: string[] = [];
    for (const p of paths) {
      try { await this.blob(p).deleteIfExists(); } catch (e: any) { errors.push(e?.message); }
    }
    if (errors.length > 0) return { data: null, error: { message: errors.join('; ') } };
    return { data: paths.map(p => ({ name: p })), error: null };
  }
  async list(prefix = '') {
    try {
      const c = client().getContainerClient(this.bucket);
      const items: { name: string; created_at?: string; updated_at?: string }[] = [];
      for await (const b of c.listBlobsFlat({ prefix })) {
        items.push({
          name: b.name,
          created_at: b.properties.createdOn?.toISOString(),
          updated_at: b.properties.lastModified?.toISOString(),
        });
      }
      return { data: items, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }
  getPublicUrl(path: string) {
    return { data: { publicUrl: this.blob(path).url } };
  }
}

export const storage = {
  from(bucket: string) { return new BlobBucket(bucket); },
};
