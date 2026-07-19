import { randomUUID } from "node:crypto";
import { requireApiSession } from "@/lib/auth";
import {
  extensionFromFilename,
  MEDIA_BUCKET,
  safeStorageKey,
} from "@/lib/media";
import { MEDIA_SLOT_MAP } from "@/lib/slots";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Body = {
  key?: string;
  filename?: string;
  contentType?: string;
  size?: number;
};

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as Body | null;
  const slot = body?.key ? MEDIA_SLOT_MAP.get(body.key) : undefined;

  if (!slot) {
    return Response.json(
      { error: "Unknown media slot." },
      { status: 400 },
    );
  }

  const filename = body?.filename?.trim() || "upload.bin";
  const contentType = body?.contentType?.trim() || "";
  const size = Number(body?.size || 0);

  if (!Number.isFinite(size) || size <= 0 || size > slot.maxBytes) {
    return Response.json(
      {
        error: `File must be smaller than ${Math.round(
          slot.maxBytes / 1024 / 1024,
        )} MB.`,
      },
      { status: 400 },
    );
  }

  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");

  if (
    (slot.mediaType === "image" && !isImage) ||
    (slot.mediaType === "video" && !isVideo)
  ) {
    return Response.json(
      { error: `This slot accepts ${slot.mediaType} files only.` },
      { status: 400 },
    );
  }

  const extension = extensionFromFilename(filename);
  const storagePath =
    `${safeStorageKey(slot.key)}/${Date.now()}-${randomUUID()}.${extension}`;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return Response.json(
      { error: error?.message || "Could not prepare upload." },
      { status: 500 },
    );
  }

  const publicUrl = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;

  return Response.json({
    bucket: MEDIA_BUCKET,
    path: storagePath,
    token: data.token,
    publicUrl,
  });
}
