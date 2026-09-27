"use client";

import { useEffect, useState } from "react";
import { event, zonesEnabled } from "@/config/event";
import { getDeviceId } from "@/lib/client/storage";

type Geo = { status: "pending" | "ok" | "unavailable"; lat?: number; lng?: number };

export function HazardForm({ phone }: { phone: string | null }) {
  const [note, setNote] = useState("");
  const [zone, setZone] = useState("");
  const [geo, setGeo] = useState<Geo>({ status: "pending" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const t = setTimeout(() => setGeo({ status: "unavailable" }), 0);
      return () => clearTimeout(t);
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ status: "ok", lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeo({ status: "unavailable" }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, []);

  const where =
    geo.status === "ok"
      ? `${geo.lat!.toFixed(5)},${geo.lng!.toFixed(5)}${zone ? ` (Zone ${zone})` : ""}`
      : zone
        ? `Zone ${zone}`
        : "unknown location";
  const map =
    geo.status === "ok" ? ` Map: https://maps.google.com/?q=${geo.lat!.toFixed(5)},${geo.lng!.toFixed(5)}` : "";
  const body = `HAZARD at ${where}: ${note.trim() || "(no details)"}${map}`;
  // "?&body=" works on both iOS and Android messaging apps.
  const smsHref = phone ? `sms:${phone}?&body=${encodeURIComponent(body)}` : null;

  function logHazard() {
    // Fire-and-forget; the text message is what matters and works without data.
    // keepalive lets the request finish as the page hands off to Messages.
    void fetch("/api/hazards", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: geo.lat ?? null,
        lng: geo.lng ?? null,
        zone: zone || null,
        note: note.trim() || null,
        deviceId: getDeviceId(),
      }),
    }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold">What is it? (optional)</span>
        <input
          type="text"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. needle under the bridge, near the big rock"
          className="tap w-full rounded-xl border-3 border-ink bg-white px-4 py-3 text-lg"
        />
      </label>

      {zonesEnabled && (
        <fieldset>
          <legend className="mb-2 text-lg font-semibold">Zone (if you know it)</legend>
          <div className="flex flex-wrap gap-2">
            {event.zones.map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zone === z}
                onClick={() => setZone(zone === z ? "" : z)}
                className={`outlined tap rounded-xl px-4 font-display text-2xl ${zone === z ? "bg-grabber-500 text-white" : "bg-white"}`}
              >
                {z}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-base text-river-900">
        {geo.status === "ok"
          ? "📍 Your location will be included."
          : geo.status === "pending"
            ? "📍 Finding your location…"
            : "📍 Location unavailable — describe where it is in the note."}
      </p>

      {smsHref ? (
        <a
          href={smsHref}
          onClick={logHazard}
          className="outlined tap flex items-center justify-center rounded-2xl bg-fish-500 px-6 py-4 text-center font-display text-4xl tracking-wide"
        >
          💬 Text the safety lead
        </a>
      ) : (
        <p className="outlined rounded-2xl bg-white p-4 text-lg font-semibold">
          Find the nearest volunteer lead or head to the HQ tent and tell them where it is.
        </p>
      )}
      <p className="text-center text-base text-river-900">Opens your messaging app with the details filled in.</p>
    </div>
  );
}
