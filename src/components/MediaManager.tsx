"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type SlotRecord = {
  key: string;
  media_url: string | null;
  storage_path: string | null;
  original_url: string | null;
  original_name: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

type Slot = {
  key: string;
  area: string;
  label: string;
  mediaType: "image" | "video";
  recommended: string;
  maxBytes: number;
  priority: string;
  source: string;
  originalUrl: string | null;
  record: SlotRecord;
};

type Props = {
  mainSiteUrl: string;
};

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function displayUrl(slot: Slot): string | null {
  if (!slot.record.is_enabled) return null;

  return (
    slot.record.media_url ||
    slot.record.original_url ||
    slot.originalUrl
  );
}

export default function MediaManager({
  mainSiteUrl,
}: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [area, setArea] = useState("All");
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] =
    useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/media", {
      cache: "no-store",
    });

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    const result = (await response.json()) as {
      slots?: Slot[];
      error?: string;
    };

    if (!response.ok || !result.slots) {
      throw new Error(
        result.error || "Could not load media slots.",
      );
    }

    setSlots(result.slots);
    setSelectedKey((current) =>
      current && result.slots?.some((item) => item.key === current)
        ? current
        : result.slots?.[0]?.key || "",
    );
  }

  useEffect(() => {
    void load().catch((error) =>
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not load media.",
      ),
    );
  }, []);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const areas = useMemo(
    () => [
      "All",
      ...Array.from(new Set(slots.map((slot) => slot.area))),
    ],
    [slots],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return slots.filter((slot) => {
      const matchesArea =
        area === "All" || slot.area === area;

      const matchesSearch =
        !normalized ||
        `${slot.label} ${slot.key} ${slot.area}`
          .toLowerCase()
          .includes(normalized);

      return matchesArea && matchesSearch;
    });
  }, [slots, area, query]);

  const selected =
    slots.find((slot) => slot.key === selectedKey) ||
    filtered[0] ||
    null;

  const currentUrl = selected ? displayUrl(selected) : null;
  const previewUrl = localPreview || currentUrl;
  const uploadedCount = slots.filter(
    (slot) => Boolean(slot.record.storage_path),
  ).length;
  const removedCount = slots.filter(
    (slot) => !slot.record.is_enabled,
  ).length;

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;

    if (localPreview) {
      URL.revokeObjectURL(localPreview);
    }

    setFile(next);
    setLocalPreview(next ? URL.createObjectURL(next) : null);
    setStatus("");
  }

  async function upload() {
    if (!selected || !file) return;

    if (file.size > selected.maxBytes) {
      setStatus(
        `This file is too large. Maximum: ${megabytes(
          selected.maxBytes,
        )}.`,
      );
      return;
    }

    setBusy(true);
    setStatus("Preparing secure upload…");

    try {
      const signResponse = await fetch(
        "/api/media/sign-upload",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: selected.key,
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        },
      );

      const signResult = (await signResponse.json()) as {
        bucket?: string;
        path?: string;
        token?: string;
        publicUrl?: string;
        error?: string;
      };

      if (
        !signResponse.ok ||
        !signResult.bucket ||
        !signResult.path ||
        !signResult.token ||
        !signResult.publicUrl
      ) {
        throw new Error(
          signResult.error || "Could not prepare upload.",
        );
      }

      setStatus("Uploading directly to media storage…");

      const supabase = getSupabaseBrowser();
      const { error: uploadError } = await supabase.storage
        .from(signResult.bucket)
        .uploadToSignedUrl(
          signResult.path,
          signResult.token,
          file,
          {
            contentType: file.type,
            cacheControl: "3600",
          },
        );

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setStatus("Saving website media record…");

      const finalResponse = await fetch(
        "/api/media/finalize",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: selected.key,
            path: signResult.path,
            publicUrl: signResult.publicUrl,
            originalName: file.name,
          }),
        },
      );

      const finalResult = (await finalResponse.json()) as {
        error?: string;
      };

      if (!finalResponse.ok) {
        throw new Error(
          finalResult.error || "Could not save media.",
        );
      }

      setStatus(`${selected.label} updated successfully.`);
      setFile(null);

      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }

      setLocalPreview(null);
      await load();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function mutate(
    endpoint: "remove" | "restore",
  ) {
    if (!selected) return;

    if (
      endpoint === "remove" &&
      !window.confirm(
        `Remove "${selected.label}" completely?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setStatus(
      endpoint === "remove"
        ? "Removing media…"
        : "Restoring original media…",
    );

    try {
      const response = await fetch(
        `/api/media/${endpoint}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: selected.key }),
        },
      );

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error || "Operation failed.",
        );
      }

      setStatus(
        endpoint === "remove"
          ? "Media removed completely."
          : "Original website media restored.",
      );

      await load();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="manager-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">KILIPEAK PRIVATE SYSTEM</p>
          <h1>KiliPeak Media</h1>
          <p>
            One control centre for every approved website
            photo and video.
          </p>
        </div>

        <div className="topbar-actions">
          <a
            className="secondary-button"
            href={mainSiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open main website
          </a>
          <button
            className="ghost-button"
            type="button"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <article>
          <span>Total controlled slots</span>
          <strong>{slots.length}</strong>
        </article>
        <article>
          <span>Custom uploads</span>
          <strong>{uploadedCount}</strong>
        </article>
        <article>
          <span>Removed slots</span>
          <strong>{removedCount}</strong>
        </article>
      </section>

      <section className="manager-grid">
        <aside className="slot-panel">
          <div className="filters">
            <input
              type="search"
              placeholder="Search media slots…"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
            />

            <div className="area-pills">
              {areas.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={
                    item === area ? "active" : ""
                  }
                  onClick={() => setArea(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="slot-list">
            {filtered.map((slot) => {
              const isUploaded = Boolean(
                slot.record.storage_path,
              );
              const removed = !slot.record.is_enabled;

              return (
                <button
                  type="button"
                  key={slot.key}
                  className={
                    slot.key === selected?.key
                      ? "slot-card selected"
                      : "slot-card"
                  }
                  onClick={() => {
                    setSelectedKey(slot.key);
                    setFile(null);

                    if (localPreview) {
                      URL.revokeObjectURL(localPreview);
                    }

                    setLocalPreview(null);
                    setStatus("");
                  }}
                >
                  <div>
                    <span>{slot.area}</span>
                    <strong>{slot.label}</strong>
                    <small>{slot.key}</small>
                  </div>

                  <em
                    className={
                      removed
                        ? "removed"
                        : isUploaded
                          ? "uploaded"
                          : "original"
                    }
                  >
                    {removed
                      ? "Removed"
                      : isUploaded
                        ? "Uploaded"
                        : "Original"}
                  </em>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="editor-panel">
          {selected ? (
            <>
              <div className="editor-heading">
                <div>
                  <p className="eyebrow">{selected.area}</p>
                  <h2>{selected.label}</h2>
                  <p>{selected.recommended}</p>
                </div>
                <span className="priority">
                  {selected.priority}
                </span>
              </div>

              <div
                className={
                  selected.mediaType === "video"
                    ? "preview-frame video"
                    : "preview-frame image"
                }
              >
                {previewUrl ? (
                  selected.mediaType === "video" ? (
                    <video
                      key={previewUrl}
                      src={previewUrl}
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    // Deliberately use a normal img element because
                    // Supabase hostnames vary by project.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={previewUrl}
                      src={previewUrl}
                      alt={selected.label}
                    />
                  )
                ) : (
                  <div className="empty-preview">
                    <strong>No media active</strong>
                    <span>
                      Upload a replacement or restore the
                      original website fallback.
                    </span>
                  </div>
                )}
              </div>

              <div className="details-grid">
                <article>
                  <span>Accepted type</span>
                  <strong>{selected.mediaType}</strong>
                </article>
                <article>
                  <span>Maximum size</span>
                  <strong>
                    {megabytes(selected.maxBytes)}
                  </strong>
                </article>
                <article>
                  <span>Current file</span>
                  <strong>
                    {file?.name ||
                      selected.record.original_name ||
                      (selected.record.storage_path
                        ? "Custom upload"
                        : "Original website media")}
                  </strong>
                </article>
              </div>

              <label className="upload-box">
                <input
                  type="file"
                  accept={
                    selected.mediaType === "video"
                      ? "video/mp4,video/webm,video/quicktime"
                      : "image/png,image/jpeg,image/webp,image/avif"
                  }
                  onChange={chooseFile}
                  disabled={busy}
                />
                <span>Choose replacement file</span>
                <strong>
                  {file
                    ? `${file.name} • ${(
                        file.size /
                        1024 /
                        1024
                      ).toFixed(2)} MB`
                    : "No file selected"}
                </strong>
              </label>

              <div className="action-grid">
                <button
                  className="primary-button"
                  type="button"
                  onClick={upload}
                  disabled={!file || busy}
                >
                  {busy ? "Working…" : "Upload and publish"}
                </button>

                <button
                  className="danger-button"
                  type="button"
                  onClick={() => mutate("remove")}
                  disabled={busy || !selected.record.is_enabled}
                >
                  Remove completely
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => mutate("restore")}
                  disabled={busy}
                >
                  Restore original
                </button>
              </div>

              {status ? (
                <p className="status">{status}</p>
              ) : null}
            </>
          ) : (
            <div className="empty-preview">
              <strong>No media slot selected</strong>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
