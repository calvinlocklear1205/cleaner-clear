"use client";

import { useEffect, useState } from "react";
import { getDeviceId, loadProfile } from "@/lib/client/storage";

type Album = { slug: string; title: string; shared: boolean };

async function albumApi(body: Record<string, unknown>): Promise<Album | null> {
  const res = await fetch("/api/album", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: getDeviceId(), ...body }),
  });
  const data = (await res.json().catch(() => null)) as (Album & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
  return data;
}

function defaultTitle(): string {
  const first = loadProfile()?.name.trim().split(/\s+/)[0];
  return first ? `${first}’s Trashy Day` : "My Trashy Day";
}

/** "Share your trash album": create/rename the public album link and share it. */
export function ShareAlbum() {
  const [album, setAlbum] = useState<Album | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    albumApi({ action: "get" })
      .then((a) => {
        setAlbum(a);
        setTitle(a?.title ?? defaultTitle());
      })
      .catch(() => {
        setAlbum(null);
        setTitle(defaultTitle());
      });
  }, []);

  if (album === undefined) return null;

  const url = album?.shared ? `${location.origin}/a/${album.slug}` : null;

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const a = await albumApi({ action: "save", title });
      setAlbum(a);
      setEditing(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!url || !album) return;
    const data = { title: album.title, text: `${album.title} at the Clear Creek Cleanup 🗑️💚`, url };
    if (navigator.share) {
      await navigator.share(data).catch(() => {}); // cancelled is fine
    } else {
      await copy();
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied!");
    } catch {
      setMessage(url);
    }
  }

  async function saveStory() {
    if (!album) return;
    setBusy(true);
    setMessage("");
    const storyUrl = `/a/${album.slug}/story`;
    try {
      const blob = await (await fetch(storyUrl)).blob();
      const file = new File([blob], `${album.title.replace(/[^\w]+/g, "-")}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        // iOS/Android share sheet: "Save Image", Instagram Stories, etc.
        await navigator.share({ files: [file] }).catch(() => {});
      } else {
        window.open(storyUrl, "_blank");
      }
    } catch {
      window.open(storyUrl, "_blank");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!confirm("Turn off your album link? Anyone with it will see “not found”. You can share again later.")) return;
    setBusy(true);
    try {
      setAlbum(await albumApi({ action: "stop" }));
    } finally {
      setBusy(false);
    }
  }

  const titleInput = (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-semibold">Album name</span>
      <input
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
        className="tap w-full rounded-xl border-3 border-ink bg-white px-4 py-3 text-lg"
        enterKeyHint="done"
      />
    </label>
  );

  return (
    <section id="share" className="outlined flex flex-col gap-3 rounded-2xl bg-white p-4">
      <h2 className="font-display text-3xl leading-none tracking-wide text-grape-700">Share your trash album</h2>

      {!url ? (
        <>
          <p className="text-base text-river-900">
            A page with your photos, stats and any wins. It shows your album name only, never your phone number.
          </p>
          {titleInput}
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="outlined tap rounded-2xl bg-fish-500 px-4 py-3 font-display text-3xl tracking-wide disabled:opacity-70"
          >
            {busy ? "Making it…" : "Make my album link"}
          </button>
        </>
      ) : (
        <>
          {editing ? (
            <div className="flex flex-col gap-2">
              {titleInput}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTitle(album!.title);
                    setEditing(false);
                  }}
                  className="tap rounded-xl border-2 border-ink bg-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="tap rounded-xl border-2 border-ink bg-river-700 font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate text-xl font-bold">{album!.title}</p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="tap shrink-0 rounded-xl border-2 border-ink bg-white px-4 font-semibold text-grape-700"
              >
                Rename
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void share()}
            className="outlined tap rounded-2xl bg-fish-500 px-4 py-3 font-display text-3xl tracking-wide"
          >
            📤 Share my album
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="tap rounded-xl border-2 border-ink bg-white font-semibold"
            >
              🔗 Copy link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveStory()}
              className="tap rounded-xl border-2 border-ink bg-white font-semibold"
            >
              📱 Story image
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="tap flex items-center font-semibold text-grape-700 underline"
            >
              Preview album
            </a>
            <button type="button" onClick={() => void stop()} className="tap px-1 text-sm text-river-900 underline">
              Stop sharing
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="text-base font-semibold break-all text-river-900">
          {message}
        </p>
      )}
    </section>
  );
}
