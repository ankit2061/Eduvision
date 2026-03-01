import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Users, BarChart3, Settings, Bell, Search,
  Plus, ChevronDown, FileText, Sparkles,
  GraduationCap, Layers, Download, Home, Trash2, Edit,
  Eye, Mic, Hand, Ear, Brain, Accessibility, MessageSquare,
  Volume2, Type, Image, Video, Music, CheckCircle2, Clock,
  X, Save, Copy, Play, Send, CalendarDays, UserCheck, UsersRound,
  Radio, MonitorPlay, PenLine, ListChecks, Settings2,
  Headphones, FileVideo, FileAudio, FileType, LogOut, Loader2, AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { MarkdownText } from "@/components/MarkdownText";
import { ProfileMenu } from "@/components/ProfileMenu";
import * as store from "@/lib/store";
import {
  useMe,
  useLessonLibrary,
  useClassInsights,
  useAssignLesson,
  useLesson,
  useTranscribeMedia,
  useUpdateLesson,
  useClassStudents,
  useTeacherSubmissions,
  useNormalizeScore,
  useReviewAssignment,
  useCreateTest,
  useAssignTest,
  useGenerateAdaptiveMaterial,
  type TeacherSubmissionInfo,
  type NormalizeScoreResult,
  type LessonSummary as ApiLessonSummary,
  type ClassInsights,
  logEvent,
  useToken,
} from "@/lib/api";

// Category data
const categories: { id: store.DisabilityCategory; label: string; icon: typeof Mic; color: string }[] = [
  { id: "speech", label: "Speech & Stammer", icon: Mic, color: "from-primary to-indigo-light" },
  { id: "dyslexia", label: "Dyslexia & Reading", icon: Type, color: "from-accent to-gold" },
  { id: "hearing", label: "Hearing Impairment", icon: Ear, color: "from-success to-emerald-400" },
  { id: "aac", label: "AAC & Non-Verbal", icon: MessageSquare, color: "from-primary to-blue-400" },
  { id: "visual", label: "Visual Impairment", icon: Eye, color: "from-amber-500 to-orange-400" },
  { id: "autism", label: "Autism & Social", icon: Brain, color: "from-purple-500 to-pink-400" },
  { id: "motor", label: "Motor & Physical", icon: Hand, color: "from-teal-500 to-cyan-400" },
  { id: "general", label: "General Inclusive", icon: Accessibility, color: "from-indigo-light to-primary" },
];

const students = [
  { name: "Aarav S.", category: "speech" as store.DisabilityCategory, progress: 78, streak: 12 },
  { name: "Priya M.", category: "dyslexia" as store.DisabilityCategory, progress: 85, streak: 8 },
  { name: "Ravi K.", category: "aac" as store.DisabilityCategory, progress: 62, streak: 5 },
  { name: "Neha D.", category: "hearing" as store.DisabilityCategory, progress: 91, streak: 15 },
  { name: "Sita R.", category: "autism" as store.DisabilityCategory, progress: 73, streak: 9 },
  { name: "Kiran P.", category: "visual" as store.DisabilityCategory, progress: 68, streak: 6 },
];

type Tab = "materials" | "tests" | "live" | "assignments" | "settings";

const navItems: { icon: typeof Home; label: string; tab?: Tab; href?: string }[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: BookOpen, label: "Materials", tab: "materials" },
  { icon: ListChecks, label: "Tests", tab: "tests" },
  { icon: Radio, label: "Live Class", tab: "live" },
  { icon: Send, label: "Assignments", tab: "assignments" },
  { icon: Settings2, label: "Settings", tab: "settings" },
];

export default function TeacherDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("materials");
  const [searchQuery, setSearchQuery] = useState("");
  const [teacherProfile, setTeacherProfile] = useState(store.getTeacherProfile());

  // ── Auth ──
  const { user, logout } = useAuth();
  const { data: meData } = useMe();

  // ── API: Lesson library + class insights ──
  const { data: apiLessons, isLoading: lessonsLoading, error: lessonsError } = useLessonLibrary();
  const { data: classInsights } = useClassInsights();
  const assignLessonMutation = useAssignLesson();
  const getToken = useToken();

  const classId = classInsights?.class_id || "default_class";
  const { data: classStudentsData } = useClassStudents(classId);
  const realStudents = classStudentsData || [];

  // Media Recording
  const [recordingField, setRecordingField] = useState<"matTitle" | "matTopic" | "matGrade" | "matContent" | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const transcribeMutation = useTranscribeMedia();

  const startRecording = async (field: "matTitle" | "matTopic" | "matGrade" | "matContent") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setRecordingField(field);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingField) {
      const field = recordingField;
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
        setRecordingField(null);

        try {
          const res = await transcribeMutation.mutateAsync({ audioBlob, audioFilename: "teacher_audio.webm" });
          if (res.transcript) {
            if (field === "matTitle") setMatTitle(prev => prev ? prev + " " + res.transcript : res.transcript);
            if (field === "matTopic") setMatTopic(prev => prev ? prev + " " + res.transcript : res.transcript);
            if (field === "matGrade") setMatGrade(prev => prev ? prev + " " + res.transcript : res.transcript);
            if (field === "matContent") setMatContent(prev => prev ? prev + "\n\n" + res.transcript : res.transcript);
          }
        } catch (err) {
          console.error("Transcription failed", err);
        }
      };
      mediaRecorderRef.current.stop();
    }
  };

  // Materials
  const [materials, setMaterials] = useState<store.Material[]>([]);
  const [matTitle, setMatTitle] = useState("");
  const [matTopic, setMatTopic] = useState("");
  const [matGrade, setMatGrade] = useState("");
  const [matFormat, setMatFormat] = useState<store.MaterialFormat>("written");
  const [matContent, setMatContent] = useState("");
  const [matCategory, setMatCategory] = useState<store.DisabilityCategory>("general");
  const [generating, setGenerating] = useState(false);
  const [previewMat, setPreviewMat] = useState<store.Material | null>(null);
  const [previewCat, setPreviewCat] = useState<store.DisabilityCategory>("general");
  const [previewFormat, setPreviewFormat] = useState<store.MaterialFormat>("written");

  // Tests
  const [tests, setTests] = useState<store.Test[]>([]);
  const [testTitle, setTestTitle] = useState("");
  const [testTopic, setTestTopic] = useState("");
  const [testGrade, setTestGrade] = useState("");
  const [testTimeLimit, setTestTimeLimit] = useState(15);
  const [testQuestions, setTestQuestions] = useState<store.TestQuestion[]>([
    { id: "q1", question: "", type: "multiple_choice", options: ["", "", "", ""], correctAnswer: "" },
  ]);
  const [creatingTest, setCreatingTest] = useState(false);
  const [previewTest, setPreviewTest] = useState<store.Test | null>(null);
  const [previewTestCat, setPreviewTestCat] = useState<store.DisabilityCategory>("general");

  // Live classes
  const [liveClasses, setLiveClasses] = useState<store.LiveClass[]>([]);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveTopic, setLiveTopic] = useState("");
  const [liveGrade, setLiveGrade] = useState("");
  const [activeLive, setActiveLive] = useState<store.LiveClass | null>(null);
  const [chatInput, setChatInput] = useState("");

  // Assignments
  const [assignments, setAssignments] = useState<store.Assignment[]>([]);
  const [assignModal, setAssignModal] = useState<{ type: "material" | "test"; id: string; title: string } | null>(null);
  const [assignTo, setAssignTo] = useState<"class" | "student">("class");
  const [assignStudent, setAssignStudent] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignCategory, setAssignCategory] = useState<store.DisabilityCategory>("general");

  // Submissions
  const [submissions, setSubmissions] = useState<store.TestSubmission[]>([]);
  const { data: apiSubmissions = [], isLoading: apiSubmissionsLoading } = useTeacherSubmissions();
  const normalizeMutation = useNormalizeScore();
  const reviewMutation = useReviewAssignment();
  const createTestMutation = useCreateTest();
  const assignTestMutation = useAssignTest();
  const adaptiveMutation = useGenerateAdaptiveMaterial();

  const [activeSubmission, setActiveSubmission] = useState<TeacherSubmissionInfo | null>(null);
  const [submissionTab, setSubmissionTab] = useState<"assigned" | "evaluate">("assigned");
  const [normalizationResult, setNormalizationResult] = useState<NormalizeScoreResult | null>(null);
  const [reviewScore, setReviewScore] = useState<number | "">("");
  const [reviewFeedback, setReviewFeedback] = useState("");

  useEffect(() => {
    // Local store still used for Tests, Live Classes, Assignments (not yet API-backed)
    setTests(store.getTests());
    setLiveClasses(store.getLiveClasses());
    setAssignments(store.getAssignments());
    setSubmissions(store.getSubmissions());
    // Materials now come from API (useLessonLibrary)
  }, []);

  const refresh = () => {
    setTests(store.getTests());
    setLiveClasses(store.getLiveClasses());
    setAssignments(store.getAssignments());
    setSubmissions(store.getSubmissions());
  };

  // Font size for teacher accessibility
  const fontClass = teacherProfile.accessibilityPrefs.fontSize === "xlarge" ? "text-lg" :
    teacherProfile.accessibilityPrefs.fontSize === "large" ? "text-base" : "text-sm";
  const highContrast = teacherProfile.accessibilityPrefs.highContrast;

  // Lesson Preview
  const [previewLessonId, setPreviewLessonId] = useState<string | null>(null);
  const [previewLessonCat, setPreviewLessonCat] = useState<store.DisabilityCategory>("adhd");
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null);
  const [editTierContent, setEditTierContent] = useState<string>("");
  const updateLessonMutation = useUpdateLesson();
  const { data: previewLessonData, isLoading: previewLessonLoading } = useLesson(previewLessonId || "");

  const parsedContent = useMemo(() => {
    if (!previewLessonData?.content_json) return null;
    try {
      return typeof previewLessonData.content_json === "string"
        ? JSON.parse(previewLessonData.content_json)
        : previewLessonData.content_json;
    } catch (err) {
      console.error("Failed to parse lesson content json", err);
      return null;
    }
  }, [previewLessonData]);

  const handleSaveTier = async (tierIdx: number) => {
    if (!previewLessonData || !previewLessonData.content_json) return;
    try {
      const parsed = typeof previewLessonData.content_json === "string"
        ? JSON.parse(previewLessonData.content_json)
        : previewLessonData.content_json;

      const newTiers = [...(parsed.tiers || [])];
      newTiers[tierIdx] = { ...newTiers[tierIdx], passage: editTierContent };
      const updatedContent = { ...parsed, tiers: newTiers };

      await updateLessonMutation.mutateAsync({ lessonId: previewLessonData.lesson_id, content_json: updatedContent });
      setEditingTierIdx(null);
    } catch (err) {
      console.error("Failed to save tier", err);
    }
  };

  // Safe helper to parse DB content
  const previewLessonTiers = useMemo(() => {
    if (!parsedContent) return [];

    if (parsedContent.is_adaptive && parsedContent.adaptive_versions) {
      const version = parsedContent.adaptive_versions[previewLessonCat] || parsedContent.adaptive_versions["general"];
      if (!version) return [];
      // Map the version object into a single "tier" for the existing UI loop
      return [{
        level: "Adaptive",
        label: store.CATEGORY_LABELS[previewLessonCat] || previewLessonCat,
        passage: version.passage || "",
        questions: version.questions || [],
        version_data: version // Pass the whole object for rich rendering extras
      }];
    }
    return parsedContent?.tiers || [];
  }, [parsedContent, previewLessonCat]);

  // ============ MATERIAL HANDLER (Adaptive & Audio-enabled) ============
  const handleCreateMaterial = useCallback(async () => {
    if (!matTitle.trim() || !matContent.trim()) return;
    setGenerating(true);
    try {
      const res = await adaptiveMutation.mutateAsync({
        topic: matTitle,
        grade: matGrade || "General",
        description: `Subject: ${matTopic}\n\n${matContent}`,
        generate_audio: true,
      });
      // Log creation event for analytics
      try {
        const tok = await getToken();
        await logEvent("adaptive_material_created", {
          topic: matTitle,
          grade: matGrade,
          lesson_id: res.lesson_id
        }, tok);
      } catch { }
      setMatTitle(""); setMatTopic(""); setMatGrade(""); setMatContent("");
    } catch (err) {
      console.error("Adaptive material generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [matTitle, matTopic, matGrade, matContent, adaptiveMutation, getToken]);

  // ============ TEST HANDLERS ============
  const addQuestion = () => {
    setTestQuestions(prev => [...prev, {
      id: `q${prev.length + 1}`,
      question: "",
      type: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
    }]);
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    setTestQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setTestQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...(q.options || [])];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const handleCreateTest = async () => {
    if (!testTitle.trim() || testQuestions.every(q => !q.question.trim())) return;
    setCreatingTest(true);

    try {
      const validQs = testQuestions.filter(q => q.question.trim());

      const payload = {
        title: testTitle,
        topic: testTopic,
        grade: testGrade,
        timeLimit: testTimeLimit,
        questions: validQs.map(q => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.type === "multiple_choice" ? q.options : undefined,
          correctAnswer: q.correctAnswer
        }))
      };

      const res = await createTestMutation.mutateAsync(payload);

      // Still add to store so UI updates immediately (for demo backwards comp over assignments)
      const converted = {} as Record<store.DisabilityCategory, store.TestQuestion[]>;
      const cats: store.DisabilityCategory[] = ["speech", "dyslexia", "hearing", "aac", "visual", "autism", "motor", "general"];
      cats.forEach(c => { converted[c] = store.aiConvertTest(validQs, c); });
      const test: store.Test = {
        id: res.test_id, // Use real ID
        title: testTitle,
        topic: testTopic,
        grade: testGrade,
        category: "general",
        questions: validQs,
        timeLimit: testTimeLimit,
        createdAt: new Date().toLocaleDateString(),
        status: "published",
        convertedTests: converted,
      };
      // Keep it in local display so they can still assign it during demo easily
      store.addTest(test);

      setTestTitle(""); setTestTopic(""); setTestGrade("");
      setTestQuestions([{ id: "q1", question: "", type: "multiple_choice", options: ["", "", "", ""], correctAnswer: "" }]);
      refresh();
    } catch (err) {
      console.error("Test creation failed", err);
    } finally {
      setCreatingTest(false);
    }
  };

  // ============ LIVE CLASS HANDLERS ============
  const startLiveClass = () => {
    if (!liveTitle.trim()) return;
    const lc: store.LiveClass = {
      id: Date.now().toString(),
      title: liveTitle,
      topic: liveTopic,
      grade: liveGrade,
      status: "live",
      scheduledAt: new Date().toISOString(),
      chatMessages: [{ sender: "System", message: "Live class started! Welcome everyone. 🎉", time: new Date().toLocaleTimeString() }],
      transcript: `[Live transcript] Welcome to "${liveTitle}". Today we will cover ${liveTopic || liveTitle}...`,
      signLanguageEnabled: true,
      captionsEnabled: true,
      audioDescriptionEnabled: true,
    };
    store.addLiveClass(lc);
    setActiveLive(lc);
    setLiveTitle(""); setLiveTopic(""); setLiveGrade("");
    refresh();
  };

  const sendChat = () => {
    if (!chatInput.trim() || !activeLive) return;
    const msg = { sender: teacherProfile.name, message: chatInput, time: new Date().toLocaleTimeString() };
    const updated = { ...activeLive, chatMessages: [...activeLive.chatMessages, msg] };
    store.updateLiveClass(activeLive.id, { chatMessages: updated.chatMessages });
    setActiveLive(updated);
    setChatInput("");

    // Simulate student response
    setTimeout(() => {
      const responses = ["Great explanation! 👍", "Can you repeat that?", "I understand now!", "Could you give an example?", "🤟 Got it! (sign)"];
      const studentMsg = { sender: students[Math.floor(Math.random() * students.length)].name, message: responses[Math.floor(Math.random() * responses.length)], time: new Date().toLocaleTimeString() };
      const updated2 = { ...updated, chatMessages: [...updated.chatMessages, studentMsg] };
      store.updateLiveClass(activeLive.id, { chatMessages: updated2.chatMessages });
      setActiveLive(updated2);
    }, 1500);
  };

  const endLiveClass = () => {
    if (!activeLive) return;
    store.updateLiveClass(activeLive.id, { status: "ended" });
    setActiveLive(null);
    refresh();
  };

  // ============ ASSIGN HANDLER (API for lessons, localStorage for tests) ============
  const handleAssign = async () => {
    if (!assignModal) return;

    // Save to localStorage for both types so Student Dashboard works for demo
    let studentNameToSave = "class";
    if (assignTo === "student") {
      const selectedStudent = realStudents?.find((s: any) => s.student_id === assignStudent);
      studentNameToSave = selectedStudent?.name || assignStudent;
    }

    const a: store.Assignment = {
      id: Date.now().toString(),
      materialId: assignModal.type === "material" ? assignModal.id : undefined,
      testId: assignModal.type === "test" ? assignModal.id : undefined,
      type: assignModal.type,
      title: assignModal.title,
      category: assignCategory,
      assignedTo: studentNameToSave,
      dueDate: assignDue,
      instructions: assignInstructions,
      assignedDate: new Date().toLocaleDateString(),
      status: "pending",
    };
    store.addAssignment(a);
    refresh();

    if (assignModal.type === "material") {
      try {
        await assignLessonMutation.mutateAsync({
          lessonId: assignModal.id,
          class_id: assignTo === "class" ? classId : assignStudent,
          due_date: assignDue || undefined,
          mode: "read-aloud",
        });
      } catch (err) {
        console.error("Assign lesson failed:", err);
      }
    } else if (assignModal.type === "test") {
      try {
        await assignTestMutation.mutateAsync({
          testId: assignModal.id,
          class_id: assignTo === "class" ? classId : assignStudent,
          due_date: assignDue || undefined,
        });
      } catch (err) {
        console.error("Assign test failed:", err);
      }
    }

    setAssignModal(null);
    setAssignTo("class"); setAssignStudent(""); setAssignDue(""); setAssignInstructions("");
  };

  // Save teacher profile
  const saveProfile = (p: store.TeacherProfile) => {
    store.saveTeacherProfile(p);
    setTeacherProfile(p);
  };

  const formatIcon = (f: store.MaterialFormat) =>
    f === "audio" ? FileAudio : f === "video" ? FileVideo : FileType;

  return (
    <div className={`flex min-h-screen bg-background ${highContrast ? "contrast-more" : ""}`}>
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 64 }}
        className="bg-sidebar border-r border-sidebar-border flex flex-col relative overflow-hidden flex-shrink-0"
      >
        <div className="p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          {sidebarOpen && <span className="font-serif font-bold text-sidebar-foreground">EduVoice</span>}
        </div>

        <div className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            item.href ? (
              <Link key={item.label} to={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans text-sidebar-foreground/60 hover:bg-sidebar-accent/50"
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            ) : (
              <button key={item.label} onClick={() => setActiveTab(item.tab!)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-colors ${activeTab === item.tab ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50"
                  }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          ))}
        </div>
      </motion.aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-muted"><Layers className="w-4 h-4 text-muted-foreground" /></button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input className="pl-9 pr-4 py-2 rounded-lg bg-muted border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
                placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {teacherProfile.isSpeciallyAbled && (
              <span className="text-xs font-sans px-2 py-1 rounded-full bg-gold/10 text-gold flex items-center gap-1">
                <Accessibility className="w-3 h-3" /> Accessible Mode
              </span>
            )}
            <button className="relative p-2 rounded-lg hover:bg-muted"><Bell className="w-4 h-4 text-muted-foreground" /><span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" /></button>

            <ProfileMenu>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
                <span className="text-xs font-bold text-primary">{(meData?.name?.[0] || user?.name?.[0] || "T").toUpperCase()}</span>
              </div>
            </ProfileMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className={`font-serif font-bold text-foreground ${fontClass === "text-lg" ? "text-3xl" : fontClass === "text-base" ? "text-2xl" : "text-2xl"}`}>
                Teacher Dashboard
              </h1>
              <p className={`font-sans text-muted-foreground mt-1 ${fontClass}`}>
                Create accessible materials, tests, and live classes for all learners
              </p>

            </div>

            {/* ===== TAB: MATERIALS ===== */}
            {activeTab === "materials" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid lg:grid-cols-5 gap-6">
                  {/* Creator */}
                  <div className="lg:col-span-2 layer-fg p-6 border border-border">
                    <div className="flex items-center gap-2 mb-5">
                      <Sparkles className="w-5 h-5 text-gold" />
                      <h2 className={`font-serif font-semibold text-foreground ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>Create Material</h2>
                    </div>
                    <p className="text-xs font-sans text-muted-foreground mb-4">
                      Create in any format — AI will auto-convert to all accessibility formats for every student type
                    </p>

                    <div className="space-y-4">
                      {/* Title */}
                      <div className="p-4 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-serif font-bold text-foreground">Title *</label>
                          <button onClick={recordingField === "matTitle" ? stopRecording : () => startRecording("matTitle")}
                            disabled={recordingField !== null && recordingField !== "matTitle"}
                            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${recordingField === "matTitle" ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"}`}>
                            <Mic className="w-3.5 h-3.5" /> {recordingField === "matTitle" ? "Stop Recording" : "Use Audio"}
                          </button>
                        </div>
                        <input className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g., Photosynthesis Explained" value={matTitle} onChange={e => setMatTitle(e.target.value)} />
                      </div>

                      {/* Topic */}
                      <div className="p-4 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-serif font-bold text-foreground">Topic</label>
                          <button onClick={recordingField === "matTopic" ? stopRecording : () => startRecording("matTopic")}
                            disabled={recordingField !== null && recordingField !== "matTopic"}
                            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${recordingField === "matTopic" ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"}`}>
                            <Mic className="w-3.5 h-3.5" /> {recordingField === "matTopic" ? "Stop Recording" : "Use Audio"}
                          </button>
                        </div>
                        <input className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g., Science" value={matTopic} onChange={e => setMatTopic(e.target.value)} />
                      </div>

                      {/* Grade */}
                      <div className="p-4 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-serif font-bold text-foreground">Grade</label>
                          <button onClick={recordingField === "matGrade" ? stopRecording : () => startRecording("matGrade")}
                            disabled={recordingField !== null && recordingField !== "matGrade"}
                            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${recordingField === "matGrade" ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"}`}>
                            <Mic className="w-3.5 h-3.5" /> {recordingField === "matGrade" ? "Stop Recording" : "Use Audio"}
                          </button>
                        </div>
                        <input className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g., 5th Grade" value={matGrade} onChange={e => setMatGrade(e.target.value)} />
                      </div>

                      {/* Content */}
                      <div className="p-4 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-serif font-bold text-foreground">
                            Content *
                          </label>
                          <button onClick={recordingField === "matContent" ? stopRecording : () => startRecording("matContent")}
                            disabled={recordingField !== null && recordingField !== "matContent"}
                            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${recordingField === "matContent" ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"}`}>
                            <Mic className="w-3.5 h-3.5" /> {recordingField === "matContent" ? "Stop Recording" : "Use Audio"}
                          </button>
                        </div>
                        <textarea className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none"
                          placeholder="Type or dictate the lesson content here..."
                          value={matContent} onChange={e => setMatContent(e.target.value)} />
                      </div>

                      {transcribeMutation.isPending && (
                        <div className="text-xs text-primary flex items-center justify-center gap-2 mb-2 p-2 bg-primary/5 rounded-lg border border-primary/20 animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" /> Processing audio and extracting transcript...
                        </div>
                      )}

                      <motion.button onClick={handleCreateMaterial}
                        disabled={generating || !matTitle.trim() || !matContent.trim()}
                        className={`w-full py-3 rounded-xl font-sans font-semibold text-sm text-primary-foreground transition-all ${generating ? "bg-primary/70" : !matTitle.trim() || !matContent.trim() ? "bg-primary/40 cursor-not-allowed" : "bg-primary btn-glow hover:bg-primary/90"
                          }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        {generating ? (
                          <span className="flex items-center justify-center gap-2">
                            <motion.div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                            Generating 9 Adaptive Versions...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Create & Adapt for All Student Types</span>
                        )}
                      </motion.button>
                      <p className="text-[10px] font-sans text-muted-foreground text-center">
                        🤖 AI will generate accessible versions for all 9 disability categories in written, audio, and visual formats using LangGraph
                      </p>
                    </div>
                  </div>

                  {/* Library — API-backed */}
                  <div className="lg:col-span-3 layer-fg p-6 border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`font-serif font-semibold text-foreground ${fontClass === "text-lg" ? "text-xl" : "text-lg"}`}>Materials Library</h2>
                      <span className="text-xs font-sans text-muted-foreground">
                        {lessonsLoading ? "Loading…" : `${apiLessons?.length ?? 0} lessons`}
                      </span>
                    </div>

                    {lessonsError && (
                      <div className="flex items-center gap-2 text-xs text-destructive mb-3 p-2 rounded-lg bg-destructive/10">
                        <AlertCircle className="w-4 h-4" />
                        Could not load lessons from server. Check your API connection.
                      </div>
                    )}

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {lessonsLoading && (
                        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">Loading library…</span>
                        </div>
                      )}
                      {!lessonsLoading && (apiLessons?.length ?? 0) === 0 && (
                        <div className="text-center py-12 text-muted-foreground text-sm">Create your first lesson — Gemini will generate 3 differentiated tiers! ✨</div>
                      )}
                      {(apiLessons ?? []).map((lesson: ApiLessonSummary) => (
                        <div key={lesson.lesson_id} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-sans font-medium text-foreground truncate">{lesson.topic}</div>
                                <div className="text-xs font-sans text-muted-foreground">{lesson.grade} · {lesson.tiers} tiers · {lesson.created_at.slice(0, 10)}</div>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => setPreviewLessonId(lesson.lesson_id)}
                                className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Preview
                              </button>
                              <button
                                onClick={() => setAssignModal({ type: "material", id: lesson.lesson_id, title: lesson.topic })}
                                className="text-xs px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" /> Assign
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">✓ {lesson.tiers} tiers · API-backed</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== TAB: TESTS ===== */}
            {activeTab === "tests" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Test Creator */}
                  <div className="layer-fg p-6 border border-border">
                    <div className="flex items-center gap-2 mb-5">
                      <ListChecks className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-serif font-semibold text-foreground">Create Test</h2>
                    </div>
                    <p className="text-xs font-sans text-muted-foreground mb-4">
                      Create one test — AI auto-converts for all disability types (speech-based, visual, AAC, etc.)
                    </p>
                    <div className="space-y-3">
                      <input className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Test Title *" value={testTitle} onChange={e => setTestTitle(e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <input className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="Topic" value={testTopic} onChange={e => setTestTopic(e.target.value)} />
                        <input className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="Grade" value={testGrade} onChange={e => setTestGrade(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-sans font-medium text-muted-foreground mb-1 block">Time Limit: {testTimeLimit} min (0 = unlimited)</label>
                        <input type="range" min={0} max={60} step={5} value={testTimeLimit} onChange={e => setTestTimeLimit(Number(e.target.value))}
                          className="w-full accent-primary" />
                      </div>

                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                        {testQuestions.map((q, qi) => (
                          <div key={qi} className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-sans font-semibold text-foreground">Q{qi + 1}</span>
                              <select value={q.type} onChange={e => updateQuestion(qi, "type", e.target.value)}
                                className="text-xs px-2 py-1 rounded bg-muted border border-border text-foreground">
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="written">Written Answer</option>
                                <option value="audio_response">Audio Response</option>
                                <option value="visual_match">Visual Match</option>
                              </select>
                            </div>
                            <textarea className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground min-h-[50px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Type your question..." value={q.question} onChange={e => updateQuestion(qi, "question", e.target.value)} />
                            {q.type === "multiple_choice" && (
                              <div className="space-y-1.5">
                                {q.options?.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <span className="text-xs font-sans text-muted-foreground w-5">{String.fromCharCode(65 + oi)}</span>
                                    <input className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                                      placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                                  </div>
                                ))}
                                <input className="w-full px-3 py-1.5 rounded bg-success/5 border border-success/20 text-sm text-foreground focus:outline-none"
                                  placeholder="Correct answer" value={q.correctAnswer} onChange={e => updateQuestion(qi, "correctAnswer", e.target.value)} />
                              </div>
                            )}
                            {q.type === "written" && (
                              <input className="w-full px-3 py-1.5 rounded bg-success/5 border border-success/20 text-sm text-foreground focus:outline-none"
                                placeholder="Expected answer (for grading)" value={q.correctAnswer} onChange={e => updateQuestion(qi, "correctAnswer", e.target.value)} />
                            )}
                          </div>
                        ))}
                      </div>

                      <button onClick={addQuestion} className="w-full py-2 rounded-lg border border-dashed border-border text-xs font-sans text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Add Question
                      </button>

                      <motion.button onClick={handleCreateTest}
                        disabled={creatingTest || !testTitle.trim()}
                        className={`w-full py-3 rounded-xl font-sans font-semibold text-sm text-primary-foreground transition-all ${creatingTest ? "bg-primary/70" : !testTitle.trim() ? "bg-primary/40 cursor-not-allowed" : "bg-primary btn-glow"
                          }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        {creatingTest ? (
                          <span className="flex items-center justify-center gap-2">
                            <motion.div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                            AI Converting Test...
                          </span>
                        ) : "Create Test & Auto-Convert"}
                      </motion.button>
                    </div>
                  </div>

                  {/* Test library + submissions */}
                  <div className="space-y-6">
                    <div className="layer-fg p-6 border border-border">
                      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Tests Library</h2>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {tests.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No tests created yet</p>}
                        {tests.map(t => (
                          <div key={t.id} className="p-3 rounded-lg border border-border hover:bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-sans font-medium text-foreground">{t.title}</div>
                                <div className="text-xs font-sans text-muted-foreground">{t.questions.length} questions · {t.timeLimit}min · {t.createdAt}</div>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => { setPreviewTest(t); setPreviewTestCat("general"); }}
                                  className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</button>
                                <button onClick={() => setAssignModal({ type: "test", id: t.id, title: t.title })}
                                  className="text-xs px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1"><Send className="w-3 h-3" /> Assign</button>
                                <button onClick={() => { store.deleteTest(t.id); refresh(); }}
                                  className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="layer-fg p-6 border border-border">
                      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Test Submissions</h2>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {submissions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p>}
                        {submissions.map(s => (
                          <div key={s.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                            <div>
                              <div className="text-sm font-sans font-medium text-foreground">{s.studentName}</div>
                              <div className="text-xs font-sans text-muted-foreground">via {s.method} · {s.submittedAt}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {s.score !== undefined ? (
                                <span className="text-sm font-mono font-bold text-success">{s.score}%</span>
                              ) : (
                                <button onClick={() => { store.updateSubmission(s.id, { score: Math.floor(Math.random() * 30) + 70, feedback: "Good work! Keep practicing." }); refresh(); }}
                                  className="text-xs px-2 py-1 rounded bg-success/10 text-success hover:bg-success/20">Grade</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== TAB: LIVE CLASS ===== */}
            {activeTab === "live" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {!activeLive ? (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="layer-fg p-6 border border-border">
                      <div className="flex items-center gap-2 mb-5">
                        <Radio className="w-5 h-5 text-destructive animate-pulse" />
                        <h2 className="text-lg font-serif font-semibold text-foreground">Start Live Class</h2>
                      </div>
                      <p className="text-xs font-sans text-muted-foreground mb-4">
                        Students will receive the class adapted to their accessibility needs (captions, sign language, audio description, etc.)
                      </p>
                      <div className="space-y-3">
                        <input className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="Class Title *" value={liveTitle} onChange={e => setLiveTitle(e.target.value)} />
                        <div className="grid grid-cols-2 gap-3">
                          <input className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Topic" value={liveTopic} onChange={e => setLiveTopic(e.target.value)} />
                          <input className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Grade" value={liveGrade} onChange={e => setLiveGrade(e.target.value)} />
                        </div>
                        <motion.button onClick={startLiveClass} disabled={!liveTitle.trim()}
                          className={`w-full py-3 rounded-xl font-sans font-semibold text-sm text-primary-foreground ${!liveTitle.trim() ? "bg-destructive/40 cursor-not-allowed" : "bg-destructive hover:bg-destructive/90"}`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="flex items-center justify-center gap-2"><Radio className="w-4 h-4" /> Go Live</span>
                        </motion.button>
                      </div>
                    </div>
                    <div className="layer-fg p-6 border border-border">
                      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Past Classes</h2>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {liveClasses.filter(c => c.status === "ended").length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No past classes</p>}
                        {liveClasses.filter(c => c.status === "ended").map(c => (
                          <div key={c.id} className="p-3 rounded-lg border border-border">
                            <div className="text-sm font-sans font-medium text-foreground">{c.title}</div>
                            <div className="text-xs font-sans text-muted-foreground">{c.topic} · {c.chatMessages.length} messages</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="layer-fg p-6 border border-destructive/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <motion.div className="w-3 h-3 rounded-full bg-destructive" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                        <h2 className="text-lg font-serif font-semibold text-foreground">LIVE: {activeLive.title}</h2>
                      </div>
                      <button onClick={endLiveClass} className="text-xs px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-sans">End Class</button>
                    </div>
                    <div className="layer-fg p-6 border border-border mb-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-serif font-semibold text-foreground">My Students</h2>
                      </div>
                      <div className="space-y-3">
                        {realStudents.length === 0 && <p className="text-sm text-muted-foreground">No students in your class yet.</p>}
                        {realStudents.map((s, i) => (
                          <div key={s.student_id || i} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm`}>
                                {(s.name || s.student_id || "Un").substring(0, 4)}
                              </div>
                              <div>
                                <div className="text-sm font-sans font-medium text-foreground">{s.name ? s.name : s.student_id.substring(0, 4)}</div>
                                <div className="text-xs font-sans text-muted-foreground flex items-center gap-1">
                                  {s.accessibility_modes_used[0] || "general"} · {s.session_count} sessions
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-mono font-bold text-foreground">{s.avg_fluency ? `${s.avg_fluency}/10` : '-'}</div>
                              <div className="text-[10px] font-sans text-muted-foreground">Avg Fluency</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="layer-fg p-6 border border-border">
                      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Past Classes</h2>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {liveClasses.filter(c => c.status === "ended").length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No past classes</p>}
                        {liveClasses.filter(c => c.status === "ended").map(c => (
                          <div key={c.id} className="p-3 rounded-lg border border-border">
                            <div className="text-sm font-sans font-medium text-foreground">{c.title}</div>
                            <div className="text-xs font-sans text-muted-foreground">{c.topic} · {c.chatMessages.length} messages</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== TAB: ASSIGNMENTS ===== */}
            {activeTab === "assignments" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="layer-fg p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-serif font-semibold text-foreground">Assignments & Submissions</h2>
                  </div>
                  <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border">
                    <button onClick={() => setSubmissionTab("assigned")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${submissionTab === "assigned" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      Assigned ({assignments.length})
                    </button>
                    <button onClick={() => setSubmissionTab("evaluate")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${submissionTab === "evaluate" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      Submissions ({apiSubmissions.length})
                    </button>
                  </div>
                </div>

                {submissionTab === "assigned" ? (
                  <>
                    {assignments.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        <Send className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p>No assignments yet. Create materials or tests, then assign them.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {assignments.map(a => (
                          <div key={a.id} className="p-4 rounded-lg border border-border hover:bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-sans font-medium text-foreground flex items-center gap-2">
                                  {a.type === "test" ? <ListChecks className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
                                  {a.title}
                                </div>
                                <div className="text-xs font-sans text-muted-foreground mt-1">
                                  {a.type} · {a.assignedTo === "class" ? "Entire Class" : a.assignedTo}
                                  {a.dueDate && ` · Due: ${a.dueDate}`} · assigned {a.assignedDate}
                                </div>
                                {a.instructions && <p className="text-xs text-muted-foreground/70 italic mt-1">"{a.instructions}"</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${a.status === "submitted" ? "bg-success/10 text-success" :
                                  a.status === "reviewed" ? "bg-gold/10 text-gold" :
                                    "bg-muted text-muted-foreground"
                                  }`}>{a.status}</span>
                                <button onClick={() => { store.deleteAssignment(a.id); refresh(); }}
                                  className="text-xs p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {apiSubmissionsLoading ? (
                      <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                        Loading Submissions...
                      </div>
                    ) : apiSubmissions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p>No student submissions to evaluate yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {apiSubmissions.map(s => (
                          <div key={s.assignment_id} className="p-4 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setActiveSubmission(s)}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-sans font-medium text-foreground flex items-center gap-2">
                                  <span className="font-semibold">{s.student_name}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">{s.disability_type}</span>
                                </div>
                                <div className="text-xs font-sans text-muted-foreground mt-1">
                                  {s.topic} ({s.grade}) · Submitted {new Date(s.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {s.raw_score !== null && (
                                  <div className="text-right">
                                    <div className="text-xs text-muted-foreground">Score</div>
                                    <div className={`font-semibold ${s.status === "reviewed" ? "text-gold" : "text-foreground"}`}>{s.raw_score}/100</div>
                                  </div>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${s.status === "reviewed" ? "bg-gold/10 text-gold border border-gold/20" : "bg-success/10 text-success border border-success/20"}`}>
                                  {s.status === "reviewed" ? "Reviewed" : "Needs Review"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ===== TAB: SETTINGS (Teacher Accessibility) ===== */}
            {activeTab === "settings" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
                <div className="layer-fg p-6 border border-border">
                  <div className="flex items-center gap-2 mb-5">
                    <Accessibility className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-serif font-semibold text-foreground">Teacher Accessibility Settings</h2>
                  </div>
                  <p className="text-xs font-sans text-muted-foreground mb-6">
                    If you are a specially-abled teacher, enable accessibility features to teach according to your needs.
                    The same features available to students will be available to you.
                  </p>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <div className="text-sm font-sans font-semibold text-foreground">I am a specially-abled teacher</div>
                        <div className="text-xs text-muted-foreground">Enable accessibility features for the teaching interface</div>
                      </div>
                      <button onClick={() => saveProfile({ ...teacherProfile, isSpeciallyAbled: !teacherProfile.isSpeciallyAbled })}
                        className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 ${teacherProfile.isSpeciallyAbled ? "bg-primary justify-end" : "bg-muted justify-start"
                          }`}>
                        <motion.div layout className="w-5 h-5 rounded-full bg-primary-foreground shadow" />
                      </button>
                    </div>

                    {teacherProfile.isSpeciallyAbled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                        <div>
                          <label className="text-xs font-sans font-medium text-muted-foreground mb-2 block">My Disability / Ability Category</label>
                          <div className="grid grid-cols-2 gap-2">
                            {categories.map(c => (
                              <button key={c.id} onClick={() => {
                                const prefs = store.getDefaultPrefs(c.id);
                                saveProfile({ ...teacherProfile, disability: c.id, accessibilityPrefs: prefs });
                              }}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all ${teacherProfile.disability === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                                  }`}
                              >
                                <div className={`w-6 h-6 rounded bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                                  <c.icon className="w-3 h-3 text-primary-foreground" />
                                </div>
                                <span className="font-sans font-medium text-foreground">{c.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-sm font-sans font-semibold text-foreground">Your Preferences</h3>
                          {([
                            { key: "preferredFormat", label: "Preferred Format", type: "select" },
                            { key: "fontSize", label: "Font Size", type: "select" },
                            { key: "highContrast", label: "High Contrast Mode", type: "toggle" },
                            { key: "screenReader", label: "Screen Reader Optimized", type: "toggle" },
                            { key: "signLanguage", label: "Sign Language Support", type: "toggle" },
                            { key: "simplifiedText", label: "Simplified Text", type: "toggle" },
                            { key: "audioDescription", label: "Audio Descriptions", type: "toggle" },
                            { key: "captionsEnabled", label: "Always Show Captions", type: "toggle" },
                            { key: "switchAccess", label: "Switch / Voice Access", type: "toggle" },
                          ] as const).map(pref => (
                            <div key={pref.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                              <span className="text-xs font-sans text-foreground">{pref.label}</span>
                              {pref.type === "toggle" ? (
                                <button onClick={() => {
                                  const prefs = { ...teacherProfile.accessibilityPrefs, [pref.key]: !(teacherProfile.accessibilityPrefs as any)[pref.key] };
                                  saveProfile({ ...teacherProfile, accessibilityPrefs: prefs });
                                }}
                                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${(teacherProfile.accessibilityPrefs as any)[pref.key] ? "bg-primary justify-end" : "bg-muted justify-start"
                                    }`}>
                                  <motion.div layout className="w-5 h-5 rounded-full bg-primary-foreground shadow" />
                                </button>
                              ) : pref.key === "preferredFormat" ? (
                                <select value={teacherProfile.accessibilityPrefs.preferredFormat}
                                  onChange={e => saveProfile({ ...teacherProfile, accessibilityPrefs: { ...teacherProfile.accessibilityPrefs, preferredFormat: e.target.value as store.MaterialFormat } })}
                                  className="text-xs px-2 py-1 rounded bg-muted border border-border text-foreground">
                                  <option value="written">Written</option>
                                  <option value="audio">Audio</option>
                                  <option value="video">Video</option>
                                </select>
                              ) : (
                                <select value={teacherProfile.accessibilityPrefs.fontSize}
                                  onChange={e => saveProfile({ ...teacherProfile, accessibilityPrefs: { ...teacherProfile.accessibilityPrefs, fontSize: e.target.value as any } })}
                                  className="text-xs px-2 py-1 rounded bg-muted border border-border text-foreground">
                                  <option value="normal">Normal</option>
                                  <option value="large">Large</option>
                                  <option value="xlarge">Extra Large</option>
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </main>
      </div >

      {/* ===== MATERIAL PREVIEW MODAL ===== */}
      <AnimatePresence>
        {
          previewMat && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setPreviewMat(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-border">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-serif font-semibold text-foreground">{previewMat.title}</h3>
                    <button onClick={() => setPreviewMat(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">See how this material appears for each student type in each format</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-xs font-sans text-muted-foreground">Category:</span>
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setPreviewCat(c.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${previewCat === c.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-primary/5"
                          }`}>
                        <c.icon className="w-2.5 h-2.5" /> {c.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs font-sans text-muted-foreground">Format:</span>
                    {(["written", "audio", "video"] as store.MaterialFormat[]).map(f => (
                      <button key={f} onClick={() => setPreviewFormat(f)}
                        className={`text-xs px-3 py-1 rounded-full capitalize ${previewFormat === f ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[55vh]">
                  <pre className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
                    {previewMat.convertedVersions[previewCat]?.[previewFormat] || previewMat.writtenContent}
                  </pre>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* ===== TEST PREVIEW MODAL ===== */}
      <AnimatePresence>
        {
          previewTest && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setPreviewTest(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-border">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-serif font-semibold text-foreground">{previewTest.title}</h3>
                    <button onClick={() => setPreviewTest(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">View as:</span>
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setPreviewTestCat(c.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${previewTestCat === c.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                        <c.icon className="w-2.5 h-2.5" /> {c.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[55vh] space-y-4">
                  {(previewTest.convertedTests[previewTestCat] || previewTest.questions).map((q, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border">
                      <pre className="text-sm font-sans text-foreground whitespace-pre-wrap mb-2">{q.question}</pre>
                      {q.options && (
                        <div className="space-y-1 ml-4">
                          {q.options.map((o, oi) => (
                            <div key={oi} className="text-xs font-sans text-muted-foreground">
                              {String.fromCharCode(65 + oi)}. {o}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-2">Type: {q.type.replace("_", " ")}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* ===== ASSIGN MODAL ===== */}
      <AnimatePresence>
        {
          assignModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl max-w-md w-full border border-border">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> Assign {assignModal.type}</h3>
                    <button onClick={() => setAssignModal(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{assignModal.title}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex gap-2">
                    <button onClick={() => setAssignTo("class")} className={`flex-1 py-2.5 rounded-lg border text-xs font-sans ${assignTo === "class" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-muted-foreground"}`}>
                      <UsersRound className="w-4 h-4 mx-auto mb-1" /> Entire Class
                    </button>
                    <button onClick={() => setAssignTo("student")} className={`flex-1 py-2.5 rounded-lg border text-xs font-sans ${assignTo === "student" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-muted-foreground"}`}>
                      <UserCheck className="w-4 h-4 mx-auto mb-1" /> Specific Student
                    </button>
                  </div>
                  {assignTo === "student" && (
                    <div className="grid grid-cols-2 gap-2">
                      {realStudents.map((s: any) => {
                        const initial = s.name?.[0] || s.student_id?.[0] || "?";
                        const displayName = s.name || `Student ${s.student_id.substring(0, 4)}`;
                        const defaultCategory = (s.accessibility_modes_used?.[0] as store.DisabilityCategory) || "general";

                        return (
                          <button key={s.student_id} onClick={() => { setAssignStudent(s.student_id); setAssignCategory(defaultCategory); }}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${assignStudent === s.student_id ? "border-primary bg-primary/5" : "border-border"}`}>
                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                              {initial.toUpperCase()}
                            </span>
                            <span className="text-foreground">{displayName}</span>
                          </button>
                        );
                      })}
                      {realStudents.length === 0 && (
                        <p className="col-span-2 text-xs text-muted-foreground text-center py-4">No students found in this class.</p>
                      )}
                    </div>
                  )}
                  <input type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none" />
                  <textarea value={assignInstructions} onChange={e => setAssignInstructions(e.target.value)}
                    placeholder="Instructions for students..." className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground min-h-[60px] resize-none focus:outline-none" />
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2">
                  <button onClick={() => setAssignModal(null)} className="text-xs px-4 py-2 rounded-lg bg-muted text-foreground">Cancel</button>
                  <button onClick={handleAssign} disabled={assignTo === "student" && !assignStudent}
                    className={`text-xs px-5 py-2 rounded-lg text-primary-foreground ${assignTo === "student" && !assignStudent ? "bg-primary/40 cursor-not-allowed" : "bg-primary"}`}>
                    <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Assign</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Lesson Preview Modal */}
      {
        previewLessonId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-2xl shadow-xl layer-fg p-6 max-w-3xl w-full border border-border max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                <div>
                  <h3 className="font-serif font-bold text-xl text-foreground">
                    Lesson Preview{previewLessonData ? `: ${previewLessonData.topic}` : ''}
                  </h3>
                  {previewLessonData && (
                    <p className="text-sm text-muted-foreground gap-2 flex mt-1">
                      <span>Grade {previewLessonData.grade}</span> &bull; <span>{parsedContent?.is_adaptive ? "9 Adaptive Versions" : `${previewLessonTiers.length} Tiers`}</span>
                    </p>
                  )}
                </div>
                <button onClick={() => setPreviewLessonId(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>

              {parsedContent?.is_adaptive && (
                <div className="flex flex-wrap gap-2 mb-4 p-2 bg-muted/30 rounded-xl border border-border">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setPreviewLessonCat(c.id)}
                      className={`text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all ${previewLessonCat === c.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      <c.icon className="w-3 h-3" /> {c.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-y-auto flex-1 pr-2 space-y-6">
                {previewLessonLoading && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                    <p>Loading AI-generated lesson content...</p>
                  </div>
                )}

                {previewLessonTiers.map((tier: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-muted/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {tier.level === "Adaptive" ? "✨" : tier.level}
                        </div>
                        <h4 className="font-serif font-semibold text-lg text-foreground">{tier.label}</h4>
                      </div>
                      {editingTierIdx === i ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingTierIdx(null)} className="text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80">Cancel</button>
                          <button onClick={() => handleSaveTier(i)} disabled={updateLessonMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1">
                            {updateLessonMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                          </button>
                        </div>
                      ) : (
                        !tier.version_data && (
                          <button onClick={() => { setEditingTierIdx(i); setEditTierContent(tier.passage); }} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1">
                            <Edit className="w-3 h-3" /> Edit Passage
                          </button>
                        )
                      )}
                    </div>

                    <div className="p-4 bg-background border border-border rounded-lg shadow-sm">
                      {editingTierIdx === i ? (
                        <textarea className="w-full min-h-[150px] p-2 text-sm font-sans bg-transparent border-none resize-none focus:outline-none focus:ring-0 leading-relaxed"
                          value={editTierContent}
                          onChange={(e) => setEditTierContent(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <MarkdownText
                          content={tier.passage}
                          className="text-sm font-sans whitespace-pre-wrap leading-relaxed"
                        />
                      )}
                    </div>

                    {/* Rich Rendering Extras for Adaptive Versions */}
                    {tier.version_data && (
                      <div className="space-y-4 pt-2">
                        {tier.version_data.key_concepts?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {tier.version_data.key_concepts.map((c: string, ki: number) => (
                              <span key={ki} className="text-xs px-2 py-1 rounded bg-primary/5 border border-primary/10 text-primary">{c}</span>
                            ))}
                          </div>
                        )}
                        {tier.version_data.summary && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs italic text-foreground">
                            <strong>Summary:</strong> {tier.version_data.summary}
                          </div>
                        )}
                        {tier.version_data.diagram_descriptions?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Diagram Descriptions</p>
                            {tier.version_data.diagram_descriptions.map((d: any, di: number) => (
                              <div key={di} className="p-3 rounded-lg border-2 border-dashed border-primary/20 bg-primary/5">
                                <p className="text-xs font-bold text-primary mb-1">{d.concept}</p>
                                <p className="text-[11px] text-foreground">{d.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {tier.questions && tier.questions.length > 0 && (
                      <div className="ml-4 space-y-2 mt-4">
                        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comprehension Questions</h5>
                        <ul className="list-disc ml-4 space-y-1">
                          {tier.questions.map((q: string, qidx: number) => (
                            <li key={qidx} className="text-sm text-foreground">{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )
      }

      {/* ===== EVALUATE SUBMISSION MODAL ===== */}
      <AnimatePresence>
        {activeSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl shadow-xl layer-fg p-0 max-w-2xl w-full border border-border max-h-[90vh] overflow-hidden flex flex-col">

              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                <div>
                  <h3 className="font-serif font-bold text-xl text-foreground flex items-center gap-2">
                    Review Submission
                  </h3>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{activeSubmission.student_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">{activeSubmission.disability_type}</span>
                    <span>&bull;</span>
                    <span>{activeSubmission.topic}</span>
                  </div>
                </div>
                <button onClick={() => { setActiveSubmission(null); setNormalizationResult(null); setReviewScore(""); setReviewFeedback(""); }}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>

              <div className="overflow-y-auto p-6 space-y-6 flex-1">
                {/* AI Automated Score */}
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Student Response / Transcript</h4>
                    <div className="p-4 bg-muted/50 rounded-xl border border-border text-sm leading-relaxed text-foreground min-h-[100px]">
                      {(() => {
                        try {
                          const parsed = JSON.parse(activeSubmission.student_response || '{}');
                          return parsed.transcript || activeSubmission.student_response;
                        } catch {
                          return activeSubmission.student_response;
                        }
                      })()}
                    </div>
                  </div>

                  <div className="w-full md:w-48 shrink-0 flex flex-col gap-3">
                    <div className="p-4 border border-border rounded-xl text-center bg-background">
                      <div className="text-xs text-muted-foreground font-semibold mb-1">Raw AI Score</div>
                      <div className="text-3xl font-bold text-foreground">
                        {activeSubmission.raw_score !== null ? activeSubmission.raw_score : '--'}
                      </div>
                    </div>

                    {!normalizationResult ? (
                      <button
                        onClick={async () => {
                          const parsed = activeSubmission.student_response?.startsWith('{')
                            ? JSON.parse(activeSubmission.student_response).transcript
                            : activeSubmission.student_response;
                          const res = await normalizeMutation.mutateAsync({
                            assignmentId: activeSubmission.assignment_id,
                            transcript: parsed || "",
                            raw_score: activeSubmission.raw_score || 0,
                            disability_type: activeSubmission.disability_type
                          });
                          setNormalizationResult(res.normalization);
                          setReviewScore(res.normalization.normalized_score);
                        }}
                        disabled={normalizeMutation.isPending || activeSubmission.raw_score === null}
                        className="w-full py-2.5 rounded-lg text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center gap-2 transition-colors">
                        {normalizeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        AI Normalization
                      </button>
                    ) : (
                      <div className="p-4 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl text-center">
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1 flex justify-center items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Normalized Score
                        </div>
                        <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                          {normalizationResult.normalized_score}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Normalization Justification */}
                {normalizationResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-900 dark:text-indigo-200">
                    <span className="font-semibold block mb-1">AI Adjustment Justification:</span>
                    {normalizationResult.justification}
                  </motion.div>
                )}

                {/* Teacher Final Review Form */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground">Final Teacher Review</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Final Score</label>
                      <input type="number" min="0" max="100"
                        value={reviewScore} onChange={e => setReviewScore(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary outline-none"
                        placeholder="0-100" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Feedback to Student</label>
                      <input type="text"
                        value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Great job! Keep it up." />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
                <button onClick={() => { setActiveSubmission(null); setNormalizationResult(null); setReviewScore(""); setReviewFeedback(""); }}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    await reviewMutation.mutateAsync({
                      assignmentId: activeSubmission.assignment_id,
                      final_score: Number(reviewScore),
                      teacher_feedback: reviewFeedback
                    });
                    setActiveSubmission(null);
                    setNormalizationResult(null);
                    setReviewScore("");
                    setReviewFeedback("");
                  }}
                  disabled={reviewScore === "" || reviewMutation.isPending}
                  className="px-6 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2">
                  {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Submit Final Grade
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div >
  );
}
