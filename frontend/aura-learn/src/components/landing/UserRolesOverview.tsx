import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GraduationCap, BookOpen, Building2 } from "lucide-react";

const roleCards = [
    {
        title: "Teachers",
        icon: GraduationCap,
        dotColor: "bg-primary",
        items: [
            {
                name: "Normally Abled Teacher",
                desc: "creates written, audio, or video content; EduVoice converts it to all needed formats automatically",
            },
            {
                name: "Specially Abled Teacher",
                desc: "uses a voice-first, disability-aware interface where the app itself adapts to the teacher's declared disability",
            },
        ],
    },
    {
        title: "Students",
        icon: BookOpen,
        dotColor: "bg-success",
        items: [
            {
                name: "Normally Abled Student",
                desc: "accesses content in preferred learning style (visual, auditory, reading/writing, kinesthetic)",
            },
            {
                name: "Divyangjan Student",
                desc: "accesses all content, tests, and assignments in formats specifically adapted to their disability type",
            },
        ],
    },
];

const adminCard = {
    title: "Admin / Institution",
    icon: Building2,
    dotColor: "bg-gold",
    description:
        "Manages the school or college on the platform. Uploads student disability profiles and learning style data collected at admission. Assigns students to classes and teachers. Views institution-wide inclusivity analytics. This is the data source that feeds EduVoice's personalization engine.",
};

export default function UserRolesOverview() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section ref={ref} className="relative py-24 overflow-hidden">
            <div className="container mx-auto px-6">
                {/* Header */}
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                >
                    <span className="text-xs font-sans font-semibold uppercase tracking-widest text-gold">
                        Platform
                    </span>
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mt-3">
                        User{" "}
                        <span className="text-gradient-gold">Roles</span>{" "}
                        Overview
                    </h2>
                    <div className="divider-ornate mt-4 max-w-xs mx-auto" />
                </motion.div>

                {/* Top row — Teachers & Students */}
                <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-6">
                    {roleCards.map((card, i) => (
                        <motion.div
                            key={card.title}
                            className="layer-fg p-6 border border-border"
                            initial={{ opacity: 0, y: 30 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: 0.15 * i, duration: 0.5 }}
                        >
                            {/* Card header */}
                            <div className="flex items-center gap-3 mb-4">
                                <span
                                    className={`w-3 h-3 rounded-full ${card.dotColor} flex-shrink-0`}
                                />
                                <h3 className="text-lg font-serif font-semibold text-foreground">
                                    {card.title}
                                </h3>
                            </div>

                            {/* Sub-roles */}
                            <ul className="space-y-3 pl-1">
                                {card.items.map((item) => (
                                    <li
                                        key={item.name}
                                        className="relative text-sm font-sans text-muted-foreground leading-relaxed pl-4 before:content-['•'] before:absolute before:left-0 before:text-muted-foreground/60"
                                    >
                                        <span className="font-semibold text-foreground">
                                            {item.name}
                                        </span>{" "}
                                        — {item.desc}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom row — Admin */}
                <motion.div
                    className="layer-fg p-6 border border-border max-w-5xl mx-auto"
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.35, duration: 0.5 }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <span
                            className={`w-3 h-3 rounded-full ${adminCard.dotColor} flex-shrink-0`}
                        />
                        <h3 className="text-lg font-serif font-semibold text-foreground">
                            {adminCard.title}
                        </h3>
                    </div>
                    <p className="text-sm font-sans text-muted-foreground leading-relaxed">
                        {adminCard.description}
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
