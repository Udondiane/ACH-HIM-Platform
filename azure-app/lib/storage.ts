/**
 * Azure Blob Storage adapter — one container per logical bucket.
 *
 * Uses AZURE_STORAGE_CONNECTION_STRING in dev; in production, use a
 * managed identity (DefaultAzureCredential) so no secrets are held.
 * The env-var path is the fast route for the first deploy; switch to
 * managed identity once the Azure landing zone is set up.
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
      'Set AZURE_STORAGE_CONNECTION_STRING (dev) or AZURE_STORAGE_ACCOUNT_NAME + managed identity (prod)',
    );
  }
  return svc;
}

function blob(bucket: string, path: string): BlockBlobClient {
  return client().getContainerClient(bucket).getBlockBlobClient(path);
}

export const storage = {
  async upload(
    bucket: string,
    path: string,
    body: Buffer | Uint8Array,
    opts?: { contentType?: string; overwrite?: boolean },
  ) {
    const b = blob(bucket, path);
    if (!opts?.overwrite && (await b.exists())) {
      throw new Error(`Blob ${bucket}/${path} already exists (pass overwrite: true to replace)`);
    }
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    await b.uploadData(buf, {
      blobHTTPHeaders: opts?.contentType ? { blobContentType: opts.contentType } : undefined,
    });
    return { path, url: b.url };
  },

  async download(bucket: string, path: string): Promise<Buffer> {
    const resp = await blob(bucket, path).download();
    return streamToBuffer(resp.readableStreamBody!);
  },

  async remove(bucket: string, path: string) {
    await blob(bucket, path).deleteIfExists();
  },

  async list(bucket: string, prefix = '') {
    const c = client().getContainerClient(bucket);
    const items: { name: string; size?: number; updatedAt?: string }[] = [];
    for await (const b of c.listBlobsFlat({ prefix })) {
      items.push({
        name: b.name,
        size: b.properties.contentLength,
        updatedAt: b.properties.lastModified?.toISOString(),
      });
    }
    return items;
  },

  publicUrl(bucket: string, path: string) {
    return blob(bucket, path).url;
  },
};

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', d => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
