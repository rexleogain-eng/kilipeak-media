# Connect the public KiliPeak website

KiliPeak Media is intentionally a separate application. The public website should only read
`public.site_media`; it should never receive the service-role key or the manager password.

## Public helper

Add this file to the main KiliPeak project as `src/lib/kilipeakMedia.ts`:

```ts
type PublicMediaRow = {
  key: string;
  media_url: string | null;
  original_url: string | null;
  is_enabled: boolean;
};

export async function getKiliPeakMedia(keys: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || keys.length === 0) {
    return new Map<string, string | null>();
  }

  const inFilter = keys
    .map((item) => `"${item.replaceAll('"', '')}"`)
    .join(",");

  const response = await fetch(
    `${url}/rest/v1/site_media?select=key,media_url,original_url,is_enabled&key=in.(${encodeURIComponent(inFilter)})`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return new Map<string, string | null>();
  }

  const rows = (await response.json()) as PublicMediaRow[];

  return new Map(
    rows.map((row) => [
      row.key,
      row.is_enabled
        ? row.media_url || row.original_url
        : null,
    ]),
  );
}
```

## Use a managed image with a hardcoded fallback

```tsx
const media = await getKiliPeakMedia([
  "homepage.experience.1",
]);

const experienceOne =
  media.get("homepage.experience.1") ??
  "/images/original-experience-1.jpg";
```

When the manager marks a slot as removed, `media.get(key)` returns `null`. In that case,
do not render that image/video.

## Deployment model

- Public website: `kilipeak-com.vercel.app` or the main KiliPeak domain.
- Manager: a separate Vercel project called `kilipeak-media`.
- Recommended final subdomain: `media.kilipeak.com`.
- Both projects use the same Supabase URL and public key.
- Only KiliPeak Media receives `SUPABASE_SERVICE_ROLE_KEY`,
  `KILIPEAK_MEDIA_PASSWORD`, and `KILIPEAK_MEDIA_AUTH_SECRET`.
