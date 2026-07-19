import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "kilipeak_media_session";
const SESSION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  exp: number;
  scope: "kilipeak-media";
};

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", env.authSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length &&
    timingSafeEqual(left, right);
}

export function passwordMatches(candidate: string): boolean {
  return safeEqual(candidate, env.mediaPassword());
}

export function createSessionValue(): string {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    scope: "kilipeak-media",
  };

  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionValue(value?: string): boolean {
  if (!value) return false;

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return false;

  const expected = sign(encoded);
  if (!safeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;

    return (
      payload.scope === "kilipeak-media" &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
}

export async function requireApiSession(): Promise<Response | null> {
  if (await hasSession()) return null;

  return Response.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

export async function setSessionCookie(): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
