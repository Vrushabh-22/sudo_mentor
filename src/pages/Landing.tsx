import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, Code2, Brain, Trophy, Briefcase, NotebookPen,
  ArrowRight, Apple, Smartphone, Check, Flame, Zap, Star,
} from "lucide-react";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import { useToast } from "@/hooks/use-toast";

/* ---------- shared ---------- */
const VAPOR = {
  v1: "#c4b5fd", // lavender
  v2: "#818cf8", // indigo
  v3: "#67e8f9", // cyan
  v4: "#a5f3fc", // sky-mint
};

function Tile({
  className = "",
  children,
  delay = 0,
}: { className?: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={
        "group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_8px_40px_-12px_rgba(129,140,248,0.25)] backdrop-blur-xl transition-shadow hover:shadow-[0_20px_60px_-12px_rgba(129,140,248,0.45)] " +
        className
      }
    >
      {children}
    </motion.div>
  );
}

/* ---------- NAV ---------- */
function Nav() {
  const { user } = useCandidateAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/70 backdrop-blur-xl border-b border-white/60" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo className="h-[3.1rem]" />

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#mentor" className="hover:text-slate-900">Mentor</a>
          <a href="#projects" className="hover:text-slate-900">Projects</a>
          <a href="#practice" className="hover:text-slate-900">Practice</a>
          <a href="#jobs" className="hover:text-slate-900">Jobs</a>
          <a href="#app" className="hover:text-slate-900">App</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              to="/portal"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open my portal →
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden text-sm font-medium text-slate-700 hover:text-slate-900 sm:inline">
                Sign in
              </Link>
              <Link
                to="/auth"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------- HERO ---------- */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* iridescent blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-32 top-10 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
          style={{ background: `radial-gradient(circle, ${VAPOR.v1} 0%, transparent 60%)` }}
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-120px] top-32 h-[560px] w-[560px] rounded-full opacity-50 blur-3xl"
          style={{ background: `radial-gradient(circle, ${VAPOR.v3} 0%, transparent 60%)` }}
        />
        <div
          className="absolute left-1/2 bottom-0 h-[300px] w-[700px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle, ${VAPOR.v4} 0%, transparent 70%)` }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr,0.95fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Built for campuses · Free for students
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl"
          >
            Your AI mentor for the{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(120deg, ${VAPOR.v2}, ${VAPOR.v3} 60%, ${VAPOR.v1})` }}
            >
              career you actually want.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600"
          >
            Chat with an AI mentor that learns you. Ship internship-grade projects. Practice daily.
            Climb your campus board. Apply with one tap.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-slate-800 hover:shadow-xl"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur hover:bg-white"
            >
              How it works
            </a>
          </motion.div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Google / GitHub / LinkedIn login</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> iOS & Android coming soon</span>
          </div>
        </div>

        {/* Hero device mock */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div
            className="absolute -inset-6 -z-10 rounded-[40px] opacity-70 blur-2xl"
            style={{ background: `linear-gradient(135deg, ${VAPOR.v1}, ${VAPOR.v3})` }}
          />
          <div className="rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-2xl backdrop-blur-xl">
            {/* Mentor chat bubble */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${VAPOR.v2}, ${VAPOR.v3})` }}
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Sudo Mentor</div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">● online</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                Hey 👋 What stream are you in? I'll build a 4-week roadmap for your dream role.
              </div>
              <div className="ml-8 rounded-2xl bg-slate-900 p-3 text-sm text-white">
                I want to break into product analytics.
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-semibold text-indigo-600">Learning path · Product Analytics</div>
                <div className="mt-1 text-xs text-slate-500">SQL · A/B testing · Mixpanel · 1 capstone</div>
              </div>
            </div>

            {/* floating chips */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 p-2.5 text-center ring-1 ring-orange-100">
                <Flame className="mx-auto h-4 w-4 text-orange-500" />
                <div className="mt-1 text-sm font-bold text-slate-900">12</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500">streak</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-2.5 text-center ring-1 ring-indigo-100">
                <Zap className="mx-auto h-4 w-4 text-indigo-500" />
                <div className="mt-1 text-sm font-bold text-slate-900">1,240</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500">XP</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 p-2.5 text-center ring-1 ring-cyan-100">
                <Trophy className="mx-auto h-4 w-4 text-cyan-600" />
                <div className="mt-1 text-sm font-bold text-slate-900">#7</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500">campus</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- BENTO ---------- */
function Bento() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Everything you need</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            One platform. <span className="text-slate-400">Six superpowers.</span>
          </h2>
        </div>

        <div className="grid auto-rows-[180px] grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-[200px] lg:grid-cols-4">
          {/* Big mentor tile */}
          <Tile className="sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2" delay={0}>
            <div id="mentor" className="flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  <Brain className="h-3.5 w-3.5" /> Sudo Mentor
                </div>
                <h3 className="mt-4 font-display text-3xl font-bold leading-tight text-slate-900">
                  Ask anything.<br />Get a learning path.
                </h3>
                <p className="mt-3 max-w-md text-sm text-slate-600">
                  Voice or text. Resume review, mock interviews, study plans, project ideas —
                  your mentor remembers what you're building.
                </p>
              </div>
              <div className="space-y-2">
                <div className="rounded-2xl bg-slate-900 p-3 text-xs text-white shadow-sm">
                  Walk me through a system-design round for SDE-1.
                </div>
                <div className="ml-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-100">
                  Let's start with scope, then load estimation. Ready?
                </div>
              </div>
              <div
                className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
                style={{ background: `radial-gradient(circle, ${VAPOR.v2}, transparent 70%)` }}
              />
            </div>
          </Tile>

          {/* Projects */}
          <Tile delay={0.05}>
            <div id="projects">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                <Code2 className="h-3.5 w-3.5" /> Projects
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-slate-900">Build real projects.</h3>
              <p className="mt-1 text-xs text-slate-600">AI-evaluated. Portfolio-ready.</p>
            </div>
          </Tile>

          {/* Practice */}
          <Tile delay={0.1}>
            <div id="practice">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <Zap className="h-3.5 w-3.5" /> Daily Practice
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-slate-900">2 quizzes a day.</h3>
              <p className="mt-1 text-xs text-slate-600">Compounding skill, gamified.</p>
            </div>
          </Tile>

          {/* Leaderboard */}
          <Tile delay={0.15}>
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  <Trophy className="h-3.5 w-3.5" /> Leaderboard
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-slate-900">Climb your campus.</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    <Star className="h-3 w-3 text-amber-500" />#{i + 4}
                  </div>
                ))}
              </div>
            </div>
          </Tile>

          {/* Jobs */}
          <Tile delay={0.2}>
            <div id="jobs">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                <Briefcase className="h-3.5 w-3.5" /> Jobs
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-slate-900">Apply with one tap.</h3>
              <p className="mt-1 text-xs text-slate-600">Roles matched to your skills.</p>
            </div>
          </Tile>

          {/* MyBoard - wide */}
          <Tile className="sm:col-span-2 lg:col-span-2" delay={0.25}>
            <div className="flex h-full items-center gap-5">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  <NotebookPen className="h-3.5 w-3.5" /> MyBoard & Notes
                </div>
                <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-slate-900">
                  Your second brain for college.
                </h3>
                <p className="mt-2 text-xs text-slate-600">
                  Infinite canvas. Notes, tasks, project clusters — all linked, all yours.
                </p>
              </div>
              <div className="hidden h-32 w-40 shrink-0 rounded-2xl border border-slate-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-2 sm:block">
                <div className="grid h-full grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-white shadow-sm ring-1 ring-violet-100" />
                  <div className="rounded-lg bg-white shadow-sm ring-1 ring-cyan-100" />
                  <div className="rounded-lg bg-white shadow-sm ring-1 ring-indigo-100" />
                  <div className="rounded-lg bg-white shadow-sm ring-1 ring-emerald-100" />
                </div>
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

/* ---------- MOBILE APP ---------- */
function MobileApp() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  return (
    <section id="app" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div
          className="relative grid items-center gap-12 overflow-hidden rounded-[36px] p-8 sm:p-14 lg:grid-cols-2"
          style={{
            background: `linear-gradient(135deg, ${VAPOR.v1}33, ${VAPOR.v3}33)`,
          }}
        >
          <div className="absolute inset-0 -z-0 opacity-50">
            <div
              className="absolute -left-20 -top-20 h-72 w-72 rounded-full blur-3xl"
              style={{ background: VAPOR.v1 }}
            />
            <div
              className="absolute -bottom-20 -right-10 h-80 w-80 rounded-full blur-3xl"
              style={{ background: VAPOR.v3 }}
            />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700 backdrop-blur">
              <Smartphone className="h-3.5 w-3.5" /> Mobile app
            </div>
            <h2 className="mt-5 font-display text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              Sudo Mentor<br />in your pocket.
            </h2>
            <p className="mt-4 max-w-md text-slate-700">
              Daily nudges. Quick practice. Mentor chat on the go. Native iOS & Android — launching soon.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                toast({ title: "You're on the list ✨", description: "We'll email you when the app drops." });
                setEmail("");
              }}
              className="mt-6 flex max-w-md flex-col gap-2 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@college.edu"
                className="flex-1 rounded-full border border-white/80 bg-white/80 px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Notify me
              </button>
            </form>

            <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 backdrop-blur">
                <Apple className="h-3.5 w-3.5" /> iOS
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 backdrop-blur">
                <Smartphone className="h-3.5 w-3.5" /> Android
              </span>
            </div>
          </div>

          {/* Phone mock */}
          <div className="relative mx-auto w-[260px]">
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative rounded-[44px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl"
            >
              <div
                className="aspect-[9/19.5] rounded-[32px] p-4 text-white"
                style={{ background: `linear-gradient(160deg, ${VAPOR.v2}, ${VAPOR.v3} 80%)` }}
              >
                <div className="text-[10px] font-semibold opacity-80">Good morning, Aman</div>
                <div className="mt-1 font-display text-xl font-bold">Today's mission</div>
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl bg-white/20 p-3 backdrop-blur">
                    <div className="text-[10px] opacity-80">Practice</div>
                    <div className="text-sm font-semibold">2 SQL drills</div>
                  </div>
                  <div className="rounded-xl bg-white/20 p-3 backdrop-blur">
                    <div className="text-[10px] opacity-80">Mentor</div>
                    <div className="text-sm font-semibold">Review your résumé</div>
                  </div>
                  <div className="rounded-xl bg-white/20 p-3 backdrop-blur">
                    <div className="text-[10px] opacity-80">Project</div>
                    <div className="text-sm font-semibold">Ship v0.2 of analytics dash</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Flame className="h-3.5 w-3.5" /> 12-day streak
                  </div>
                  <div className="text-xs font-semibold">+30 XP</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- HOW IT WORKS ---------- */
function HowItWorks() {
  const steps = [
    { n: "01", title: "Sign in", body: "Google, GitHub, or LinkedIn. 10 seconds." },
    { n: "02", title: "Chat with mentor", body: "Tell it your stream. It builds your plan." },
    { n: "03", title: "Ship, climb, get hired", body: "Earn XP. Top your campus. Apply with one tap." },
  ];
  return (
    <section id="how" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Three steps. Zero friction.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-3xl border border-slate-100 bg-white p-7"
            >
              <div
                className="font-display text-5xl font-bold leading-none"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${VAPOR.v2}, ${VAPOR.v3})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {s.n}
              </div>
              <div className="mt-4 font-display text-xl font-bold text-slate-900">{s.title}</div>
              <p className="mt-1.5 text-sm text-slate-600">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- SOCIAL PROOF ---------- */
function SocialProof() {
  const stats = [
    { v: "12K+", l: "Students learning" },
    { v: "3,400", l: "Projects shipped" },
    { v: "1.2M", l: "XP earned this month" },
    { v: "120+", l: "Campuses" },
  ];
  return (
    <section className="py-14 border-y border-slate-100 bg-white/50 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 sm:grid-cols-4 sm:px-8">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div
              className="font-display text-3xl font-bold sm:text-4xl"
              style={{
                backgroundImage: `linear-gradient(135deg, ${VAPOR.v2}, ${VAPOR.v3})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {s.v}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- FINAL CTA ---------- */
function FinalCTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div
          className="relative overflow-hidden rounded-[40px] p-10 text-center sm:p-16"
          style={{ background: `linear-gradient(135deg, ${VAPOR.v2}, ${VAPOR.v3} 70%, ${VAPOR.v1})` }}
        >
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px, 60px 60px"
          }} />
          <h2 className="relative font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">
            Your future self is waiting.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/90">
            Join the Sudo Mentor beta. Free for every college student. Forever.
          </p>
          <Link
            to="/auth"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-slate-900 shadow-lg hover:scale-[1.02] hover:shadow-xl transition-all"
          >
            Get started — it's free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  return (
    <footer className="border-t border-slate-100 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-500 sm:flex-row sm:px-8">
        <Logo className="h-8" to={null} />

        <div className="flex items-center gap-5">
          <a href="#" className="hover:text-slate-900">Privacy</a>
          <a href="#" className="hover:text-slate-900">Terms</a>
          <a href="#" className="hover:text-slate-900">Contact</a>
        </div>
        <div>© {new Date().getFullYear()} Sudo Mentor</div>
      </div>
    </footer>
  );
}

/* ---------- PAGE ---------- */
export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white font-sans text-slate-900">
      <Nav />
      <main>
        <Hero />
        <SocialProof />
        <Bento />
        <MobileApp />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
