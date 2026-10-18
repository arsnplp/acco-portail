"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "unsupported" | "denied" | "off" | "on" | "loading";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function EnablePush({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State = "unsupported";
      if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
        if (Notification.permission === "denied") next = "denied";
        else {
          try {
            const reg = await navigator.serviceWorker.register("/sw.js");
            const sub = await reg.pushManager.getSubscription();
            next = sub ? "on" : "off";
          } catch { next = "unsupported"; }
        }
      }
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "unsupported") {
    return compact ? null : (
      <p className="text-xs text-muted">
        Pour recevoir les notifications sur iPhone, ajoutez d’abord l’app à votre écran d’accueil (Partager → « Sur l’écran d’accueil »), puis revenez ici.
      </p>
    );
  }
  if (state === "denied") return compact ? null : <p className="text-xs text-pink">Les notifications sont bloquées dans les réglages de votre navigateur.</p>;
  if (state === "on") {
    if (compact) return null;
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-green"><Check size={16} /> Notifications activées sur cet appareil</p>
        {!compact && <Button variant="ghost" size="sm" onClick={disable}><BellOff size={14} /> Désactiver</Button>}
      </div>
    );
  }
  if (state === "loading" && compact) return null;
  if (compact) {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
        <p className="text-sm text-text-strong">Soyez prévenu dès qu’un client vous écrit.</p>
        <Button variant="secondary" size="sm" onClick={enable}><Bell size={14} /> Activer</Button>
      </div>
    );
  }
  return (
    <Button onClick={enable} disabled={state === "loading"} className="w-full">
      <Bell size={16} /> {state === "loading" ? "…" : "Activer les notifications sur cet appareil"}
    </Button>
  );
}
