"use client";

import { useEffect, useRef, useState } from "react";

export default function MultiPhotoInput({
  files,
  onChange,
  dark = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function addFile(file: File | null) {
    if (!file) return;
    onChange([...files, file]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  const tileClass = dark
    ? "border-slate-600 bg-slate-800 text-slate-300"
    : "border-slate-300 bg-slate-50 text-slate-500";

  return (
    <div className="flex flex-wrap gap-2">
      {previews.map((src, i) => (
        <div key={i} className="relative h-20 w-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow"
          >
            ✕
          </button>
        </div>
      ))}
      <label
        className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-2xl ${tileClass}`}
      >
        +
        <span className="text-[10px]">Foto</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => addFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
