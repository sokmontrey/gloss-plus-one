const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";

export function getBackendBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL?.trim();

  return value && value.length > 0 ? value : DEFAULT_API_BASE_URL;
}

export function getAuthRouteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendBaseUrl()}${normalizedPath}`;
}
