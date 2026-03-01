import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { BookOpen, Cpu, Mic, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: BookOpen,
    title: "Teacher Creates Content",
    description: "Input topic and grade level. AI generates differentiated lessons across 3 tiers with audio support.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Cpu,
    title: "AI Processes & Adapts",
    description: "Content flows through Gemini & ElevenLabs APIs, generating text, audio, and sign language resources.",
    color: "bg-accent/20 text-accent-foreground",
  },
  {
    icon: Mic,
    title: "Student Practices",
    description: "Choose your mode — read aloud with fluency analysis, hover for sign GIFs, or use AAC phrase grids.",
    color: "bg-success/10 text-success",
  },
  {
    icon: BarChart3,
    title: "Analytics & Feedback",
    description: "Visual heatmaps, fluency scores, spoken AI feedback, and progress tracking saved automatically.",
    color: "bg-gold/10 text-accent-foreground",
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 bg-gradient-sand grain-overlay">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-sans font-semibold uppercase tracking-widest text-gold">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mt-3">
            From Content to Confidence
          </h2>
          <div className="divider-ornate mt-4 max-w-xs mx-auto" />
        </motion.div>

        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-border hidden md:block">
            <motion.div
              className="w-full bg-gradient-to-b from-primary via-gold to-success rounded-full"
              initial={{ height: 0 }}
              animate={isInView ? { height: "100%" } : {}}
              transition={{ duration: 1.5, delay: 0.3 }}
            />
          </div>

          <div className="space-y-12 md:space-y-16">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className={`relative flex items-start gap-6 md:gap-12 ${
                  i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
                initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.2 }}
              >
                {/* Icon node */}
                <div className="flex-shrink-0 md:absolute md:left-1/2 md:-translate-x-1/2 z-10">
                  <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center shadow-md border border-border`}>
                    <step.icon className="w-7 h-7" />
                  </div>
                </div>

                {/* Content */}
                <div className={`layer-fg p-6 flex-1 ${i % 2 === 0 ? "md:mr-auto md:max-w-sm" : "md:ml-auto md:max-w-sm"}`}>
                  <div className="text-xs font-mono text-muted-foreground mb-1">Step {i + 1}</div>
                  <h3 className="text-lg font-serif font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm font-sans text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
