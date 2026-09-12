export type UploadResult = { url: string | null; error: string | null };

export async function uploadPhoto(file: File): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { url: null, error: data?.error ?? "Falha ao enviar a foto." };
    }
    return { url: data.url as string, error: null };
  } catch {
    return { url: null, error: "Falha de conexão ao enviar a foto." };
  }
}

/** Uploads every file in order; stops and reports on the first failure. */
export async function uploadPhotos(files: File[]): Promise<{ urls: string[]; error: string | null }> {
  const urls: string[] = [];
  for (const file of files) {
    const result = await uploadPhoto(file);
    if (!result.url) {
      return { urls, error: result.error };
    }
    urls.push(result.url);
  }
  return { urls, error: null };
}
