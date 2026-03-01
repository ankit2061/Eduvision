import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, ArrowRight, ArrowLeft, CheckCircle2,
    Eye, Ear, BookOpen, Brain, Hand, Mic,
    Headphones, PenTool, Zap, Lightbulb, Activity,
    MousePointer, HelpCircle, Sparkles
} from "lucide-react";
import { useMe, useCompleteOnboarding, AccessibilityProfile } from "@/lib/api";

// ─── Learner Type Quiz ────────────────────────────────────────────────────────

type LearnerDimension = "visual" | "auditory" | "reading_writing" | "kinesthetic";

interface QuizQuestion {
    question: string;
    options: { text: string; dimension: LearnerDimension }[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        question: "When learning something new, I prefer to…",
        options: [
            { text: "Watch a video or look at diagrams", dimension: "visual" },
            { text: "Listen to someone explain it", dimension: "auditory" },
            { text: "Read instructions or take notes", dimension: "reading_writing" },
            { text: "Try it out hands-on", dimension: "kinesthetic" },
        ],
    },
    {
        question: "I remember things best when I…",
        options: [
            { text: "See pictures or maps of the information", dimension: "visual" },
            { text: "Hear it spoken aloud or in a discussion", dimension: "auditory" },
            { text: "Write it down or read about it", dimension: "reading_writing" },
            { text: "Practice or do an activity", dimension: "kinesthetic" },
        ],
    },
    {
        question: "In my free time, I like to…",
        options: [
            { text: "Draw, watch movies, or look at art", dimension: "visual" },
            { text: "Listen to music or podcasts", dimension: "auditory" },
            { text: "Read books or write stories", dimension: "reading_writing" },
            { text: "Build things or play sports", dimension: "kinesthetic" },
        ],
    },
    {
        question: "When following directions, I prefer…",
        options: [
            { text: "A map or diagram showing the way", dimension: "visual" },
            { text: "Someone telling me step by step", dimension: "auditory" },
            { text: "Written instructions I can follow", dimension: "reading_writing" },
            { text: "Walking the route once to remember it", dimension: "kinesthetic" },
        ],
    },
    {
        question: "In class, I learn best when the teacher…",
        options: [
            { text: "Uses the whiteboard with colors and charts", dimension: "visual" },
            { text: "Explains everything verbally with stories", dimension: "auditory" },
            { text: "Gives handouts and reading material", dimension: "reading_writing" },
            { text: "Lets us do experiments or group activities", dimension: "kinesthetic" },
        ],
    },
    {
        question: "When I'm studying for a test, I…",
        options: [
            { text: "Make mind maps or highlight with colors", dimension: "visual" },
            { text: "Record myself reading notes and listen back", dimension: "auditory" },
            { text: "Re-write my notes and make summaries", dimension: "reading_writing" },
            { text: "Walk around while reviewing or use flashcards", dimension: "kinesthetic" },
        ],
    },
    {
        question: "I get distracted when…",
        options: [
            { text: "The room is visually cluttered or messy", dimension: "visual" },
            { text: "There's a lot of noise around me", dimension: "auditory" },
            { text: "There's too much text on a page without structure", dimension: "reading_writing" },
            { text: "I have to sit still for too long", dimension: "kinesthetic" },
        ],
    },
];

function calculateQuizResult(answers: Record<number, LearnerDimension>): LearnerDimension {
    const scores: Record<LearnerDimension, number> = {
        visual: 0,
        auditory: 0,
        reading_writing: 0,
        kinesthetic: 0,
    };
    for (const dim of Object.values(answers)) {
        scores[dim]++;
    }
    return (Object.entries(scores) as [LearnerDimension, number][])
        .sort((a, b) => b[1] - a[1])[0][0];
}

const LEARNING_STYLE_INFO: Record<LearnerDimension, { emoji: string; label: string; desc: string }> = {
    visual: { emoji: "👁️", label: "Visual Learner", desc: "You learn best with diagrams, infographics, and color-coded content" },
    auditory: { emoji: "👂", label: "Auditory Learner", desc: "You learn best by listening to lectures, narration, and discussions" },
    reading_writing: { emoji: "📖", label: "Reading & Writing Learner", desc: "You learn best by reading text and taking written notes" },
    kinesthetic: { emoji: "🤸", label: "Kinesthetic Learner", desc: "You learn best through hands-on activities and interactive exercises" },
};

// ─── Disability Profiles ──────────────────────────────────────────────────────

interface DisabilityOption {
    id: string;
    label: string;
    icon: typeof Eye;
    description: string;
    color: string;
}

const DISABILITY_PROFILES: DisabilityOption[] = [
    { id: "visual", label: "Blind / Low Vision", icon: Eye, description: "Screen-reader ready, full audio descriptions", color: "text-blue-500" },
    { id: "hearing", label: "Deaf / Hard of Hearing", icon: Ear, description: "Full transcripts, captions, ISL overlays", color: "text-purple-500" },
    { id: "dyslexia", label: "Dyslexia", icon: BookOpen, description: "OpenDyslexic font, synchronized read-aloud", color: "text-green-500" },
    { id: "adhd", label: "ADHD", icon: Zap, description: "Chunked sections, short audio, progress tracking", color: "text-orange-500" },
    { id: "autism", label: "Autism Spectrum", icon: Brain, description: "Clear language, predictable structure, sensory-safe", color: "text-teal-500" },
    { id: "intellectual", label: "Intellectual Disability", icon: Lightbulb, description: "Simplified vocabulary, slow narration, guided steps", color: "text-pink-500" },
    { id: "motor", label: "Physical / Motor", icon: MousePointer, description: "Voice navigation, switch access, no time pressure", color: "text-indigo-500" },
    { id: "speech", label: "Speech / Stammer", icon: Mic, description: "Pacing markers, no time pressure, repeat options", color: "text-amber-500" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: profile, isLoading } = useMe();
    const completeOnboarding = useCompleteOnboarding();

    // Step tracking
    // Student steps: 1=path, 2a=normalOptions, 2b=learningChoice, 2c=quiz, 3=disabilityPicker, 4=confirm
    const [step, setStep] = useState(1);
    const [isSpeciallyAbled, setIsSpeciallyAbled] = useState<boolean | null>(null);
    const [disabilityType, setDisabilityType] = useState<string>("none");
    const [learningStyle, setLearningStyle] = useState<string>("visual");

    // Quiz state
    const [quizAnswers, setQuizAnswers] = useState<Record<number, LearnerDimension>>({});
    const [currentQuizQ, setCurrentQuizQ] = useState(0);
    const [quizResult, setQuizResult] = useState<LearnerDimension | null>(null);

    // Default preferences
    const [prefs, setPrefs] = useState<AccessibilityProfile>({
        high_contrast: false,
        font_scale: 1.0,
        dyslexia_font: false,
        captions_always_on: false,
        visual_rubric: false,
        stammer_friendly: false,
        longer_response_window: false,
        sensory_friendly: false,
        aac_mode: false,
    });

    const baseRole = user?.role || "student";

    useEffect(() => {
        if (profile?.onboarding_complete) {
            navigate(`/${baseRole}`);
        }
    }, [profile, baseRole, navigate]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // ─── Auto-configure accessibility preferences based on disability profile ───
    const autoConfigurePrefs = (disability: string) => {
        const prefsMap: Record<string, Partial<AccessibilityProfile>> = {
            visual: { high_contrast: true, font_scale: 2.0 },
            hearing: { captions_always_on: true, visual_rubric: true },
            dyslexia: { dyslexia_font: true, font_scale: 1.5 },
            adhd: { sensory_friendly: false },
            autism: { sensory_friendly: true },
            intellectual: { font_scale: 1.5 },
            motor: { longer_response_window: true },
            speech: { stammer_friendly: true, longer_response_window: true },
        };
        setPrefs(prev => ({ ...prev, ...(prefsMap[disability] || {}) }));
    };

    const handleComplete = () => {
        let subRole = "";
        if (baseRole === "teacher") {
            subRole = isSpeciallyAbled ? "teacher_special" : "teacher_normal";
        } else if (baseRole === "student") {
            subRole = isSpeciallyAbled ? "student_divyangjan" : "student_normal";
        } else {
            subRole = "admin";
        }

        completeOnboarding.mutate(
            {
                sub_role: subRole,
                is_specially_abled: !!isSpeciallyAbled,
                disability_type: isSpeciallyAbled ? disabilityType : "none",
                learning_style: learningStyle,
                accessibility_preferences: prefs,
            },
            {
                onSuccess: () => navigate(`/${baseRole}`),
            }
        );
    };

    // ─── Teacher Flow (unchanged) ─────────────────────────────────────────────

    const renderTeacherFlow = () => {
        if (step === 1) {
            return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold text-foreground">Welcome, Educator!</h2>
                    <p className="text-muted-foreground">To best adapt the platform for you, do you identify as specially-abled or require specific accessibility features?</p>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => { setIsSpeciallyAbled(false); setStep(99); }}
                            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
                        >
                            <div className="font-semibold mb-1">No, I do not</div>
                            <div className="text-xs text-muted-foreground">Standard teacher interface</div>
                        </button>
                        <button
                            onClick={() => { setIsSpeciallyAbled(true); setStep(2); }}
                            className="p-6 rounded-xl border-2 border-border hover:border-sidebar-primary hover:bg-sidebar-primary/5 transition-all text-center"
                        >
                            <div className="font-semibold mb-1">Yes, I do</div>
                            <div className="text-xs text-muted-foreground">Customise my accessibility UI</div>
                        </button>
                    </div>
                </motion.div>
            );
        }

        if (step === 2) {
            return (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold text-foreground">Select Primary Need</h2>
                    <select
                        value={disabilityType}
                        onChange={(e) => setDisabilityType(e.target.value)}
                        className="w-full p-3 rounded-lg border border-border bg-background mb-4"
                    >
                        <option value="none">Prefer not to say</option>
                        <option value="visual">Visual Impairment</option>
                        <option value="hearing">Hearing Impairment</option>
                        <option value="motor">Motor / Physical</option>
                        <option value="dyslexia">Dyslexia / Learning</option>
                        <option value="speech">Speech / Stammering</option>
                    </select>

                    <h3 className="text-lg font-semibold mt-6 mb-3">Quick Settings</h3>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3">
                            <input type="checkbox" checked={prefs.high_contrast} onChange={(e) => setPrefs({ ...prefs, high_contrast: e.target.checked })} />
                            <span>High Contrast Mode</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input type="checkbox" checked={prefs.dyslexia_font} onChange={(e) => setPrefs({ ...prefs, dyslexia_font: e.target.checked })} />
                            <span>Dyslexia-Friendly Font</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input type="checkbox" checked={prefs.captions_always_on} onChange={(e) => setPrefs({ ...prefs, captions_always_on: e.target.checked })} />
                            <span>Captions Always On</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input type="checkbox" checked={prefs.aac_mode} onChange={(e) => setPrefs({ ...prefs, aac_mode: e.target.checked })} />
                            <span>Enable AAC Communication Tools</span>
                        </label>
                    </div>

                    <button onClick={() => setStep(99)} className="mt-8 w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2">
                        Continue <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>
            );
        }

        // Step 99 = confirm
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
                <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                <h2 className="text-2xl font-serif font-bold text-foreground">You're All Set!</h2>
                <p className="text-muted-foreground">Your profile has been configured. Let's head to the dashboard.</p>
                <button
                    onClick={handleComplete}
                    disabled={completeOnboarding.isPending}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
                >
                    {completeOnboarding.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go to Dashboard"}
                </button>
            </motion.div>
        );
    };

    // ─── Student Flow (redesigned) ────────────────────────────────────────────

    const renderStudentFlow = () => {

        // ── Step 1: Path Selection ──────────────────────────────────────────────
        if (step === 1) {
            return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="text-center mb-2">
                        <Sparkles className="w-10 h-10 text-sidebar-primary mx-auto mb-3" />
                        <h2 className="text-2xl font-serif font-bold text-foreground">Welcome to EduVoice!</h2>
                        <p className="text-muted-foreground mt-2">How would you like to set up your learning experience?</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => { setIsSpeciallyAbled(false); setStep(20); }}
                            className="p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <BookOpen className="w-7 h-7 text-primary" />
                                </div>
                                <div>
                                    <div className="font-semibold text-lg text-foreground">🎓 Normal Student</div>
                                    <div className="text-sm text-muted-foreground mt-0.5">Choose your learning style or take a quiz to find out</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => { setIsSpeciallyAbled(true); setStep(30); }}
                            className="p-6 rounded-2xl border-2 border-border hover:border-sidebar-primary hover:bg-sidebar-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-sidebar-primary/10 flex items-center justify-center group-hover:bg-sidebar-primary/20 transition-colors">
                                    <Activity className="w-7 h-7 text-sidebar-primary" />
                                </div>
                                <div>
                                    <div className="font-semibold text-lg text-foreground">♿ I have a Disability / Special Need</div>
                                    <div className="text-sm text-muted-foreground mt-0.5">We'll adapt all content specifically for you</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </motion.div>
            );
        }

        // ── Step 20: Normal Student — Options ────────────────────────────────────
        if (step === 20) {
            return (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>

                    <div className="text-center mb-2">
                        <h2 className="text-2xl font-serif font-bold text-foreground">How do you learn best?</h2>
                        <p className="text-muted-foreground mt-2">This helps us deliver content in the way you understand it best</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => setStep(21)}
                            className="p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
                                    <PenTool className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">🎯 I know my learning style</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Choose from Visual, Auditory, Reading/Writing, or Kinesthetic</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => { setCurrentQuizQ(0); setQuizAnswers({}); setQuizResult(null); setStep(22); }}
                            className="p-5 rounded-2xl border-2 border-border hover:border-sidebar-primary hover:bg-sidebar-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
                                    <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">🧪 Test what type of learner you are</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Take a quick 7-question quiz to discover your style</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </motion.div>
            );
        }

        // ── Step 21: Learning Choice (direct selection) ──────────────────────────
        if (step === 21) {
            const styles: { id: LearnerDimension; emoji: string; label: string; desc: string; color: string }[] = [
                { id: "visual", emoji: "👁️", label: "Visual Learner", desc: "Diagrams, infographics, color highlights, concept maps", color: "border-blue-400 bg-blue-50 dark:bg-blue-500/10" },
                { id: "auditory", emoji: "👂", label: "Auditory Learner", desc: "Full narration, listening-focused, audio-guided navigation", color: "border-amber-400 bg-amber-50 dark:bg-amber-500/10" },
                { id: "reading_writing", emoji: "📖", label: "Reading & Writing", desc: "Standard text with highlights, notes, structured content", color: "border-green-400 bg-green-50 dark:bg-green-500/10" },
                { id: "kinesthetic", emoji: "🤸", label: "Kinesthetic", desc: "Interactive exercises, quizzes, drag-and-drop, hands-on", color: "border-purple-400 bg-purple-50 dark:bg-purple-500/10" },
            ];

            return (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <button onClick={() => setStep(20)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>

                    <h2 className="text-xl font-serif font-bold text-foreground">Choose Your Learning Style</h2>
                    <p className="text-sm text-muted-foreground">Content from your teachers will be adapted to match how you learn best.</p>

                    <div className="grid grid-cols-1 gap-3">
                        {styles.map(s => (
                            <button
                                key={s.id}
                                onClick={() => { setLearningStyle(s.id); setStep(99); }}
                                className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${learningStyle === s.id ? s.color : "border-border hover:border-primary/40"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{s.emoji}</span>
                                    <div>
                                        <div className="font-semibold text-foreground">{s.label}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>
            );
        }

        // ── Step 22: Learner Type Quiz ──────────────────────────────────────────
        if (step === 22) {
            // Show quiz result
            if (quizResult) {
                const info = LEARNING_STYLE_INFO[quizResult];
                return (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-sidebar-primary/10 flex items-center justify-center mx-auto">
                            <span className="text-4xl">{info.emoji}</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-serif font-bold text-foreground">You are a {info.label}!</h2>
                            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{info.desc}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/50 border border-border text-left">
                            <div className="text-xs font-medium text-muted-foreground mb-2">What this means for you:</div>
                            <ul className="space-y-1.5 text-sm text-foreground">
                                {quizResult === "visual" && (
                                    <>
                                        <li>📊 Content will include rich diagrams and concept maps</li>
                                        <li>🎨 Color-coded highlights on important information</li>
                                        <li>🖼️ Infographics for complex topics</li>
                                    </>
                                )}
                                {quizResult === "auditory" && (
                                    <>
                                        <li>🎧 Full narration of all lesson content</li>
                                        <li>🎙️ Audio-guided navigation through materials</li>
                                        <li>📻 Minimal text, focused on listening</li>
                                    </>
                                )}
                                {quizResult === "reading_writing" && (
                                    <>
                                        <li>📝 Standard text with clear formatting</li>
                                        <li>📋 Structured notes and summaries</li>
                                        <li>📖 Reading-optimized layouts</li>
                                    </>
                                )}
                                {quizResult === "kinesthetic" && (
                                    <>
                                        <li>🎮 Interactive quizzes integrated into lessons</li>
                                        <li>🔧 Hands-on exercises and activities</li>
                                        <li>🏃 Learning by doing, not just reading</li>
                                    </>
                                )}
                            </ul>
                        </div>
                        <button
                            onClick={() => { setLearningStyle(quizResult); setStep(99); }}
                            className="w-full py-3 bg-sidebar-primary text-white rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            Continue with {info.label} <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setStep(21)}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Actually, I'd like to choose a different style →
                        </button>
                    </motion.div>
                );
            }

            // Show quiz questions
            const q = QUIZ_QUESTIONS[currentQuizQ];
            return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <button onClick={() => currentQuizQ === 0 ? setStep(20) : setCurrentQuizQ(currentQuizQ - 1)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-3 h-3" /> {currentQuizQ === 0 ? "Back" : "Previous Question"}
                    </button>

                    {/* Progress */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-sidebar-primary rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: `${((currentQuizQ + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{currentQuizQ + 1}/{QUIZ_QUESTIONS.length}</span>
                    </div>

                    <h2 className="text-lg font-serif font-bold text-foreground">{q.question}</h2>

                    <div className="space-y-3">
                        <AnimatePresence mode="wait">
                            {q.options.map((opt, i) => (
                                <motion.button
                                    key={`${currentQuizQ}-${i}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    onClick={() => {
                                        const newAnswers = { ...quizAnswers, [currentQuizQ]: opt.dimension };
                                        setQuizAnswers(newAnswers);

                                        if (currentQuizQ < QUIZ_QUESTIONS.length - 1) {
                                            setTimeout(() => setCurrentQuizQ(currentQuizQ + 1), 300);
                                        } else {
                                            // Calculate result
                                            const result = calculateQuizResult(newAnswers);
                                            setQuizResult(result);
                                        }
                                    }}
                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-sm ${quizAnswers[currentQuizQ] === opt.dimension
                                        ? "border-sidebar-primary bg-sidebar-primary/5"
                                        : "border-border hover:border-sidebar-primary/40"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${quizAnswers[currentQuizQ] === opt.dimension
                                            ? "bg-sidebar-primary text-white"
                                            : "bg-muted text-muted-foreground"
                                            }`}>
                                            {String.fromCharCode(65 + i)}
                                        </div>
                                        <span className="text-sm text-foreground">{opt.text}</span>
                                    </div>
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            );
        }

        // ── Step 30: Disability Profile Picker ───────────────────────────────────
        if (step === 30) {
            return (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                    <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>

                    <div>
                        <h2 className="text-xl font-serif font-bold text-foreground">Select Your Profile</h2>
                        <p className="text-sm text-muted-foreground mt-1">All content will be automatically adapted for your specific needs.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                        {DISABILITY_PROFILES.map(dp => (
                            <motion.button
                                key={dp.id}
                                whileHover={{ scale: 1.01 }}
                                onClick={() => {
                                    setDisabilityType(dp.id);
                                    autoConfigurePrefs(dp.id);
                                }}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${disabilityType === dp.id
                                    ? "border-sidebar-primary bg-sidebar-primary/5 shadow-sm"
                                    : "border-border hover:border-sidebar-primary/40"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${disabilityType === dp.id ? "bg-sidebar-primary/10" : "bg-muted"
                                        }`}>
                                        <dp.icon className={`w-5 h-5 ${disabilityType === dp.id ? "text-sidebar-primary" : dp.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm text-foreground">{dp.label}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{dp.description}</div>
                                    </div>
                                    {disabilityType === dp.id && (
                                        <CheckCircle2 className="w-5 h-5 text-sidebar-primary flex-shrink-0" />
                                    )}
                                </div>
                            </motion.button>
                        ))}
                    </div>

                    <button
                        onClick={() => setStep(99)}
                        disabled={disabilityType === "none"}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${disabilityType === "none"
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-sidebar-primary text-white hover:bg-sidebar-primary/90"
                            }`}
                    >
                        Continue <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>
            );
        }

        // ── Step 99: Confirmation ────────────────────────────────────────────────
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
                <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                <h2 className="text-2xl font-serif font-bold text-foreground">Ready to Learn!</h2>

                {isSpeciallyAbled ? (
                    <div className="space-y-2">
                        <p className="text-muted-foreground">Your content will be adapted for:</p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sidebar-primary/10">
                            <span className="text-sm font-semibold text-sidebar-primary">
                                {DISABILITY_PROFILES.find(p => p.id === disabilityType)?.label || disabilityType}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-muted-foreground">Your learning style:</p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
                            <span className="text-lg">{LEARNING_STYLE_INFO[learningStyle as LearnerDimension]?.emoji || "📚"}</span>
                            <span className="text-sm font-semibold text-primary">
                                {LEARNING_STYLE_INFO[learningStyle as LearnerDimension]?.label || learningStyle}
                            </span>
                        </div>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    Your teacher's content will be delivered to you in the way you learn best. You can change these settings anytime.
                </p>

                <button
                    onClick={handleComplete}
                    disabled={completeOnboarding.isPending}
                    className="w-full py-3 bg-sidebar-primary text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                    {completeOnboarding.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Learning"}
                </button>
            </motion.div>
        );
    };

    // ─── Progress bar calculation ───────────────────────────────────────────────

    const getProgress = () => {
        if (baseRole !== "student") {
            // Teacher: 3 steps
            if (step === 1) return 33;
            if (step === 2) return 66;
            return 100;
        }
        // Student progress
        if (step === 1) return 15;
        if (step === 20) return 30;
        if (step === 21) return 60;
        if (step === 22) return 30 + (currentQuizQ / QUIZ_QUESTIONS.length) * 50;
        if (step === 30) return 60;
        return 100;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl relative overflow-hidden">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-muted">
                    <motion.div
                        className={`h-full ${baseRole === 'teacher' ? 'bg-primary' : 'bg-sidebar-primary'}`}
                        initial={{ width: '0%' }}
                        animate={{ width: `${getProgress()}%` }}
                        transition={{ duration: 0.4 }}
                    />
                </div>

                <div className="mt-2">
                    {baseRole === "teacher" || baseRole === "admin" ? renderTeacherFlow() : renderStudentFlow()}
                </div>
            </div>
        </div>
    );
}
