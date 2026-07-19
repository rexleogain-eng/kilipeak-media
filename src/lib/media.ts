import "server-only";

import { MEDIA_SLOTS } from "@/lib/slots";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const MEDIA_BUCKET = "kilipeak-media";

export type SiteMediaRow = {
  key: string;
  media_url: string | null;
  storage_path: string | null;
  original_url: string | null;
  original_name: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

export async function listMedia() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_media")
    .select(
      "key,media_url,storage_path,original_url,original_name,is_enabled,updated_at",
    );

  if (error) {
    throw new Error(error.message);
  }

  const rows = new Map(
    ((data ?? []) as SiteMediaRow[]).map((row) => [row.key, row]),
  );

  return MEDIA_SLOTS.map((slot) => ({
    ...slot,
    record: rows.get(slot.key) ?? {
      key: slot.key,
      media_url: null,
      storage_path: null,
      original_url: slot.originalUrl,
      original_name: null,
      is_enabled: true,
      updated_at: null,
    },
  }));
}

export function extensionFromFilename(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "bin";
}

export function safeStorageKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
