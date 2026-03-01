import { motion } from "framer-motion";
import { Mic, BookOpen, BarChart3, Sparkles, ArrowRight, ShieldCheck, UserCircle, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const floatingIcons = [
  { icon: Mic, x: "10%", y: "20%", delay: 0, size: 20 },
  { icon: BookOpen, x: "85%", y: "15%", delay: 1, size: 18 },
  { icon: BarChart3, x: "75%", y: "75%", delay: 2, size: 22 },
  { icon: Sparkles, x: "15%", y: "70%", delay: 0.5, size: 16 },
];

const WaveformVisualizer = () => (
  <div className="flex items-end gap-1 h-8">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="waveform-bar w-1 rounded-full bg-primary-foreground/60"
        style={{ animationDelay: `${i * 0.1}s` }}
      />
    ))}
  </div>
);

const DashboardMock = () => (
  <motion.div
    initial={{ opacity: 0, x: 40, rotateY: -8 }}
    animate={{ opacity: 1, x: 0, rotateY: 0 }}
    transition={{ duration: 0.8, delay: 0.3 }}
    className="relative"
    style={{ perspective: "1000px" }}
  >
    {/* Teacher panel (back) */}
    <div className="absolute -top-4 -left-4 w-64 rounded-xl bg-card/80 backdrop-blur-sm border border-border p-4 shadow-lg transform rotate-[-3deg]">
      <div className="text-xs font-sans font-semibold text-muted-foreground mb-2">Content Generator</div>
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted w-full" />
        <div className="h-2 rounded-full bg-muted w-3/4" />
        <div className="h-6 rounded-md bg-primary/20 w-1/2 mt-3" />
      </div>
    </div>

    {/* Student panel (front) */}
    <div className="relative z-10 w-72 rounded-xl bg-card border border-border p-5 shadow-xl ml-8 mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-sans font-semibold text-foreground">Student Dashboard</div>
        <div className="flex items-center gap-1 text-xs text-success font-mono">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
          Live
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-xs font-sans font-medium text-foreground">Recording Session</div>
          <WaveformVisualizer />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Fluency", value: "87%" },
          { label: "Clarity", value: "92%" },
          { label: "Pace", value: "78%" },
        ].map((m) => (
          <div key={m.label} className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-sm font-mono font-bold text-primary">{m.value}</div>
            <div className="text-[10px] font-sans text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>
      {/* Metrics bar */}
      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-light"
          initial={{ width: 0 }}
          animate={{ width: "72%" }}
          transition={{ duration: 1.5, delay: 1 }}
        />
      </div>
      <div className="text-[10px] font-sans text-muted-foreground mt-1">Overall Progress: 72%</div>
    </div>
  </motion.div>
);

export default function HeroSection() {
  const navigate = useNavigate();

  const handleLogin = (_role: string) => {
    navigate("/auth");
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero grain-overlay mandala-pattern">
      {/* Floating icons */}
      {floatingIcons.map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-primary-foreground/20 pointer-events-none"
          style={{ left: item.x, top: item.y }}
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 5, repeat: Infinity, delay: item.delay }}
        >
          <item.icon size={item.size} />
        </motion.div>
      ))}

      {/* Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute w-1 h-1 rounded-full bg-primary-foreground/10"
          style={{ left: `${20 + i * 12}%`, top: `${30 + (i % 3) * 20}%` }}
          animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.5, 1] }}
          transition={{ duration: 4 + i, repeat: Infinity }}
        />
      ))}

      <div className="container relative z-10 mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-sans font-medium text-primary-foreground/80">AI-Powered Inclusive Education</span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-primary-foreground leading-tight mb-6">
              Every Voice{" "}
              <span className="relative">
                Deserves
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M0 6C50 2 150 2 200 6" stroke="hsl(42, 75%, 55%)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>{" "}
              to Be Heard
            </h1>

            <p className="text-lg font-sans text-primary-foreground/75 mb-8 max-w-lg leading-relaxed">
              An inclusive learning platform that adapts to every student's needs —
              stammer-friendly practice, sign language support, and AAC communication,
              all powered by AI.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {/* Teacher Card */}
              <motion.button
                onClick={() => handleLogin('teacher')}
                className="relative group p-5 rounded-xl bg-card border border-border/50 hover:border-primary/50 text-left transition-all hover:shadow-lg overflow-hidden"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-serif font-bold text-foreground mb-1">Teacher Portal</h3>
                  <p className="text-xs font-sans text-muted-foreground leading-relaxed">
                    Normally Abled &amp; Specially Abled Teachers
                  </p>
                </div>
              </motion.button>

              {/* Student Card */}
              <motion.button
                onClick={() => handleLogin('student')}
                className="relative group p-5 rounded-xl bg-card border border-border/50 hover:border-sidebar-primary/50 text-left transition-all hover:shadow-lg overflow-hidden"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-sidebar-primary/10 flex items-center justify-center mb-3">
                    <UserCircle className="w-5 h-5 text-sidebar-primary" />
                  </div>
                  <h3 className="font-serif font-bold text-foreground mb-1">Student Portal</h3>
                  <p className="text-xs font-sans text-muted-foreground leading-relaxed">
                    Normally Abled &amp; Divyangjan Students
                  </p>
                </div>
              </motion.button>

              {/* Admin Card */}
              <motion.button
                onClick={() => handleLogin('admin')}
                className="relative group p-5 rounded-xl bg-card border border-border/50 hover:border-gold/50 text-left transition-all hover:shadow-lg overflow-hidden"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-5 h-5 text-gold" />
                  </div>
                  <h3 className="font-serif font-bold text-foreground mb-1">Institution Admin</h3>
                  <p className="text-xs font-sans text-muted-foreground leading-relaxed">
                    Manage profiles, classes &amp; analytics
                  </p>
                </div>
              </motion.button>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mt-10">
              {[
                { value: "10K+", label: "Students" },
                { value: "500+", label: "Lessons" },
                { value: "95%", label: "Satisfaction" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <div className="text-2xl font-serif font-bold text-primary-foreground">{s.value}</div>
                  <div className="text-xs font-sans text-primary-foreground/50">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — Dashboard Mock */}
          <div className="hidden lg:flex justify-center">
            <DashboardMock />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
}
