import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export function AIOrb({ state, size = 220 }: { state: OrbState; size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className={cn(
          'absolute inset-0 rounded-full blur-3xl opacity-60 transition-all duration-700',
          state === 'speaking' && 'bg-violet-500/70 animate-pulse',
          state === 'listening' && 'bg-emerald-400/60 animate-pulse',
          state === 'thinking' && 'bg-amber-400/50 animate-pulse',
          state === 'idle' && 'bg-fuchsia-500/40',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full border border-white/20 transition-all duration-500',
          state === 'listening' ? 'animate-ping' : '',
        )}
        style={{ width: size * 0.9, height: size * 0.9 }}
      />
      <div
        className={cn('absolute rounded-full border border-white/10')}
        style={{ width: size * 1.05, height: size * 1.05 }}
      />

      <div
        className={cn(
          'relative rounded-full shadow-2xl transition-all duration-500',
          'bg-gradient-to-br from-violet-400 via-fuchsia-500 to-indigo-600',
          state === 'speaking' && 'scale-105',
          state === 'thinking' && 'scale-95',
        )}
        style={{ width: size * 0.6, height: size * 0.6 }}
      >
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/40 via-transparent to-transparent" />
        <div
          className={cn(
            'absolute inset-6 rounded-full bg-white/20 backdrop-blur-md',
            state === 'speaking' && 'animate-pulse',
          )}
        />
      </div>
    </div>
  );
}
