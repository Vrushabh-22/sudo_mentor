import { useState } from 'react';
import { ChevronDown, ChevronRight, Mic, MessageCircle, Clock, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageRenderer } from './chat/MessageRenderer';
import { V4Profile } from '@/pages/CandidatePortalV4';

export interface InterviewRecap {
  feedback: string;
  transcript: { role: 'user' | 'assistant'; content: string }[];
  durationMs: number;
  questionCount: number;
  answerCount: number;
  startedAt?: string;
  endedAt?: string;
  short: boolean;
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${String(rem).padStart(2, '0')}s`;
}

export function InterviewRecapCard({ recap, candidate }: { recap: InterviewRecap; candidate: V4Profile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full rounded-2xl p-[1.5px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 shadow-md">
      <div className="rounded-[14px] bg-white/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-100">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">Mock Interview Recap</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{recap.answerCount} answer{recap.answerCount === 1 ? '' : 's'}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(recap.durationMs)}</span>
              {recap.short && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 font-medium">Short session</span>
                </>
              )}
            </div>
          </div>
          <BarChart3 className="h-4 w-4 text-violet-400 shrink-0" />
        </div>

        <div className="px-4 py-3 text-sm text-slate-800">
          <MessageRenderer text={recap.feedback} candidate={candidate} onProfilePatched={() => {}} onOpenPath={() => {}} />
        </div>

        <div className="border-t border-violet-100">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition rounded-b-[14px]"
          >
            <span className="flex items-center gap-1.5">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              View interview transcript ({recap.transcript.length} messages)
            </span>
          </button>

          {open && (
            <div className="px-3 pb-3 space-y-1.5 max-h-72 overflow-y-auto">
              {recap.transcript.length === 0 && (
                <div className="text-xs text-slate-400 italic px-2">No exchanges captured.</div>
              )}
              {recap.transcript.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm',
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-slate-50 text-slate-700 rounded-bl-sm border border-slate-100'
                  )}>
                    <div className={cn('text-[10px] uppercase tracking-wide mb-0.5 opacity-70', m.role === 'user' ? 'text-violet-100' : 'text-slate-400')}>
                      {m.role === 'user' ? 'You' : 'Interviewer'}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
