import { requireApiSession } from "@/lib/auth";
import { MEDIA_BUCKET } from "@/lib/media";
import { MEDIA_SLOT_MAP } from "@/lib/slots";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Body = {
  key?: string;
  path?: string;
  publicUrl?: string;
  originalName?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as Body | null;
  const slot = body?.key ? MEDIA_SLOT_MAP.get(body.key) : undefined;

  if (!slot || !body?.path || !body.publicUrl) {
    return Response.json(
      { error: "Upload metadata is incomplete." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();

  const { data: current } = await supabase
    .from("site_media")
    .select("storage_path")
    .eq("key", slot.key)
    .maybeSingle();

  const { error } = await supabase.from("site_media").upsert(
    {
      key: slot.key,
      area: slot.area,
      label: slot.label,
      media_type: slot.mediaType,
      media_url: body.publicUrl,
      storage_path: body.path,
      original_url: slot.originalUrl,
      original_name: body.originalName || null,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([body.path]);

    return Response.json(
      { error: error.message },
      { status: 500 },
    );
  }

  if (
    current?.storage_path &&
    current.storage_path !== body.path
  ) {
    await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([current.storage_path]);
  }

  return Response.json({ ok: true });
}
