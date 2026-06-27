import { useState } from "react";
import { V4Bootstrap } from "@/pages/CandidatePortalV4";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStorageUrl } from "@/utils/storageUrl";
import {
  Home,
  MessageSquareText,
  GraduationCap,
  User,
  Trophy,
  Briefcase,
  Flame,
  LogOut,
  Hammer,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MentorCopilot } from "./MentorCopilot";
import { CandidateProfileV4 } from "./CandidateProfileV4";
import { PracticeHub } from "./PracticeHub";
import { LeaderboardView } from "./LeaderboardView";
import { V4Home } from "./V4Home";
import { V4JobsTab } from "./V4JobsTab";
import { V4Projects } from "./V4Projects";
import { MyBoardCanvas } from "./myboard/MyBoardCanvas";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import alphaLogo from "@/assets/alpha-logo.png";
import { Logo } from "@/components/Logo";
import { isSudomentor } from "@/utils/isSudomentor";
import { InstallAppButton } from "./InstallAppButton";
import { V4TenantSwitcher } from "./V4TenantSwitcher";

type Tab = "home" | "myboard" | "mentor" | "practice" | "jobs" | "profile" | "leaderboard" | "projects";

interface Props {
  bootstrap: V4Bootstrap;
  onRefresh: () => void;
}

export function V4Shell({ bootstrap, onRefresh }: Props) {
  const { user, signOut } = useCandidateAuth();
  const c = bootstrap.candidate;
  const [tab, setTab] = useState<Tab>(c.profile_completeness && c.profile_completeness >= 60 ? "home" : "mentor");

  const initials =
    `${(c.first_name?.[0] || "").toUpperCase()}${(c.last_name?.[0] || "").toUpperCase()}` || "U";
  const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email.split("@")[0];

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: "home", icon: Home, label: "Home" },
    { id: "myboard", icon: LayoutGrid, label: "MyBoard" },
    { id: "mentor", icon: MessageSquareText, label: "Mentor" },
    { id: "practice", icon: GraduationCap, label: "Practice" },
    { id: "leaderboard", icon: Trophy, label: "Rank" },
    { id: "projects", icon: Hammer, label: "Projects" },
    { id: "jobs", icon: Briefcase, label: "Jobs" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error("Sign out failed", e);
      window.location.href = "/auth?role=candidate";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 pb-24 lg:pb-8">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-violet-100">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {isSudomentor ? (
              <Logo className="h-8 sm:h-[3.1rem]" to={null} />
            ) : (
              <>
                <img src={alphaLogo} alt="AlphaRecrewt" className="h-10 sm:h-16 w-auto object-contain shrink-0" />
                <div className="leading-tight hidden sm:block min-w-0">
                  <div className="font-bold text-sm truncate">AlphaCampus</div>
                  <div className="text-[10px] text-muted-foreground truncate">Your placement copilot</div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Flame className="h-3.5 w-3.5" /> {c.streak_days || 0}d
            </div>
            <div className="hidden sm:block text-xs font-semibold text-violet-700">{c.xp_total || 0} XP</div>
            <div className="sm:hidden flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="flex items-center gap-0.5 text-amber-600">
                <Flame className="h-3 w-3" />
                {c.streak_days || 0}
              </span>
              <span className="text-violet-700">{c.xp_total || 0}xp</span>
            </div>
            <V4TenantSwitcher onSwitched={onRefresh} />
            <InstallAppButton />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-violet-400"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-violet-200 cursor-pointer hover:ring-violet-400 transition">
                    <AvatarImage src={getStorageUrl(c.photo_url)} alt={fullName} className="object-cover" />
                    <AvatarFallback className="text-xs font-semibold bg-violet-100 text-violet-700">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold text-sm truncate">{fullName}</div>
                  <div className="text-[11px] text-muted-foreground font-normal truncate">{c.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTab("profile")}>
                  <User className="h-4 w-4 mr-2" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab("leaderboard")}>
                  <Trophy className="h-4 w-4 mr-2" /> Leaderboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  tab === t.id
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-200"
                    : "text-slate-600 hover:bg-white hover:shadow-sm",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-destructive hover:bg-white hover:shadow-sm transition-all mt-4"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        <section className="min-h-[60vh]">
          {tab === "home" && <V4Home bootstrap={bootstrap} onNavigate={setTab} />}
          {tab === "myboard" && (
            <MyBoardCanvas
              bootstrap={bootstrap}
              onRefresh={onRefresh}
              candidateId={user?.candidateId || ""}
              candidateEmail={c.email}
            />
          )}
          {tab === "mentor" && <MentorCopilot candidate={c} onProfileChanged={onRefresh} />}
          {tab === "practice" && <PracticeHub bootstrap={bootstrap} onDone={onRefresh} />}
          {tab === "jobs" && <V4JobsTab candidateId={user?.candidateId || ""} candidateEmail={c.email} />}
          {tab === "leaderboard" && <LeaderboardView candidate={c} />}
          {tab === "projects" && <V4Projects />}
          {tab === "profile" && (
            <div className="space-y-4">
              <CandidateProfileV4 candidate={c} onSaved={onRefresh} />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-destructive bg-white border border-destructive/20 hover:bg-destructive/5 transition lg:hidden"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          )}
        </section>
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto grid grid-cols-8 h-16">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                tab === t.id ? "text-violet-600" : "text-slate-400",
              )}
            >
              <t.icon className={cn("h-5 w-5", tab === t.id && "stroke-[2.5]")} />
              <span className="text-[9px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
