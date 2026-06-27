import { ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';

interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onFocus?: () => void;
  children: ReactNode;
}

export function BoardFrame({ emoji, title, subtitle, color, x, y, w, h, onFocus, children }: Props) {
  return (
    <div
      data-board-panel="true"
      style={{
        position: 'absolute',
        left: x, top: y, width: w, height: h,
      }}
      className="bg-white border border-violet-100 shadow-[0_8px_30px_rgba(124,58,237,0.10)] rounded-2xl overflow-hidden flex flex-col"
    >
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0"
        style={{ borderTop: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: `${color}1A`, color }}
          >
            <span>{emoji}</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base text-slate-900 truncate">{title}</div>
            {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
          </div>
        </div>
        {onFocus && (
          <button
            onClick={onFocus}
            className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            title="Focus this board"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div
        data-board-scroll="true"
        className="flex-1 overflow-auto p-5"
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </div>
    </div>
  );
}
