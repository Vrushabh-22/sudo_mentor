import { useEffect, useState } from 'react';
import { V4Profile } from '@/pages/CandidatePortalV4';
import { Card } from '@/components/ui/card';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStorageUrl } from '@/utils/storageUrl';
import { Loader2, Trophy, Flame } from 'lucide-react';

interface Props { candidate: V4Profile }

export function LeaderboardView({ candidate }: Props) {
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await invokeV4<{ leaderboard: any[] }>({ action: 'leaderboard' });
      setRows(data?.leaderboard || []);
    })();
  }, []);

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>;

  const myRank = rows.findIndex((r) => r.id === candidate.id) + 1;

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white border-0 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <Trophy className="h-8 w-8 mb-1" />
            <h2 className="text-xl font-bold">Campus Leaderboard</h2>
            <p className="text-xs opacity-90">{candidate.institution || 'Your tenant'} · last 7 days</p>
          </div>
          {myRank > 0 && (
            <div className="text-right">
              <div className="text-3xl font-extrabold">#{myRank}</div>
              <div className="text-[10px] uppercase opacity-80">your rank</div>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Be the first to earn XP and top the leaderboard! 🎯
          </Card>
        )}
        {rows.map((r, i) => {
          const isMe = r.id === candidate.id;
          const initials = `${(r.first_name?.[0] || '').toUpperCase()}${(r.last_name?.[0] || '').toUpperCase()}` || '?';
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <Card key={r.id} className={`p-3 flex items-center gap-3 ${isMe ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200' : ''}`}>
              <div className="w-8 text-center font-bold text-slate-500">{medal || `#${i + 1}`}</div>
              <Avatar className="h-10 w-10">
                <AvatarImage src={getStorageUrl(r.photo_url)} className="object-cover" />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{[r.first_name, r.last_name].filter(Boolean).join(' ') || 'Student'} {isMe && <span className="text-[10px] text-violet-600">(you)</span>}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="flex items-center gap-0.5"><Flame className="h-3 w-3 text-amber-500" />{r.streak_days || 0}d</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-violet-700">{r.xp_total || 0}</div>
                <div className="text-[10px] text-muted-foreground">XP</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
