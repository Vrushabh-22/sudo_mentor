import { useEffect, useState } from 'react';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { useCandidateAuth } from '@/hooks/useCandidateAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TenantEntry {
  candidateId: string;
  tenantId: string;
  tenantName: string;
  logoUrl: string | null;
  applicationCount: number;
}

export function V4TenantSwitcher({ onSwitched }: { onSwitched?: () => void }) {
  const { user, setActiveCandidate } = useCandidateAuth();
  const [tenants, setTenants] = useState<TenantEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await invokeV4<{ tenants: TenantEntry[] }>({ action: 'list_my_tenants' });
      if (cancelled) return;
      setTenants(data?.tenants || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.candidateId]);

  if (loading) return null;
  if (tenants.length < 2) return null;

  const active = tenants.find(t => t.candidateId === user?.candidateId && t.tenantId === user?.tenantId);
  const activeName = active?.tenantName || 'Choose org';

  const pick = async (t: TenantEntry) => {
    if (t.candidateId === user?.candidateId) return;
    setSwitchingId(t.candidateId);
    try {
      await setActiveCandidate(t.candidateId, t.tenantId);
      onSwitched?.();
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-violet-50 hover:bg-violet-100 border border-violet-200 text-xs font-semibold text-violet-700 transition max-w-[180px]"
          aria-label="Switch organization"
        >
          {active?.logoUrl ? (
            <img src={active.logoUrl} alt="" className="h-4 w-4 rounded object-cover" />
          ) : (
            <Building2 className="h-3.5 w-3.5" />
          )}
          <span className="truncate">{activeName}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          Your organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => {
          const isActive = t.candidateId === user?.candidateId && t.tenantId === user?.tenantId;
          const isSwitching = switchingId === t.candidateId;
          return (
            <DropdownMenuItem
              key={`${t.candidateId}-${t.tenantId}`}
              onClick={(e) => { e.preventDefault(); pick(t); }}
              disabled={!!switchingId}
              className="gap-2"
            >
              <div className="h-7 w-7 rounded-md bg-violet-100 flex items-center justify-center overflow-hidden shrink-0">
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-violet-700" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{t.tenantName}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.applicationCount === 0 ? 'No applications' : `${t.applicationCount} application${t.applicationCount === 1 ? '' : 's'}`}
                </div>
              </div>
              {isSwitching ? (
                <Loader2 className="h-4 w-4 animate-spin text-violet-600 shrink-0" />
              ) : isActive ? (
                <Check className="h-4 w-4 text-violet-600 shrink-0" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
