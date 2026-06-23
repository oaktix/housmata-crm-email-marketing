import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

const BUCKET_NAME = 'email-assets';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// MIME allowlist for both inline images and common attachment docs.
// SVG is intentionally excluded: it can carry script and the bucket is public.
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Enforce a max file size.
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
    }

    // Best-effort MIME gate. file.type is client-controlled, but this still
    // blocks the obvious cases (e.g. SVG and other unsupported types).
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Ensure the storage bucket exists (create as public on first use)
    const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
    if (listErr) {
      throw new Error(listErr.message);
    }

    const bucketExists = (buckets || []).some(b => b.name === BUCKET_NAME);
    if (!bucketExists) {
      const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: true });
      if (createErr) {
        throw new Error(createErr.message);
      }
    }

    // Read the file into a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build a unique, filesystem-safe object path while preserving the extension
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(uploadErr.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(path);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
  } catch (err: any) {
    console.error('Upload route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
