export type SharePayload = {
  url: string;
  text: string;
  imageBlob?: Blob | null;
};

export function whatsappUrl(p: SharePayload) {
  return `https://wa.me/?text=${encodeURIComponent(`${p.text} ${p.url}`)}`;
}
export function linkedinUrl(p: SharePayload) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(p.url)}`;
}
export function facebookUrl(p: SharePayload) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(p.url)}`;
}
export function twitterUrl(p: SharePayload) {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(p.text)}`;
}

export async function nativeShare(p: SharePayload): Promise<boolean> {
  try {
    const nav: any = navigator;
    if (!nav?.share) return false;
    if (p.imageBlob && nav.canShare?.({ files: [new File([p.imageBlob], 'achievement.png', { type: 'image/png' })] })) {
      await nav.share({
        text: p.text,
        url: p.url,
        files: [new File([p.imageBlob], 'achievement.png', { type: 'image/png' })],
      });
    } else {
      await nav.share({ text: p.text, url: p.url });
    }
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
