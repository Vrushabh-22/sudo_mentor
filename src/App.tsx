import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CandidateAuthProvider } from "@/hooks/useCandidateAuth";
import CandidatePortalV4 from "@/pages/CandidatePortalV4";
import CandidateAuth from "@/pages/CandidateAuth";
import AdminLogin from "@/pages/AdminLogin";
import AdminShell from "@/pages/AdminShell";
import Landing from "@/pages/Landing";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {/* Admin routes — no candidate auth context needed */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminShell />} />
            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

            {/* Candidate routes */}
            <Route
              path="/*"
              element={
                <CandidateAuthProvider>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/portal" element={<CandidatePortalV4 />} />
                    <Route path="/portal/*" element={<CandidatePortalV4 />} />
                    <Route path="/auth" element={<CandidateAuth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </CandidateAuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
