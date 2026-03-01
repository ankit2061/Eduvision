import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, BookOpen, Hand, MessageSquare, BarChart3,
  Flame, Star, Trophy, ArrowLeft, Play, Square,
  Volume2, Award, Target, TrendingUp,
  Send, CheckCircle2, Clock, FileText, X, ChevronDown,
  Eye, Ear, Brain, Accessibility, Type,
  FileAudio, FileVideo, FileType, Radio, MonitorPlay,
  ListChecks, Settings2, Loader2, LogOut, Mic2, AlertCircle,
  Sparkles, ArrowRight, Video
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { MarkdownText } from "@/components/MarkdownText";
import { ProfileMenu } from "@/components/ProfileMenu";
import * as store from "@/lib/store";
import {
  useMe,
  useStartSession,
  useAnalyzeSpeech,
  useEndSession,
  useToken,
  useLesson,
  useAdaptedLesson,
  useStudentAssignments,
  useSubmitAssignment,
  useSubmitVideoAssignment,
  useStudentTests,
  useUpdateLesson,
  useStudentStats,
  type VideoEvaluationResult,
  aacSpeak,
  type SpeechAnalysisResult,
  type AccessibilityProfile as ApiAccessibilityProfile,
} from "@/lib/api";

// Simulated student identity (overridden by real /auth/me data when available)
const DEFAULT_STUDENT = { name: "Aarav S.", category: "speech" as store.DisabilityCategory };

const categories: { id: store.DisabilityCategory; label: string; icon: typeof Mic }[] = [
  { id: "speech", label: "Speech & Stammer", icon: Mic },
  { id: "dyslexia", label: "Dyslexia & Reading", icon: Type },
  { id: "hearing", label: "Hearing Impairment", icon: Ear },
  { id: "aac", label: "AAC & Non-Verbal", icon: MessageSquare },
  { id: "visual", label: "Visual Impairment", icon: Eye },
  { id: "autism", label: "Autism Spectrum", icon: Brain },
  { id: "adhd", label: "ADHD", icon: Target },
  { id: "intellectual", label: "Intellectual Disability", icon: Brain },
  { id: "motor", label: "Motor & Physical", icon: Hand },
  { id: "general", label: "General Inclusive", icon: Accessibility },
];

const badges = [
  { icon: Star, label: "First Lesson", unlocked: true },
  { icon: Flame, label: "7-Day Streak", unlocked: true },
  { icon: Trophy, label: "Perfect Score", unlocked: true },
  { icon: Award, label: "50 Lessons", unlocked: false },
  { icon: Target, label: "Master Reader", unlocked: false },
];

const ActivityHeatmap = ({ data, fontClass }: { data: { date: string; count: number }[], fontClass: string }) => {
  const days = 91; // 13 weeks
  const today = new Date();
  const history = Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const item = data?.find(entry => entry.date === dateStr);
    return { date: dateStr, count: item?.count || 0 };
  });

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted/30";
    if (count < 2) return "bg-primary/40";
    if (count < 4) return "bg-primary/70";
    return "bg-primary";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="layer-fg p-5 border border-border shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-bold text-foreground flex items-center gap-2 uppercase tracking-tight ${fontClass === 'text-lg' ? 'text-xs' : 'text-[10px]'}`}>
          <BarChart3 className="w-3.5 h-3.5 text-primary" /> 90-Day Activity Heatmap
        </h3>
        <span className="text-[10px] font-medium text-muted-foreground">
          {data?.length || 0} active days
        </span>
      </div>

      <div className="flex flex-wrap gap-1 md:grid md:grid-flow-col md:grid-rows-7 md:gap-1.5">
        {history.map((h, i) => (
          <div
            key={i}
            className={`w-3 h-3 md:w-3.5 md:h-3.5 rounded-[2px] ${getColor(h.count)} transition-all hover:ring-2 hover:ring-primary/20 cursor-help relative group`}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 shadow-lg">
              {h.date}: {h.count} actions
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <span>Less Activity</span>
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-[1px] bg-muted/30" />
            <div className="w-2.5 h-2.5 rounded-[1px] bg-primary/40" />
            <div className="w-2.5 h-2.5 rounded-[1px] bg-primary/70" />
            <div className="w-2.5 h-2.5 rounded-[1px] bg-primary" />
          </div>
          <span>More Activity</span>
        </div>
        <div className="italic">Powered by EduVoice Streak Engine</div>
      </div>
    </motion.div>
  );
};


type ViewTab = "learn" | "tests" | "live" | "assignments" | "settings";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<ViewTab>("learn");

  // ── Auth ──
  const { user, logout } = useAuth();
  const { data: meData, isLoading: meLoading } = useMe();
  const studentName = meData?.name || user?.name || DEFAULT_STUDENT.name;

  // ── Initialize category and prefs from profile ──
  const profileCategory = (meData?.disability_type as store.DisabilityCategory) ||
    (meData?.learning_style === "visual" ? "general" as store.DisabilityCategory :
      meData?.learning_style === "auditory" ? "general" as store.DisabilityCategory :
        DEFAULT_STUDENT.category);

  const [prefs, setPrefs] = useState<store.AccessibilityPreference>(store.getDefaultPrefs(DEFAULT_STUDENT.category));
  const [studentCategory, setStudentCategory] = useState<store.DisabilityCategory>(DEFAULT_STUDENT.category);

  // Sync from profile when it loads
  useEffect(() => {
    if (meData) {
      const cat = (meData.disability_type as store.DisabilityCategory) || DEFAULT_STUDENT.category;
      setStudentCategory(cat);
      setPrefs(store.getDefaultPrefs(cat));
    }
  }, [meData]);

  // ── API: Lessons ──
  // Note: Student gets materials via assigned items, not the full library.

  // ── Practice session ──
  const startSessionMutation = useStartSession();
  const analyzeSpeechMutation = useAnalyzeSpeech();
  const endSessionMutation = useEndSession();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysisResult | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // ── MediaRecorder refs ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── API Lesson Viewer ──
  const [activeApiLessonId, setActiveApiLessonId] = useState<string | null>(null);
  const [activeApiAssignmentId, setActiveApiAssignmentId] = useState<string | null>(null);
  const { data: apiLessonData, isLoading: apiLessonLoading } = useAdaptedLesson(activeApiLessonId);
  const submitAssignmentMutation = useSubmitAssignment();

  // Video Submission State
  const submitVideoMutation = useSubmitVideoAssignment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoEvaluation, setVideoEvaluation] = useState<VideoEvaluationResult | null>(null);
  const [showVideoEvalModal, setShowVideoEvalModal] = useState(false);

  const handleApiAssignmentSubmit = async () => {
    if (!activeApiAssignmentId) return;
    try {
      // Send all practice quiz answers as a JSON string
      const studentResponse = Object.keys(practiceAnswers).length > 0
        ? JSON.stringify(practiceAnswers)
        : undefined;

      await submitAssignmentMutation.mutateAsync({
        assignmentId: activeApiAssignmentId,
        studentResponse
      });
      setActiveApiLessonId(null);
      setActiveApiAssignmentId(null);
      setPracticeAnswers({});
    } catch (err) {
      console.error("API Submit error", err);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeApiAssignmentId || !apiLessonData?.adapted_text) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        const res = await submitVideoMutation.mutateAsync({
          assignmentId: activeApiAssignmentId,
          video: file,
          context: apiLessonData.adapted_text
        });
        setVideoEvaluation(res.evaluation);
        setShowVideoEvalModal(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        console.error("Video submission failed", err);
      }
    }
  };

  const closeVideoEvalModal = () => {
    setShowVideoEvalModal(false);
    setVideoEvaluation(null);
    setActiveApiLessonId(null);
    setActiveApiAssignmentId(null);
    setActiveTab("assignments");
  };


  // Local (localStorage) data
  const [materials, setMaterials] = useState<store.Material[]>([]);
  const [viewMat, setViewMat] = useState<store.Material | null>(null);
  const [viewFormat, setViewFormat] = useState<store.MaterialFormat>("written");

  // ── API: Tests ──
  const { data: apiTests = [], isLoading: apiTestsLoading } = useStudentTests();
  const [activeTest, setActiveTest] = useState<any | null>(null);

  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [testMethod, setTestMethod] = useState<store.MaterialFormat>("written");
  const [liveClasses, setLiveClasses] = useState<store.LiveClass[]>([]);
  const [activeLive, setActiveLive] = useState<store.LiveClass | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [assignments, setAssignments] = useState<store.Assignment[]>([]);
  // DB Assignments
  const { data: dbAssignments = [], isLoading: assignmentsLoading } = useStudentAssignments();
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [responseText, setResponseText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [recordingQuestionIndex, setRecordingQuestionIndex] = useState<number | null>(null);

  // ── Stats ──
  const { data: stats } = useStudentStats();

  // ── Audio Player State ──
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const getToken = useToken();

  const playTextAudio = async (text: string) => {
    if (isPlayingAudio) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setIsPlayingAudio(false);
      return;
    }

    try {
      setIsPlayingAudio(true);
      const token = await getToken();
      const audioUrl = await aacSpeak(text, token);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
    } catch (err) {
      console.error("Failed to play text audio:", err);
      setIsPlayingAudio(false);
    }
  };

  const refresh = useCallback(() => {
    setMaterials(store.getMaterials().filter(m => m.status === "published"));
    setLiveClasses(store.getLiveClasses().filter(c => c.status === "live"));
    const allAssign = store.getAssignments().filter(a => {
      const assigned = typeof a.assignedTo === 'string' ? a.assignedTo.trim().toLowerCase() : "";
      const currentStudent = studentName ? studentName.trim().toLowerCase() : "";
      return assigned === "class" || assigned === currentStudent;
    });
    setAssignments(allAssign);
  }, [studentName]);

  useEffect(() => { refresh(); }, [refresh]);

  const fontClass = prefs.fontSize === "xlarge" ? "text-lg" : prefs.fontSize === "large" ? "text-base" : "text-sm";

  // ─── Real mic recording → speech-analyze pipeline ───────────────────────────
  const startRecording = async (questionIndex: number | null = null) => {
    try {
      if (questionIndex !== null) setRecordingQuestionIndex(questionIndex);
      // 1. Start a practice session on the backend first
      let sessionId = activeSessionId;
      if (!sessionId) {
        const apiPrefs: ApiAccessibilityProfile = {
          stammer_friendly: studentCategory === "speech",
          captions_always_on: prefs.captionsEnabled,
          sensory_friendly: studentCategory === "autism",
          aac_mode: studentCategory === "aac",
        };
        const session = await startSessionMutation.mutateAsync({
          lesson_id: activeApiLessonId || undefined,
          mode: "read-aloud",
          accessibility_json: apiPrefs,
        });
        sessionId = session.session_id;
        setActiveSessionId(sessionId);
      }

      // 2. Get mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setRecording(false);
        setRecordingTime(0);

        // 3. Send to /practice/speech-analyze
        try {
          const apiPrefs: ApiAccessibilityProfile = {
            stammer_friendly: studentCategory === "speech",
            captions_always_on: prefs.captionsEnabled,
            sensory_friendly: studentCategory === "autism",
            aac_mode: studentCategory === "aac",
          };
          const result = await analyzeSpeechMutation.mutateAsync({
            sessionId: sessionId!,
            mode: "read-aloud",
            audioBlob: blob,
            accessibilityJson: apiPrefs,
            generateSpokenFeedback: prefs.audioDescription,
          });

          if (questionIndex !== null) {
            setPracticeAnswers(prev => ({ ...prev, [questionIndex]: prev[questionIndex] ? prev[questionIndex] + " " + result.transcript : result.transcript }));
            setRecordingQuestionIndex(null);
          } else if (activeAssignment || activeApiAssignmentId) {
            setResponseText(prev => prev ? prev + " " + result.transcript : result.transcript);
          } else {
            setAnalysisResult(result);
            setShowAnalysisModal(true);
          }
        } catch (err) {
          console.error("Speech analysis failed:", err);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);

      // Auto-stop after 30s
      const interval = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 30) {
            clearInterval(interval);
            recorder.stop();
            return 0;
          }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Mic access denied or failed:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const endSession = async () => {
    if (activeSessionId) {
      await endSessionMutation.mutateAsync(activeSessionId);
      setActiveSessionId(null);
    }
  };

  // Test submission
  const submitTest = () => {
    if (!activeTest) return;
    const qs = activeTest.convertedTests[studentCategory] || activeTest.questions;
    let correct = 0;
    qs.forEach(q => {
      if (testAnswers[q.id]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) correct++;
    });
    const score = Math.round((correct / qs.length) * 100);
    setTestScore(score);
    setTestSubmitted(true);
    store.addSubmission({
      id: Date.now().toString(),
      testId: activeTest.id,
      studentName: studentName,
      answers: testAnswers,
      score,
      submittedAt: new Date().toLocaleDateString(),
      method: testMethod,
    });
  };

  // Live chat
  const sendChat = () => {
    if (!chatInput.trim() || !activeLive) return;
    const msg = { sender: studentName, message: chatInput, time: new Date().toLocaleTimeString() };
    const updated = { ...activeLive, chatMessages: [...activeLive.chatMessages, msg] };
    store.updateLiveClass(activeLive.id, { chatMessages: updated.chatMessages });
    setActiveLive(updated);
    setChatInput("");
  };

  // Assignment submit
  const submitAssignment = () => {
    if (!activeAssignment || !responseText.trim()) return;
    store.updateAssignment(activeAssignment.id, { status: "submitted", studentResponse: responseText });
    setActiveAssignment(null);
    setResponseText("");
    refresh();
  };

  const formatIcon = (f: store.MaterialFormat) => f === "audio" ? FileAudio : f === "video" ? FileVideo : FileType;

  const tabItems = [
    { id: "learn" as ViewTab, icon: BookOpen, label: "Learn" },
    { id: "tests" as ViewTab, icon: ListChecks, label: "Tests" },
    { id: "live" as ViewTab, icon: Radio, label: "Live" },
    { id: "assignments" as ViewTab, icon: Send, label: "Tasks" },
    { id: "settings" as ViewTab, icon: Settings2, label: "Settings" },
  ];

  return (
    <div className={`min-h-screen bg-background ${prefs.highContrast ? "contrast-more" : ""}`}>
      {/* Top nav */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></Link>
          <BookOpen className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold text-foreground">Student Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-2 hidden md:flex">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Level {stats?.level || 1}</span>
              <span className="text-primary">{stats?.xp || 0} XP</span>
            </div>
            <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${stats?.xp_progress || 0}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-gold/10 text-gold flex items-center gap-1"><Flame className="w-3 h-3" /> {stats?.streak_days || 0} days</span>

          <ProfileMenu>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all">
              <span className="text-xs font-bold text-primary">{(studentName?.[0] || "U").toUpperCase()}</span>
            </div>
          </ProfileMenu>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-1 max-w-6xl mx-auto">
          {tabItems.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-sans border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
              <t.icon className="w-4 h-4" /> {t.label}
              {t.id === "live" && liveClasses.length > 0 && (
                <motion.span className="w-2 h-2 rounded-full bg-destructive" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Sessions", value: stats?.total_sessions.toString() || "0", icon: Mic, trend: stats?.sessions_trend || "+0" },
            { label: "Fluency", value: stats ? `${Math.round(stats.avg_fluency * 10)}%` : "0%", icon: TrendingUp, trend: stats?.fluency_trend || "0%" },
            { label: "Streak", value: `${stats?.streak_days || 0}d`, icon: Flame, trend: stats?.streak_trend || "New!" },
            { label: "Badges", value: `${stats?.badges_earned || 0}/${stats?.total_badges || 10}`, icon: Trophy, trend: stats?.badges_trend || "+0" },
          ].map((s, i) => (
            <motion.div key={s.label} className="layer-fg p-4 border border-border" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <div className="flex items-center justify-between mb-1">
                <s.icon className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-success">{s.trend}</span>
              </div>
              <div className={`font-serif font-bold text-foreground ${prefs.fontSize === "xlarge" ? "text-2xl" : "text-xl"}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Activity Heatmap */}
        {stats && <ActivityHeatmap data={stats.activity_data} fontClass={fontClass} />}

        {/* Analysis in-progress indicator */}
        {analyzeSpeechMutation.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="layer-fg p-4 border border-primary/30 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <div className="text-sm font-semibold text-foreground">Analyzing your speech…</div>
              <div className="text-xs text-muted-foreground">Gemini is scoring fluency, grammar, confidence & pronunciation</div>
            </div>
          </motion.div>
        )}

        {/* ===== LEARN TAB ===== */}
        {activeTab === "learn" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="layer-fg p-6 border border-border">
              {activeApiLessonId ? (
                <div className="animate-in fade-in duration-500">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <div>
                      <h2 className={`font-serif font-semibold text-foreground ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>
                        {dbAssignments.find(a => a.lesson_id === activeApiLessonId)?.topic || "Lesson Content"}
                      </h2>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Adapted for {store.CATEGORY_LABELS[studentCategory]}
                      </p>
                    </div>
                    <button onClick={() => { setActiveApiLessonId(null); setActiveApiAssignmentId(null); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <X className="w-3 h-3" /> Close
                    </button>
                  </div>

                  {apiLessonLoading ? (
                    <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                  ) : apiLessonData ? (
                    <div className="animate-in fade-in zoom-in-95">
                      <h2 className={`font-serif font-semibold text-foreground mb-4 ${fontClass === "text-lg" ? "text-2xl" : "text-xl"}`}>Lesson Activity</h2>

                      <div className="p-4 bg-muted/30 rounded-xl border border-border">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">✨ Adapted for {store.CATEGORY_LABELS[apiLessonData.disability_type as store.DisabilityCategory] || apiLessonData.disability_type || 'General'}</span>
                          {apiLessonData.is_adaptive && <span className="text-xs px-2 py-1 rounded-full bg-gold/10 text-gold">🧠 Pre-Generated Adaptive</span>}
                        </div>

                        {/* Title if available */}
                        {apiLessonData.adaptive_version?.title && (
                          <h3 className={`font-serif font-bold text-foreground mb-3 ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>
                            {apiLessonData.adaptive_version.title}
                          </h3>
                        )}

                        <MarkdownText
                          content={apiLessonData.adapted_text}
                          className={`font-sans whitespace-pre-wrap ${fontClass} text-foreground leading-relaxed`}
                        />

                        {/* Key Concepts */}
                        {apiLessonData.adaptive_version?.key_concepts?.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {apiLessonData.adaptive_version.key_concepts.map((c: string, i: number) => (
                              <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">{c}</span>
                            ))}
                          </div>
                        )}

                        {/* Summary */}
                        {apiLessonData.adaptive_version?.summary && (
                          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="text-xs font-semibold text-primary mb-1">📋 Summary</div>
                            <MarkdownText content={apiLessonData.adaptive_version.summary} className={`${fontClass} text-foreground`} />
                          </div>
                        )}

                        {/* HEARING: Diagram Descriptions */}
                        {apiLessonData.adaptive_version?.diagram_descriptions?.length > 0 && (
                          <div className="mt-5 space-y-3">
                            <h4 className="text-sm font-serif font-bold text-foreground flex items-center gap-2">📊 Visual Diagrams</h4>
                            {apiLessonData.adaptive_version.diagram_descriptions.map((d: any, i: number) => (
                              <div key={i} className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
                                <div className="text-xs font-semibold text-primary mb-1">{d.concept}</div>
                                <MarkdownText content={d.description} className={`${fontClass} text-foreground leading-relaxed`} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* HEARING: Image Search Queries */}
                        {apiLessonData.adaptive_version?.image_search_queries?.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs font-semibold text-muted-foreground mb-2">🔍 Supporting Images (search queries)</div>
                            <div className="flex flex-wrap gap-2">
                              {apiLessonData.adaptive_version.image_search_queries.map((q: string, i: number) => (
                                <a key={i} href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full bg-muted border border-border hover:bg-muted/80 text-foreground transition-colors">
                                  🖼️ {q}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* VISUAL: Visual Summary */}
                        {apiLessonData.adaptive_version?.visual_summary && (
                          <div className="mt-4 p-3 rounded-lg bg-gold/5 border border-gold/20">
                            <div className="text-xs font-semibold text-gold mb-1">👁️ Visual Representation</div>
                            <MarkdownText content={apiLessonData.adaptive_version.visual_summary} className={`${fontClass} text-foreground`} />
                          </div>
                        )}

                        {/* SPEECH/AAC: Scripts */}
                        {apiLessonData.adaptive_version?.audio_guide_script && (
                          <div className="mt-4 p-3 rounded-lg bg-secondary/10 border border-border">
                            <div className="text-xs font-semibold text-secondary-foreground mb-1">🎧 Audio Guide Script</div>
                            <MarkdownText content={apiLessonData.adaptive_version.audio_guide_script} className={`${fontClass} text-foreground italic`} />
                          </div>
                        )}
                        {apiLessonData.adaptive_version?.read_aloud_script && (
                          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">🗣️ Read Aloud Script</div>
                            <MarkdownText content={apiLessonData.adaptive_version.read_aloud_script} className={`${fontClass} text-foreground whitespace-pre-wrap font-sans`} />
                          </div>
                        )}

                        {/* INTELLECTUAL: Simplified Summary */}
                        {apiLessonData.adaptive_version?.simplified_summary && (
                          <div className="mt-4 p-3 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700">
                            <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 mb-1">💡 Simple Summary</div>
                            <MarkdownText content={apiLessonData.adaptive_version.simplified_summary} className={`${fontClass} text-foreground`} />
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <button onClick={() => setActiveTab("assignments")}
                          className="text-sm px-6 py-2.5 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 flex items-center gap-2">
                          <Send className="w-4 h-4" /> Go to Tasks
                        </button>
                        <button onClick={() => playTextAudio(apiLessonData.adapted_text || "")}
                          className={`text-sm px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${isPlayingAudio ? 'bg-gold text-white animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                          {isPlayingAudio ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4" />}
                          {isPlayingAudio ? 'Stop Audio' : 'Play Adapted Lesson'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">Failed to load lesson.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Assigned to You Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`font-serif font-semibold text-foreground flex items-center gap-2 ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>
                        <Sparkles className="w-5 h-5 text-gold" /> Assigned to You
                      </h2>
                    </div>
                    {assignmentsLoading ? (
                      <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
                    ) : dbAssignments.filter(a => a.status !== "submitted").length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/20">
                        No new assignments. Check back later!
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-3">
                        {dbAssignments.filter(a => a.status !== "submitted").map(a => (
                          <motion.div key={a.assignment_id}
                            className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer bg-card"
                            onClick={() => {
                              if (a.lesson_id) {
                                setActiveApiLessonId(a.lesson_id);
                                setActiveApiAssignmentId(a.assignment_id);
                              }
                            }}
                            whileHover={{ scale: 1.01 }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-sans font-semibold text-foreground ${fontClass}`}>{a.topic || 'New Lesson'}</span>
                              <ArrowRight className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-xs text-muted-foreground">Due {a.due_date || 'N/A'}</div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Study Library Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`font-serif font-semibold text-foreground ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>
                        📚 Study Library
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Preferred:</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{prefs.preferredFormat}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      General materials adapted for {store.CATEGORY_LABELS[studentCategory]}.
                    </p>

                    {materials.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No library materials available yet.
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-3">
                        {materials.map(mat => (
                          <motion.div key={mat.id} className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => { setViewMat(mat); setViewFormat(prefs.preferredFormat); }}
                            whileHover={{ scale: 1.01 }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-sans font-semibold text-foreground ${fontClass}`}>{mat.title}</span>
                              {React.createElement(formatIcon(mat.originalFormat), { className: "w-4 h-4 text-primary" })}
                            </div>
                            <div className="text-xs text-muted-foreground">{mat.topic} · {mat.grade}</div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ===== TESTS TAB ===== */}
        {activeTab === "tests" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="layer-fg p-6 border border-border">
              <h2 className={`font-serif font-semibold text-foreground mb-4 ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>
                📝 Available Tests
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Tests are adapted for {store.CATEGORY_LABELS[studentCategory]}. Choose how you want to take the test.
              </p>

              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-2 block">How do you want to take the test?</label>
                <div className="flex gap-2">
                  {(["written", "audio", "video"] as store.MaterialFormat[]).map(f => (
                    <button key={f} onClick={() => setTestMethod(f)}
                      className={`flex-1 py-2 rounded-lg border text-xs capitalize ${testMethod === f ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-muted-foreground"}`}>
                      {f === "written" ? "✍️ Type" : f === "audio" ? "🎤 Speak" : "📹 Video"} {f}
                    </button>
                  ))}
                </div>
              </div>

              {apiTestsLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Fetching your tests...
                </div>
              ) : apiTests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No tests available yet</div>
              ) : (
                <div className="space-y-3">
                  {apiTests.map(t => (
                    <div key={t.assignment_id} className="p-4 rounded-xl border border-border hover:bg-muted/30 flex items-center justify-between">
                      <div>
                        <div className={`font-sans font-semibold text-foreground ${fontClass}`}>{t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.time_limit > 0 ? `${t.time_limit} min` : "No limit"} · Due: {t.due_date || 'None'}</div>
                      </div>
                      <button onClick={() => { setActiveTest(t); setTestAnswers({}); setTestSubmitted(false); setTestScore(null); }}
                        className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-1">
                        <Play className="w-3 h-3" /> Take Test
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ===== LIVE TAB ===== */}
        {activeTab === "live" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {liveClasses.length === 0 && !activeLive ? (
              <div className="layer-fg p-6 border border-border text-center py-12">
                <Radio className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No live classes right now</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Your teacher will start one — you'll see it here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {!activeLive && liveClasses.map(lc => (
                  <div key={lc.id} className="layer-fg p-4 border border-destructive/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div className="w-3 h-3 rounded-full bg-destructive" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                      <div>
                        <div className="text-sm font-semibold text-foreground">{lc.title}</div>
                        <div className="text-xs text-muted-foreground">{lc.topic} · LIVE NOW</div>
                      </div>
                    </div>
                    <button onClick={() => setActiveLive(lc)}
                      className="text-xs px-4 py-2 rounded-lg bg-destructive text-destructive-foreground flex items-center gap-1">
                      <Play className="w-3 h-3" /> Join
                    </button>
                  </div>
                ))}

                {activeLive && (
                  <div className="layer-fg p-6 border border-destructive/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <motion.div className="w-3 h-3 rounded-full bg-destructive" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                        <h2 className="text-lg font-serif font-semibold text-foreground">LIVE: {activeLive.title}</h2>
                      </div>
                      <button onClick={() => setActiveLive(null)} className="text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground">Leave</button>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 space-y-3">
                        <div className="bg-muted/30 rounded-xl p-4 min-h-[200px] flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <MonitorPlay className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Live class view</p>
                            <p className="text-xs mt-1">Adapted for: {store.CATEGORY_LABELS[studentCategory]}</p>
                          </div>
                        </div>

                        {/* Accessibility features active */}
                        <div className="flex flex-wrap gap-2">
                          {prefs.captionsEnabled && <span className="text-[10px] px-2 py-1 rounded-full bg-success/10 text-success">📝 Captions ON</span>}
                          {prefs.signLanguage && <span className="text-[10px] px-2 py-1 rounded-full bg-success/10 text-success">🤟 Sign Language ON</span>}
                          {prefs.audioDescription && <span className="text-[10px] px-2 py-1 rounded-full bg-success/10 text-success">🔊 Audio Description ON</span>}
                          {prefs.screenReader && <span className="text-[10px] px-2 py-1 rounded-full bg-success/10 text-success">♿ Screen Reader ON</span>}
                          {prefs.simplifiedText && <span className="text-[10px] px-2 py-1 rounded-full bg-success/10 text-success">📖 Simplified Text ON</span>}
                        </div>

                        {/* Live transcript */}
                        <div className="p-3 rounded-lg bg-muted/20 border border-border">
                          <div className="text-xs font-medium text-muted-foreground mb-1">📝 Live Transcript</div>
                          <p className={`font-sans text-foreground whitespace-pre-wrap ${fontClass}`}>{activeLive.transcript}</p>
                        </div>
                      </div>

                      {/* Chat */}
                      <div className="flex flex-col border border-border rounded-xl overflow-hidden">
                        <div className="p-3 border-b border-border bg-muted/30">
                          <span className="text-xs font-semibold text-foreground">Class Chat</span>
                        </div>
                        <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[300px]">
                          {activeLive.chatMessages.map((msg, i) => (
                            <div key={i} className={`text-xs ${msg.sender === studentName ? "text-primary" : msg.sender === "System" ? "text-gold" : "text-foreground"}`}>
                              <span className="font-semibold">{msg.sender}:</span> {msg.message}
                            </div>
                          ))}
                        </div>
                        <div className="p-2 border-t border-border flex gap-2">
                          <input className="flex-1 px-3 py-2 rounded-lg bg-muted border-0 text-xs text-foreground focus:outline-none"
                            placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sendChat()} />
                          <button onClick={sendChat} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs"><Send className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ===== TASKS TAB (Workspace) ===== */}
        {activeTab === "assignments" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="layer-fg p-6 border border-border">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`font-serif font-semibold text-foreground flex items-center gap-2 ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>
                  📋 Lesson Workspace
                </h2>
                {activeApiLessonId && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-bold">
                    Active: {dbAssignments.find(a => a.lesson_id === activeApiLessonId)?.topic || "Selected Lesson"}
                  </span>
                )}
              </div>

              {!apiLessonData ? (
                <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed border-border">
                  <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-sans font-semibold text-foreground mb-1">No Active Lesson</h3>
                  <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
                    Select a lesson from the <strong>Learn</strong> tab to view your questions and submit your response.
                  </p>
                  <button onClick={() => setActiveTab("learn")} className="mt-6 text-xs font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    Go to Learn
                  </button>
                </div>
              ) : (
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                  {/* Practice Questions (Interactive Quiz Format) */}
                  <div className="p-5 rounded-xl bg-card border border-border shadow-sm mb-6">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      ❓ Lesson Quiz
                    </h3>
                    {apiLessonData.adaptive_version?.questions?.length > 0 ? (
                      <div className="space-y-6">
                        {apiLessonData.adaptive_version.questions.map((q: string, i: number) => (
                          <div key={i} className="space-y-3">
                            <div className={`flex gap-3 text-foreground ${fontClass} font-semibold`}>
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="mt-0.5">{q}</span>
                            </div>

                            <div className="relative">
                              <textarea
                                className={`w-full p-3 rounded-xl bg-muted/30 border border-border text-foreground min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${fontClass}`}
                                placeholder="Type your answer here..."
                                value={practiceAnswers[i] || ""}
                                onChange={(e) => setPracticeAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                              />
                              <button
                                onClick={() => {
                                  if (recording && recordingQuestionIndex === i) {
                                    stopRecording();
                                  } else {
                                    startRecording(i);
                                  }
                                }}
                                className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${recording && recordingQuestionIndex === i
                                  ? "bg-destructive text-white animate-pulse"
                                  : "bg-primary/10 text-primary hover:bg-primary/20"
                                  }`}
                                title={recording && recordingQuestionIndex === i ? "Stop Recording" : "Speak Answer"}
                              >
                                {recording && recordingQuestionIndex === i ? (
                                  <div className="flex items-center gap-1">
                                    <Square className="w-3 h-3 fill-current" />
                                    <span className="text-[10px] font-bold">{recordingTime}s</span>
                                  </div>
                                ) : (
                                  <Mic className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No specific questions for this lesson.</p>
                    )}
                  </div>

                  {/* Submission Section */}
                  <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
                    <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                      🚀 Your Response
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Submit your work using the tools below. Your response will be reviewed by your teacher.
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <button onClick={handleApiAssignmentSubmit}
                        disabled={submitAssignmentMutation.isPending || submitVideoMutation.isPending}
                        className="flex-1 min-w-[140px] py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-success text-success-foreground hover:bg-success/90 shadow-sm">
                        {submitAssignmentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Submit Lesson Work
                      </button>

                      <div className="flex-1 min-w-[140px] flex items-center justify-center text-[10px] text-muted-foreground border border-dashed border-border rounded-xl px-2 text-center italic">
                        Responses are saved locally as you type or speak.
                      </div>

                      {/* Only show Video Upload if Deaf or Hard of Hearing profile */}
                      {(studentCategory === "hearing" || prefs.preferredFormat === "video") && (
                        <div className="flex-1 min-w-[140px]">
                          <input type="file" accept="video/mp4,video/webm" className="hidden" ref={fileInputRef} onChange={handleVideoUpload} />
                          <button onClick={() => fileInputRef.current?.click()}
                            disabled={submitVideoMutation.isPending}
                            className="w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm">
                            {submitVideoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                            Sign Video
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ===== SETTINGS TAB ===== */}
        {activeTab === "settings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
            <div className="layer-fg p-6 border border-border">
              <h2 className="text-lg font-serif font-semibold text-foreground mb-4 flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-primary" /> My Accessibility Settings
              </h2>
              <p className="text-xs text-muted-foreground mb-6">Customize how you experience learning materials, tests, and live classes.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">My Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map(c => (
                      <button key={c.id} onClick={() => { setStudentCategory(c.id); setPrefs(store.getDefaultPrefs(c.id)); }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${studentCategory === c.id ? "border-primary bg-primary/5" : "border-border"
                          }`}>
                        <c.icon className="w-4 h-4 text-primary" />
                        <span className="text-foreground">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2">
                    <span className="text-xs text-foreground">Preferred Format</span>
                    <select value={prefs.preferredFormat} onChange={e => setPrefs({ ...prefs, preferredFormat: e.target.value as store.MaterialFormat })}
                      className="text-xs px-2 py-1 rounded bg-muted border border-border text-foreground">
                      <option value="written">Written</option><option value="audio">Audio</option><option value="video">Video</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="text-xs text-foreground">Font Size</span>
                    <select value={prefs.fontSize} onChange={e => setPrefs({ ...prefs, fontSize: e.target.value as any })}
                      className="text-xs px-2 py-1 rounded bg-muted border border-border text-foreground">
                      <option value="normal">Normal</option><option value="large">Large</option><option value="xlarge">Extra Large</option>
                    </select>
                  </div>
                  {([
                    { key: "highContrast" as const, label: "High Contrast" },
                    { key: "screenReader" as const, label: "Screen Reader" },
                    { key: "signLanguage" as const, label: "Sign Language" },
                    { key: "simplifiedText" as const, label: "Simplified Text" },
                    { key: "audioDescription" as const, label: "Audio Description" },
                    { key: "captionsEnabled" as const, label: "Captions" },
                    { key: "switchAccess" as const, label: "Switch Access" },
                  ]).map(p => (
                    <div key={p.key} className="flex items-center justify-between p-2">
                      <span className="text-xs text-foreground">{p.label}</span>
                      <button onClick={() => setPrefs({ ...prefs, [p.key]: !prefs[p.key] })}
                        className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs[p.key] ? "bg-primary justify-end" : "bg-muted justify-start"}`}>
                        <motion.div layout className="w-5 h-5 rounded-full bg-primary-foreground shadow" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="layer-fg p-5 border border-border">
              <h3 className="text-sm font-serif font-semibold text-foreground mb-3">Achievements</h3>
              <div className="grid grid-cols-5 gap-2">
                {badges.map((b, i) => (
                  <motion.div key={b.label} className={`relative flex flex-col items-center p-2 rounded-lg ${b.unlocked ? "bg-gold/10" : "bg-muted/50 opacity-40"}`}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: b.unlocked ? 1 : 0.4, scale: 1 }} transition={{ delay: i * 0.1 }} title={b.label}>
                    <b.icon className={`w-5 h-5 ${b.unlocked ? "text-gold" : "text-muted-foreground"}`} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ===== MATERIAL VIEWER MODAL ===== */}
      <AnimatePresence>
        {viewMat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setViewMat(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-border">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-serif font-semibold text-foreground ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>{viewMat.title}</h3>
                  <button onClick={() => setViewMat(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Viewing as: {store.CATEGORY_LABELS[studentCategory]}</p>
                <div className="flex gap-2">
                  {(["written", "audio", "video"] as store.MaterialFormat[]).map(f => (
                    <button key={f} onClick={() => setViewFormat(f)}
                      className={`text-xs px-3 py-1.5 rounded-full capitalize flex items-center gap-1 ${viewFormat === f ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground"
                        }`}>
                      {React.createElement(formatIcon(f), { className: "w-3 h-3" })} {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[55vh]">
                <pre className={`font-sans text-foreground whitespace-pre-wrap leading-relaxed ${fontClass}`}>
                  {viewMat.convertedVersions[studentCategory]?.[viewFormat] || viewMat.writtenContent}
                </pre>
              </div>
              <div className="p-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">♿ Adapted for {store.CATEGORY_LABELS[studentCategory]}</span>
                {viewFormat === "audio" && (
                  <button
                    onClick={() => playTextAudio(viewMat.convertedVersions[studentCategory]?.[viewFormat] || viewMat.writtenContent)}
                    className={`text-xs px-4 py-2 rounded-lg flex items-center gap-1 ${isPlayingAudio ? 'bg-gold text-white animate-pulse' : 'bg-primary text-primary-foreground'}`}>
                    {isPlayingAudio ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3" />}
                    {isPlayingAudio ? 'Stop Audio' : 'Play Audio'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TEST TAKING MODAL ===== */}
      <AnimatePresence>
        {activeTest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${studentCategory === 'autism' ? 'bg-background' : 'bg-foreground/40'}`} onClick={() => setActiveTest(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className={`bg-card rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border ${studentCategory === 'intellectual' || studentCategory === 'motor' ? 'max-w-3xl' : 'max-w-2xl'} ${studentCategory === 'autism' ? 'border-border/50 bg-muted/20 shadow-none' : 'shadow-xl border-border'}`}>

              <div className="p-6 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-serif font-semibold text-foreground ${studentCategory === 'intellectual' ? 'text-2xl' : 'text-lg'}`}>{activeTest.title}</h3>
                    <p className={`text-muted-foreground mt-1 ${studentCategory === 'intellectual' ? 'text-base' : 'text-xs'}`}>
                      Adapted for: {store.CATEGORY_LABELS[studentCategory]} · Method: {testMethod}
                      {activeTest.timeLimit > 0 && ` · ${activeTest.timeLimit} min`}
                    </p>
                  </div>
                  <button onClick={() => setActiveTest(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {testSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                    <h3 className={`font-serif font-bold text-foreground ${studentCategory === 'intellectual' ? 'text-3xl' : 'text-xl'}`}>Test Submitted!</h3>
                    <div className="text-4xl font-mono font-bold text-success mt-4">{testScore}%</div>
                    <p className="text-muted-foreground mt-2">Submitted via {testMethod} method</p>
                    <button onClick={() => setActiveTest(null)} className={`mt-6 font-semibold rounded-lg bg-primary text-primary-foreground ${studentCategory === 'intellectual' ? 'px-8 py-3 text-lg' : 'px-6 py-2 text-sm'}`}>Done</button>
                  </div>
                ) : (
                  <>
                    {(activeTest.convertedTests?.[studentCategory] || activeTest.questions).map((q: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border">
                        <pre className={`font-sans text-foreground whitespace-pre-wrap mb-3 ${fontClass}`}>{q.question}</pre>

                        {/* Recording button with real API integration */}
                        {testMethod === "audio" && (
                          <div className="flex items-center gap-3 mb-2">
                            <button
                              onClick={() => (recording ? stopRecording() : startRecording())}
                              disabled={analyzeSpeechMutation.isPending}
                              className={`px-3 py-2 rounded-lg text-xs flex items-center gap-1 ${recording
                                ? "bg-destructive text-destructive-foreground"
                                : analyzeSpeechMutation.isPending
                                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                                  : "bg-primary/10 text-primary"
                                }`}>
                              {analyzeSpeechMutation.isPending ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
                              ) : recording ? (
                                <><Square className="w-3 h-3" /> Stop (0:{recordingTime.toString().padStart(2, "0")})</>
                              ) : (
                                <><Mic className="w-3 h-3" /> Record Answer</>
                              )}
                            </button>
                            {recording && (
                              <div className="flex items-end gap-0.5 h-4">
                                {[...Array(8)].map((_, j) => (
                                  <motion.div key={j} className="w-0.5 rounded-full bg-primary" animate={{ height: [3, Math.random() * 14 + 3, 3] }}
                                    transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.05 }} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {q.type === "multiple_choice" && q.options ? (
                          <div className="space-y-3 mt-4">
                            {q.options.filter(Boolean).map((opt: string, oi: number) => (
                              <button key={oi} onClick={() => setTestAnswers({ ...testAnswers, [q.id]: opt })}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${testAnswers[q.id] === opt ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary" : "border-border hover:bg-muted/50 text-foreground"
                                  } ${prefs.fontSize === "xlarge" || studentCategory === 'intellectual' || studentCategory === 'motor' ? "text-lg p-5" : "text-sm"} ${studentCategory === 'dyslexia' ? 'font-dyslexic tracking-wide leading-relaxed' : ''}`}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <textarea className={`w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground min-h-[100px] mt-4 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 ${fontClass} ${studentCategory === 'dyslexia' ? 'font-dyslexic tracking-wide leading-relaxed' : ''}`}
                            placeholder={testMethod === "audio" ? "Your spoken answer will appear here..." : "Type your answer..."}
                            value={testAnswers[q.id] || ""} onChange={e => setTestAnswers({ ...testAnswers, [q.id]: e.target.value })} />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
              {!testSubmitted && (
                <div className="p-4 border-t border-border flex justify-end gap-3 flex-shrink-0 bg-muted/10">
                  <button onClick={() => setActiveTest(null)} className={`rounded-lg bg-muted text-foreground hover:bg-muted/80 font-semibold transition-colors ${studentCategory === 'motor' || studentCategory === 'intellectual' ? 'text-lg py-3 px-6' : 'text-sm px-4 py-2'}`}>Cancel</button>
                  <button onClick={submitTest} className={`rounded-lg font-semibold transition-colors flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 ${studentCategory === 'motor' || studentCategory === 'intellectual' ? 'text-lg py-3 px-8' : 'text-sm px-6 py-2'}`}>
                    {studentCategory !== 'adhd' && <Send className="w-4 h-4" />} Submit Test
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ASSIGNMENT WORK MODAL ===== */}
      <AnimatePresence>
        {activeAssignment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${studentCategory === 'autism' ? 'bg-background' : 'bg-foreground/40'}`} onClick={() => setActiveAssignment(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className={`bg-card rounded-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border ${studentCategory === 'intellectual' || studentCategory === 'motor' ? 'max-w-2xl' : 'max-w-lg'} ${studentCategory === 'autism' ? 'border-border/50 bg-muted/20 shadow-none' : 'shadow-xl border-border'}`}>

              <div className="p-6 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className={`font-serif font-semibold text-foreground ${studentCategory === 'intellectual' ? 'text-2xl' : 'text-lg'}`}>
                    {activeAssignment.title}
                  </h3>
                  <button onClick={() => setActiveAssignment(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                {activeAssignment.instructions && (
                  <div className={`mt-3 flex items-start gap-2 ${studentCategory === 'adhd' ? 'opacity-90' : ''}`}>
                    {studentCategory !== 'adhd' && <span className="text-xl">📝</span>}
                    <p className={`text-muted-foreground italic ${studentCategory === 'intellectual' ? 'text-lg' : 'text-sm'}`}>
                      {studentCategory === 'autism' ? activeAssignment.instructions.replace(/[A-Z]+!/g, '') : activeAssignment.instructions}
                    </p>
                  </div>
                )}
                {studentCategory === 'dyslexia' && (
                  <div className="mt-3">
                    <button onClick={() => playTextAudio(activeAssignment.instructions || activeAssignment.title)} className="text-xs flex items-center gap-1 text-primary hover:underline">
                      <Volume2 className="w-4 h-4" /> Read Instructions Aloud
                    </button>
                  </div>
                )}
                <div className="mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Adapted for {store.CATEGORY_LABELS[studentCategory]}</span>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Voice Dictation */}
                {['visual', 'motor', 'dyslexia', 'speech'].includes(studentCategory) && (
                  <div className={`p-4 rounded-xl border border-border ${studentCategory === 'autism' ? 'bg-background' : 'bg-muted/30'}`}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Dictation Input (Recommended)</label>
                    <button
                      onClick={() => (recording ? stopRecording() : startRecording())}
                      disabled={analyzeSpeechMutation.isPending}
                      className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors ${recording
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : analyzeSpeechMutation.isPending
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                        } ${studentCategory === 'motor' ? 'py-5 text-lg' : 'text-sm'}`}>
                      {analyzeSpeechMutation.isPending ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Transcribing...</>
                      ) : recording ? (
                        <><Square className="w-5 h-5" /> Stop Dictating</>
                      ) : (
                        <><Mic className="w-5 h-5" /> Start Dictating</>
                      )}
                    </button>
                    {studentCategory === 'speech' && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">Take your time. Stammer-friendly mode active — pauses are ignored.</p>
                    )}
                  </div>
                )}

                {/* Video Upload */}
                {studentCategory === 'hearing' && (
                  <div className="p-4 rounded-xl border border-border bg-muted/30">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">ISL Sign Language Video Submission</label>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 rounded-xl bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 flex flex-col items-center justify-center gap-2 border border-indigo-500/20 transition-colors">
                      <FileVideo className="w-6 h-6" />
                      <span className="text-sm font-semibold">Upload Sign Video (.mp4)</span>
                    </button>
                  </div>
                )}

                {/* Text Input */}
                {studentCategory !== 'visual' || responseText.length > 0 ? (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Written Response</label>
                    <textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                      placeholder={recording ? "Listening..." : "Type your response..."}
                      className={`w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground min-h-[160px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 ${fontClass} ${studentCategory === 'dyslexia' ? 'font-dyslexic tracking-wide leading-relaxed' : ''}`} />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground opacity-60">
                    <Mic2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Response will appear here after dictation.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border flex justify-end gap-3 flex-shrink-0 bg-muted/10">
                <button onClick={() => setActiveAssignment(null)} className={`rounded-lg bg-muted text-foreground hover:bg-muted/80 font-semibold transition-colors ${studentCategory === 'motor' || studentCategory === 'intellectual' ? 'text-lg py-3 px-6' : 'text-sm px-4 py-2'}`}>Cancel</button>
                <button onClick={submitAssignment} disabled={!responseText.trim() && studentCategory !== 'hearing'}
                  className={`rounded-lg font-semibold transition-colors flex items-center gap-2 ${!responseText.trim() && studentCategory !== 'hearing' ? "bg-primary/40 text-primary-foreground/50 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"} ${studentCategory === 'motor' || studentCategory === 'intellectual' ? 'text-lg py-3 px-8' : 'text-sm px-6 py-2'}`}>
                  {studentCategory !== 'adhd' && <Send className="w-4 h-4" />} Submit
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SIGN LANGUAGE EVALUATION MODAL ===== */}
      {
        showVideoEvalModal && videoEvaluation && (
          <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeVideoEvalModal(); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-background rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-border">
              <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                <h3 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Sign Language Evaluated
                </h3>
                <button onClick={closeVideoEvalModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Score ring */}
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-indigo-100 dark:border-indigo-900">
                    <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{videoEvaluation.score}</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground font-semibold">Gemini Normalized Score</div>
                </div>

                {/* Transcript */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Translated Transcript</h4>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm text-foreground">
                    {videoEvaluation.transcript}
                  </div>
                </div>

                {/* Feedback */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Teacher's Feedback</h4>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
                    {videoEvaluation.feedback}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/10">
                <button onClick={closeVideoEvalModal} className="text-sm px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
                  Awesome! Close
                </button>
              </div>
            </motion.div>
          </div>
        )
      }

    </div >
  );
}
