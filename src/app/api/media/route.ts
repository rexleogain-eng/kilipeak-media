import { requireApiSession } from "@/lib/auth";
import { listMedia } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    return Response.json({ slots: await listMedia() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load media.",
      },
      { status: 500 },
    );
  }
}
