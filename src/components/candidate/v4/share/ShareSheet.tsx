import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Download, Copy, Share2, MessageCircle, Linkedin, Facebook, Instagram } from 'lucide-react';
import { toPng } from 'html-to-image';
import { supabase } from '@/integrations/supabase/client';
import { ShareCard, ShareCardData } from './ShareCard';
import {
  whatsappUrl, linkedinUrl, facebookUrl, nativeShare, downloadBlob, dataUrlToBlob,
} from './shareIntents';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Omit<ShareCardData, 'share_url'>;
}

export function ShareSheet({ open, onOpenChange, data }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [safePhoto, setSafePhoto] = useState<string | null>(null);
  const placeholderShareUrl = `${window.location.origin}/s/_`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSafePhoto(null);
    const url = data.photo_url;
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) setSafePhoto(url); };
    img.onerror = () => { if (!cancelled) setSafePhoto(null); };
    img.src = url;
    return () => { cancelled = true; };
  }, [open, data.photo_url]);

  const text = (() => {
    switch (data.kind) {
      case 'quiz_result':
        return `I just scored ${data.big_stat} in ${data.headline} on alphaRecrewt 🚀`;
      case 'streak':
        return `${data.big_stat}-day learning streak on alphaRecrewt 🔥 Building skills daily.`;
      case 'xp_milestone':
        return `Unlocked ${data.big_stat} XP on alphaRecrewt — career launchpad for freshers ✨`;
      default:
        return `My alphaRecrewt journey so far — ${data.big_stat} ${data.big_stat_label}.`;
    }
  })();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setPreviewUrl(null);
    setShareLink('');
    setImageBlob(null);
    (async () => {
      try {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 60));
        if (!cardRef.current) throw new Error('card not ready');
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 1,
          width: 1080,
          height: 1080,
          cacheBust: true,
          skipFonts: true,
          filter: (node: any) => {
            if (node?.tagName === 'IMG' && node.dataset?.shareSkip === '1') return false;
            return true;
          },
        });
        if (cancelled) return;
        const blob = dataUrlToBlob(dataUrl);
        setImageBlob(blob);
        setPreviewUrl(dataUrl);

        const { data: res, error } = await supabase.functions.invoke('candidate-share-card', {
          body: {
            action: 'create',
            kind: data.kind,
            payload: data,
            image_data_url: dataUrl,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        const token = res?.token as string;
        setShareLink(`${window.location.origin}/s/${token}`);
      } catch (e: any) {
        console.error('share build err', e);
        toast.error(e?.message || 'Could not create share');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, data]);

  const sharePayload = { url: shareLink || window.location.origin, text, imageBlob };

  const onCopy = () => {
    navigator.clipboard.writeText(shareLink || '');
    toast.success('Link copied');
  };
  const onDownload = () => {
    if (imageBlob) downloadBlob(imageBlob, 'alpharecrewt-achievement.png');
  };
  const openIntent = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600');
  const onNative = async () => {
    const ok = await nativeShare(sharePayload);
    if (!ok) toast.info('Native share unavailable on this device');
  };
  const onInstagram = () => {
    onDownload();
    toast.success('Image downloaded — open Instagram and post it as a story or feed.');
  };

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden>
          <ShareCard ref={cardRef} data={{ ...data, photo_url: safePhoto, share_url: shareLink || placeholderShareUrl }} />
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-2">
            <DialogTitle className="text-base">Share your win</DialogTitle>
          </DialogHeader>

          <div className="px-5">
            <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center ring-1 ring-slate-200">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              <SocialBtn label="WhatsApp" color="bg-emerald-500" icon={<MessageCircle className="h-5 w-5" />}
                onClick={() => openIntent(whatsappUrl(sharePayload))} disabled={busy} />
              <SocialBtn label="LinkedIn" color="bg-sky-700" icon={<Linkedin className="h-5 w-5" />}
                onClick={() => openIntent(linkedinUrl(sharePayload))} disabled={busy} />
              <SocialBtn label="Facebook" color="bg-blue-600" icon={<Facebook className="h-5 w-5" />}
                onClick={() => openIntent(facebookUrl(sharePayload))} disabled={busy} />
              <SocialBtn label="Instagram" color="bg-gradient-to-br from-fuchsia-500 to-orange-500" icon={<Instagram className="h-5 w-5" />}
                onClick={onInstagram} disabled={busy} />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={onCopy} disabled={busy || !shareLink}>
                <Copy className="h-4 w-4 mr-1" /> Copy link
              </Button>
              <Button variant="outline" size="sm" onClick={onDownload} disabled={busy || !imageBlob}>
                <Download className="h-4 w-4 mr-1" /> Image
              </Button>
              <Button variant="outline" size="sm" onClick={onNative} disabled={busy}>
                <Share2 className="h-4 w-4 mr-1" /> More
              </Button>
            </div>

            <p className="text-[11px] text-slate-500 text-center mt-3 mb-5">
              Sharing builds your personal brand on alpharecrewt.ai
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SocialBtn({ label, color, icon, onClick, disabled }: { label: string; color: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl p-3 text-white ${color} disabled:opacity-50 hover:brightness-110 transition`}>
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
