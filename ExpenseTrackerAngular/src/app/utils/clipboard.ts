/**
 * Copies text, falling back to the legacy path when the async Clipboard API
 * is unavailable -- it only exists in a secure context, and the dev server is
 * commonly reached over a plain-http LAN address.
 *
 * Throws if the copy did not happen, so callers can surface a message rather
 * than silently claiming success.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.setAttribute('readonly', '');
  scratch.style.position = 'fixed';
  scratch.style.opacity = '0';
  document.body.appendChild(scratch);
  scratch.select();

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Clipboard write was rejected.');
    }
  } finally {
    document.body.removeChild(scratch);
  }
}
