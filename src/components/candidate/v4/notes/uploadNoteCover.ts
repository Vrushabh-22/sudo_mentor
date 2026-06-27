import { supabase } from '@/integrations/supabase/client';

export async function uploadNoteCover(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Cover image must be under 5 MB');

  const { data, error } = await supabase.functions.invoke('generate-note-cover-sas', {
    body: { fileName: file.name, contentType: file.type || 'application/octet-stream' },
  });
  if (error) throw error;
  const sasUrl = (data as any)?.sasUrl;
  const publicUrl = (data as any)?.publicUrl;
  if (!sasUrl || !publicUrl) throw new Error('Failed to get upload URL');

  const res = await fetch(sasUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Azure upload failed: ${res.status} ${txt}`);
  }
  return publicUrl;
}
