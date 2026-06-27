import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { AdminCandidatesList } from "@/components/admin/AdminCandidatesList";
import { AdminSettings } from "@/components/admin/AdminSettings";

export default function AdminShell() {
  const { loading, isAdmin, email } = useIsAdmin();
  const [tab, setTab] = useState("candidates");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            SudoMentor Admin
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="candidates" className="mt-6">
            <AdminCandidatesList />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
