"use client";

import { useEffect } from "react";
import { listenForegroundPush, registerServiceWorker } from "@/lib/push/client";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
    let stop: (() => void) | undefined;
    void listenForegroundPush().then((unsub) => {
      stop = unsub;
    });
    return () => stop?.();
  }, []);
  return null;
}
