"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Login failed.");
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Login failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">PRIVATE CONTROL CENTRE</p>
        <h1>KiliPeak Media</h1>
        <p className="login-copy">
          Manage every approved photo and video used across
          the KiliPeak website.
        </p>

        <form onSubmit={submit} className="login-form">
          <label htmlFor="password">Manager password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter password"
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Opening…" : "Open KiliPeak Media"}
          </button>
        </form>

        {status ? (
          <p className="status error">{status}</p>
        ) : null}
      </section>
    </main>
  );
}
