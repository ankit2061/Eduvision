import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Mic, Eye, MessageSquare, Brain, Shield, Users } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Stammer-Friendly AI",
    description: "Real-time fluency analysis with gentle feedback, visual heatmaps, and pacing guidance.",
  },
  {
    icon: Eye,
    title: "Sign Language Support",
    description: "Hover on vocabulary to see sign language GIFs. Built for hearing-impaired learners.",
  },
  {
    icon: MessageSquare,
    title: "AAC Phrase Grids",
    description: "Non-verbal learners select phrase tiles that play audio, enabling communication through the platform.",
  },
  {
    icon: Brain,
    title: "Differentiated Lessons",
    description: "AI generates 3 tiers of content per topic, matching each student's reading and comprehension level.",
  },
  {
    icon: Shield,
    title: "Accessibility First",
    description: "Divyangjan-inspired toggles for dyslexia-friendly fonts, high contrast, and reduced motion.",
  },
  {
    icon: Users,
    title: "Teacher Analytics",
    description: "Class-wide performance dashboards, exportable PDFs, and individual student progress tracking.",
  },
];

export default function FeaturesGrid() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
        >
          <span className="text-xs font-sans font-semibold uppercase tracking-widest text-gold">Features</span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mt-3">
            Built for Every Learner
          </h2>
          <div className="divider-ornate mt-4 max-w-xs mx-auto" />
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="group layer-fg p-6 hover:shadow-xl transition-shadow duration-300 border border-border"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 * i }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-serif font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm font-sans text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
