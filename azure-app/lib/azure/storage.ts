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

import {
  BlobServiceClient,
  BlockBlobClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
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
      const buf: Buffer =
        body instanceof Buffer ? body
        // Uint8Array must be viewed with byteOffset/byteLength — the
        // underlying ArrayBuffer can be larger than the view. Simply
        // wrapping .buffer would copy adjacent bytes into the blob.
        : body instanceof Uint8Array ? Buffer.from(body.buffer, body.byteOffset, body.byteLength)
        : body instanceof ArrayBuffer ? Buffer.from(body)
        : Buffer.from(await (body as Blob).arrayBuffer());
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
    // Only meaningful for containers with public read access. On a
    // private container this URL will 404 for anon requests — use
    // createSignedUrl() instead.
    return { data: { publicUrl: this.blob(path).url } };
  }

  /**
   * Supabase-shaped signed URL. On Azure this issues a Blob SAS
   * with read-only permission for `expiresInSeconds` (default 1h).
   *
   * Requires shared-key access to the account: works when the
   * adapter was constructed from AZURE_STORAGE_CONNECTION_STRING
   * (contains AccountName + AccountKey). Under managed identity
   * (AZURE_STORAGE_ACCOUNT_NAME only, no key) shared-key SAS is
   * not available — the caller should use a User Delegation SAS
   * flow instead; this method returns a clear error in that case.
   */
  async createSignedUrl(path: string, expiresInSeconds = 3600): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> {
    try {
      const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!conn) {
        return { data: null, error: {
          message: 'createSignedUrl requires AZURE_STORAGE_CONNECTION_STRING (shared key). Under managed identity, add a User Delegation SAS flow.',
        } };
      }
      const { accountName, accountKey } = parseSharedKeyFromConn(conn);
      if (!accountName || !accountKey) {
        return { data: null, error: {
          message: 'AZURE_STORAGE_CONNECTION_STRING is missing AccountName or AccountKey — cannot mint SAS.',
        } };
      }
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      const sas = generateBlobSASQueryParameters({
        containerName: this.bucket,
        blobName: path,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 60_000),                        // small clock-skew allowance
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
        protocol: undefined,                                             // default: HTTPS only
      }, credential).toString();
      const url = `${this.blob(path).url}?${sas}`;
      return { data: { signedUrl: url }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }
}

function parseSharedKeyFromConn(conn: string): { accountName?: string; accountKey?: string } {
  const parts = Object.fromEntries(
    conn.split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

export const storage = {
  from(bucket: string) { return new BlobBucket(bucket); },
};
