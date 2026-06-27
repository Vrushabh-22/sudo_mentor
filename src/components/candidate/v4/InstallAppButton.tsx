import { useEffect, useState } from 'react';
import { Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'recrewt_install_dismissed_v1';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(
    isStandalone() || sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  useEffect(() => {
    if (hidden) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hidden]);

  if (hidden) return null;

  const ios = isIOS();
  if (!deferred && !ios) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'dismissed') {
        sessionStorage.setItem(DISMISS_KEY, '1');
        setHidden(true);
      } else {
        setHidden(true);
      }
      setDeferred(null);
      return;
    }
    setShowIosHelp(true);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        className="hidden sm:inline-flex h-8 gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
      >
        <Download className="h-3.5 w-3.5" />
        Install app
      </Button>
      <Button
        size="icon"
        variant="outline"
        onClick={handleClick}
        aria-label="Install app"
        className="sm:hidden h-8 w-8 border-violet-200 text-violet-700"
      >
        <Download className="h-4 w-4" />
      </Button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install Recrewt</DialogTitle>
            <DialogDescription>
              Add the candidate portal to your home screen for an app-like experience.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-violet-700">1.</span>
              <span className="flex items-center gap-1.5">
                Tap the <Share className="h-4 w-4 inline" /> Share button in Safari's toolbar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-violet-700">2.</span>
              <span className="flex items-center gap-1.5">
                Choose <Plus className="h-4 w-4 inline" /> "Add to Home Screen".
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-violet-700">3.</span>
              <span>Tap "Add" — Recrewt will launch like a native app.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
