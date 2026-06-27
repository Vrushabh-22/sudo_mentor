import { createContext, useContext, useCallback, useState, ReactNode } from "react";

interface DataRefreshContextType {
  refreshData: () => void;
  isRefreshing: boolean;
  refreshTimestamp: number;
  subscribe: (cb: () => void) => () => void;
}

const Ctx = createContext<DataRefreshContextType | undefined>(undefined);

export function DataRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshTimestamp, setTs] = useState(Date.now());
  const [isRefreshing, setRefreshing] = useState(false);
  const [subs, setSubs] = useState<Set<() => void>>(new Set());

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    setTs(Date.now());
    subs.forEach((cb) => { try { cb(); } catch {} });
    await new Promise((r) => setTimeout(r, 100));
    setRefreshing(false);
  }, [subs]);

  const subscribe = useCallback((cb: () => void) => {
    setSubs((p) => new Set([...p, cb]));
    return () => setSubs((p) => { const n = new Set(p); n.delete(cb); return n; });
  }, []);

  return <Ctx.Provider value={{ refreshData, isRefreshing, refreshTimestamp, subscribe }}>{children}</Ctx.Provider>;
}

export function useDataRefresh() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDataRefresh must be inside DataRefreshProvider");
  return c;
}
