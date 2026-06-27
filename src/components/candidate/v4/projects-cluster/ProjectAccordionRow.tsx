import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProjectPaletteEntry } from './projectPalette';

interface Props {
  title: string;
  meta?: string;
  palette: ProjectPaletteEntry;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function ProjectAccordionRow({ title, meta, palette, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-xl overflow-hidden border transition-shadow"
      style={{ borderColor: palette.ring, background: '#fff' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
        style={{ background: palette.bg }}
      >
        <span className="w-1.5 self-stretch rounded-full" style={{ background: palette.bar }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: palette.text }}>{title}</div>
          {meta && <div className="text-[11px] opacity-75" style={{ color: palette.text }}>{meta}</div>}
        </div>
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ color: palette.text, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && <div className="p-3 border-t" style={{ borderColor: palette.ring }}>{children}</div>}
    </div>
  );
}
