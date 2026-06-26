import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CandidateAuthProvider } from "@/hooks/useCandidateAuth";
import CandidatePortalV4 from "@/pages/CandidatePortalV4";
import CandidateAuth from "@/pages/CandidateAuth";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <CandidateAuthProvider>
            <Routes>
              <Route path="/" element={<CandidatePortalV4 />} />
              <Route path="/auth" element={<CandidateAuth />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CandidateAuthProvider>
        </BrowserRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
