# KiliPeak Media

A standalone private sub-web for managing the approved photos and videos used by the
public KiliPeak website.

## What is included

- Separate password-protected manager
- 49 audited media slots
- Search and category filtering
- Image and video previews
- Direct signed uploads to Supabase Storage
- Replace, remove completely, and restore-original controls
- Server-only service-role key
- HttpOnly signed login cookie
- Responsive desktop/mobile interface
- SQL setup for the shared `site_media` table and `kilipeak-media` bucket
- Main-site integration guide

## 1. Create local environment

Copy `.env.example` to `.env.local` and fill all six values.

PowerShell:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Generate a strong authentication secret:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Paste the result into `KILIPEAK_MEDIA_AUTH_SECRET`.

## 2. Prepare Supabase

Open the same Supabase project used by KiliPeak, then run:

```text
supabase/setup.sql
```

Do not put the service-role key in any `NEXT_PUBLIC_` variable.

## 3. Install and test

```powershell
npm install
npm run build
npm run dev
```

Open `http://localhost:3000`.

## 4. Create its own GitHub repository

Suggested repository name:

```text
kilipeak-media
```

Then:

```powershell
git init
git add .
git commit -m "Create standalone KiliPeak Media manager"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/kilipeak-media.git
git push -u origin main
```

## 5. Deploy as its own Vercel project

Import the `kilipeak-media` repository into Vercel and add all environment variables.

Suggested deployment URL:

```text
kilipeak-media.vercel.app
```

Recommended final custom subdomain:

```text
media.kilipeak.com
```

## Important upload architecture

The browser uploads directly to a Supabase signed upload URL. The file does not pass
through a Vercel Function. This is necessary for media files larger than Vercel's
function request-body limit.

## Final integration

Follow `MAIN-SITE-INTEGRATION.md` to make the public KiliPeak site consume each
managed slot.
