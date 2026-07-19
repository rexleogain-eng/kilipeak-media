import {
  passwordMatches,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { password?: string }
    | null;

  const password = body?.password?.trim() || "";

  if (!passwordMatches(password)) {
    return Response.json(
      { error: "Incorrect password." },
      { status: 401 },
    );
  }

  await setSessionCookie();

  return Response.json({ ok: true });
}
