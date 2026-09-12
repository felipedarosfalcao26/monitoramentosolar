"use client";

import { useEffect, useRef } from "react";

type QrScannerProps = {
  onDecode: (text: string) => void;
  onError?: (message: string) => void;
};

const ELEMENT_ID = "qr-scanner-viewport";

export default function QrScanner({ onDecode, onError }: QrScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    async function stopAndRelease() {
      const scanner = scannerRef.current;
      if (!scanner || !scanningRef.current) return;
      scanningRef.current = false;
      try {
        await scanner.stop();
      } catch {
        // already stopped — ignore
      }
      try {
        scanner.clear();
      } catch {
        // no-op if nothing to clear
      }
    }

    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(ELEMENT_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            stopAndRelease().finally(() => onDecode(decodedText));
          },
          () => {
            // ignore per-frame decode failures — expected while framing the code
          }
        );
        if (cancelled) {
          stopAndRelease();
          return;
        }
        scanningRef.current = true;
      } catch {
        onError?.("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      }
    });

    return () => {
      cancelled = true;
      stopAndRelease();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={ELEMENT_ID} className="w-full overflow-hidden rounded-xl bg-black" />;
}
