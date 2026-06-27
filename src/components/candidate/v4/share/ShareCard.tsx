import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export type ShareCardKind = 'quiz_result' | 'streak' | 'xp_milestone' | 'profile_summary';

export interface ShareCardData {
  kind: ShareCardKind;
  candidate_name: string;
  photo_url?: string | null;
  institution?: string | null;
  headline: string;
  big_stat: string;
  big_stat_label: string;
  sub_stats?: { label: string; value: string }[];
  date_label?: string;
  share_url: string;
}

const KIND_HEADER: Record<ShareCardKind, { title: string; gradient: string }> = {
  quiz_result:     { title: 'Practice Quiz Cleared',  gradient: 'from-violet-600 via-fuchsia-600 to-pink-500' },
  streak:          { title: 'Learning Streak',         gradient: 'from-orange-500 via-rose-500 to-fuchsia-600' },
  xp_milestone:    { title: 'XP Milestone Unlocked',   gradient: 'from-emerald-500 via-teal-500 to-sky-600' },
  profile_summary: { title: 'My alphaRecrewt Journey', gradient: 'from-violet-600 via-indigo-600 to-sky-500' },
};

export const ShareCard = forwardRef<HTMLDivElement, { data: ShareCardData }>(({ data }, ref) => {
  const head = KIND_HEADER[data.kind];
  const initials = (data.candidate_name || '?')
    .split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';

  return (
    <div
      ref={ref}
      style={{ width: 1080, height: 1080, fontFamily: 'Inter, system-ui, sans-serif' }}
      className="relative overflow-hidden bg-white"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${head.gradient}`} />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4), transparent 35%)',
      }} />

      <div className="absolute top-0 left-0 right-0 px-16 pt-14 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white text-violet-700 font-black text-3xl flex items-center justify-center shadow-xl">α</div>
          <div>
            <div className="text-xl font-bold tracking-tight">alphaRecrewt</div>
            <div className="text-xs uppercase tracking-[0.3em] opacity-80">Career Launchpad</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.3em] opacity-80">Achievement</div>
          <div className="text-base font-semibold">{head.title}</div>
        </div>
      </div>

      <div className="absolute left-16 right-16 top-44 bottom-44 rounded-[40px] bg-white shadow-2xl p-14 flex flex-col">
        <div className="flex items-center gap-5">
          {data.photo_url ? (
            <img src={data.photo_url} crossOrigin="anonymous"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-violet-100" alt="" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold text-2xl flex items-center justify-center">{initials}</div>
          )}
          <div>
            <div className="text-3xl font-extrabold text-slate-900">{data.candidate_name}</div>
            {data.institution && <div className="text-base text-slate-500 mt-1">{data.institution}</div>}
          </div>
        </div>

        <div className="mt-12">
          <div className="text-base uppercase tracking-[0.3em] text-violet-600 font-bold">{data.headline}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-[180px] leading-none font-black text-slate-900" style={{ letterSpacing: '-0.04em' }}>
            {data.big_stat}
          </div>
          <div className="text-2xl text-slate-500 font-semibold mt-2">{data.big_stat_label}</div>
        </div>

        {data.sub_stats && data.sub_stats.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-8">
            {data.sub_stats.slice(0, 3).map((s, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 px-6 py-5 text-center">
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-16 pb-14 flex items-end justify-between text-white">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] opacity-80">Verify at</div>
          <div className="text-lg font-semibold">alpharecrewt.ai</div>
          {data.date_label && <div className="text-xs opacity-70 mt-1">{data.date_label}</div>}
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-xl">
          <QRCodeSVG value={data.share_url} size={120} />
        </div>
      </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';
