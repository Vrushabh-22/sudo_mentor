import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Copy, Check, Share2, Linkedin, MessageCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  name: string;
}

export function ProfileShareDialog({ open, onOpenChange, url, name }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Link copied' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: `${name} · alphaRecrewt`, url }); } catch {}
    } else {
      copy();
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`Check out my profile on alphaRecrewt — ${url}`)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share your profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3">
            <code className="flex-1 truncate text-xs font-medium text-slate-700">{url}</code>
            <Button size="sm" onClick={copy} variant={copied ? 'default' : 'secondary'} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a href={wa} target="_blank" rel="noopener noreferrer"
               className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">WhatsApp</span>
            </a>
            <a href={li} target="_blank" rel="noopener noreferrer"
               className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
              <Linkedin className="h-5 w-5 text-[#0A66C2]" />
              <span className="text-xs font-semibold text-slate-700">LinkedIn</span>
            </a>
            <button onClick={nativeShare}
               className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
              <Share2 className="h-5 w-5 text-violet-600" />
              <span className="text-xs font-semibold text-slate-700">More</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Anyone with this link can see your public profile.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
