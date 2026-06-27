import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Cursor {
  created_at: string;
  id: string;
}

interface CandidateRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  xp_total: number;
  streak_days: number;
  last_active_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export function AdminCandidatesList() {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Reset & fetch first page whenever search term changes.
  useEffect(() => {
    seqRef.current += 1;
    const mySeq = seqRef.current;
    setRows([]);
    setCursor(null);
    setDone(false);
    setTotal(null);
    fetchPage(null, debouncedQ, mySeq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  async function fetchPage(c: Cursor | null, q: string, mySeq: number) {
    setLoading(true);
    // Keyset pagination on (created_at desc, id desc) — index-backed, scales to lakhs.
    let req = supabase
      .from("candidates")
      .select("id,email,full_name,avatar_url,xp_total,streak_days,last_active_at,created_at", { count: c ? undefined : "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);

    if (c) {
      // (created_at, id) < (cursor.created_at, cursor.id)
      req = req.or(
        `created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`,
      );
    }
    if (q) {
      // ilike against email + full_name; trigram indexes accelerate.
      req = req.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    }

    const { data, error, count } = await req;
    if (seqRef.current !== mySeq) return; // stale response
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    const newRows = (data || []) as CandidateRow[];
    setRows((prev) => (c ? [...prev, ...newRows] : newRows));
    if (count != null) setTotal(count);
    if (newRows.length < PAGE_SIZE) {
      setDone(true);
      setCursor(null);
    } else {
      const last = newRows[newRows.length - 1];
      setCursor({ created_at: last.created_at, id: last.id });
    }
  }

  const formattedTotal = useMemo(
    () => (total == null ? "" : total.toLocaleString("en-IN")),
    [total],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {total == null ? "Loading…" : `${formattedTotal} candidate${total === 1 ? "" : "s"}`}
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-8"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-right px-4 py-2">XP</th>
                <th className="text-right px-4 py-2">Streak</th>
                <th className="text-left px-4 py-2">Last active</th>
                <th className="text-left px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium">{r.full_name || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.email}</td>
                  <td className="px-4 py-2 text-right">{r.xp_total}</td>
                  <td className="px-4 py-2 text-right">{r.streak_days}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.last_active_at ? new Date(r.last_active_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No candidates yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-center">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !done && cursor ? (
          <Button variant="outline" onClick={() => fetchPage(cursor, debouncedQ, seqRef.current)}>
            Load more
          </Button>
        ) : rows.length > 0 ? (
          <div className="text-xs text-muted-foreground">End of list</div>
        ) : null}
      </div>
    </div>
  );
}
