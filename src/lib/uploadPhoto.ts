export async function uploadPhoto(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url as string;
}
