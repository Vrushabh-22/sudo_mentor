interface Endpoint { x: number; y: number; w: number; h: number }

interface Props {
  rect: { x: number; y: number; w: number; h: number };
  catalog: Endpoint;
  tasks: Endpoint;
  code: Endpoint;
  active?: 'tasks' | 'code' | null;
}

export function ClusterConnectors({ rect, catalog, tasks, code, active }: Props) {
  const toLocal = (p: { x: number; y: number }) => ({ x: p.x - rect.x, y: p.y - rect.y });

  const from = toLocal({ x: catalog.x + catalog.w, y: catalog.y + catalog.h / 2 });
  const toTasks = toLocal({ x: tasks.x, y: tasks.y + tasks.h / 2 });
  const toCode = toLocal({ x: code.x, y: code.y + code.h / 2 });

  const path = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.max(80, (b.x - a.x) * 0.45);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const baseStroke = '#7C3AED';
  const dim = 0.5;
  const bright = 1;

  return (
    <svg
      width={rect.w}
      height={rect.h}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <marker id="arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={baseStroke} opacity={dim} />
        </marker>
        <marker id="arrow-bright" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={baseStroke} opacity={bright} />
        </marker>
      </defs>

      {[
        { key: 'tasks', d: path(from, toTasks), on: active === 'tasks' },
        { key: 'code',  d: path(from, toCode),  on: active === 'code' },
      ].map(({ key, d, on }) => (
        <path
          key={key}
          d={d}
          fill="none"
          stroke={baseStroke}
          strokeWidth={on ? 2.5 : 1.8}
          strokeDasharray="7 7"
          strokeLinecap="round"
          opacity={on ? bright : dim}
          markerEnd={`url(#${on ? 'arrow-bright' : 'arrow-dim'})`}
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.4s" repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}
