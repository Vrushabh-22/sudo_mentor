export interface ProjectPaletteEntry {
  name: string;
  bg: string;
  bar: string;
  text: string;
  ring: string;
}

export const PROJECT_PALETTE: ProjectPaletteEntry[] = [
  { name: 'Lavender', bg: '#EDE9FE', bar: '#A78BFA', text: '#5B21B6', ring: '#DDD6FE' },
  { name: 'Mint',     bg: '#DCFCE7', bar: '#4ADE80', text: '#166534', ring: '#BBF7D0' },
  { name: 'Peach',    bg: '#FFEDD5', bar: '#FB923C', text: '#9A3412', ring: '#FED7AA' },
  { name: 'Sky',      bg: '#DBEAFE', bar: '#60A5FA', text: '#1E40AF', ring: '#BFDBFE' },
];

export const PROJECT_CAP = 4;

export function colorForProject<T extends { id: string }>(projectId: string | null | undefined, mine: T[]): ProjectPaletteEntry | null {
  if (!projectId) return null;
  const idx = mine.findIndex(p => p.id === projectId);
  if (idx < 0) return null;
  return PROJECT_PALETTE[idx % PROJECT_PALETTE.length];
}
