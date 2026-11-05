export function isSecureAiKeyServerUrl(serverUrl: string): boolean {
  try {
    const url = new URL(serverUrl);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
