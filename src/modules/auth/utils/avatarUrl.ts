export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    new URL(url); // valida se é uma URL válida
    return url;
  } catch {
    return null;
  }
}
