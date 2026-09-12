"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Upload } from "lucide-react";

interface Props {
  onCapture: (dataUrl: string) => void;
}

/** Turns a getUserMedia failure into a specific, actionable message instead of one generic fallback. */
function describeCameraError(err: unknown): string {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "Camera access requires a secure connection (HTTPS) or localhost. Try loading this page via https://, or upload a photo instead.";
  }
  const name = err instanceof DOMException ? err.name : undefined;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission was denied. Allow camera access for this site in your browser settings, then reload — or upload a photo instead.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device. You can upload a photo instead.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your camera seems to be in use by another app. Close it and try again, or upload a photo instead.";
    case "OverconstrainedError":
      return "Your camera doesn't support the requested settings. You can upload a photo instead.";
    case "SecurityError":
      return "Camera access is blocked on this connection. Try loading this page via https://, or upload a photo instead.";
    default:
      return "Camera access isn't available right now. You can upload a photo instead.";
  }
}

/**
 * Live camera preview with a capture-to-still button, plus a file-upload
 * fallback for browsers/devices without camera access (or when permission
 * is denied). Nothing is ever sent anywhere until the caller acts on the
 * captured data URL — the stream itself never leaves the browser.
 */
export function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setError(describeCameraError(undefined));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(describeCameraError(err));
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    stopCamera();
  }

  function retake() {
    setPreview(null);
    setError(null);
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(describeCameraError(undefined));
      return;
    }
    // Re-trigger the effect's camera start by remounting via key on parent,
    // simplest here: request the stream again directly.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((err) => setError(describeCameraError(err)));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      stopCamera();
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-blush">
          <img src={preview} alt="Captured selfie" className="h-full w-full object-cover" />
        </div>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={retake} className="btn-outline">
            <RotateCcw size={15} /> Retake
          </button>
          <button type="button" onClick={() => onCapture(preview)} className="btn-primary">
            Use This Photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-ink/90">
        {!error ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">{error}</div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        {!error ? (
          <button type="button" onClick={capture} disabled={!ready} className="btn-primary disabled:opacity-50">
            <Camera size={16} /> Capture Photo
          </button>
        ) : (
          <button type="button" onClick={retake} className="btn-outline">
            <RotateCcw size={15} /> Try Camera Again
          </button>
        )}
        <label className="btn-outline w-fit cursor-pointer">
          <Upload size={15} /> {error ? "Upload a Photo" : "Or upload a photo instead"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    </div>
  );
}
