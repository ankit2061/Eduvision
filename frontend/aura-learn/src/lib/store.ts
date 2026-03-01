// Shared data store for the entire platform using localStorage

// ============ TYPES ============

export type DisabilityCategory =
  | "speech" | "dyslexia" | "hearing" | "aac"
  | "visual" | "autism" | "motor" | "adhd" | "intellectual" | "general";

export type MaterialFormat = "written" | "audio" | "video";

export type AccessibilityPreference = {
  preferredFormat: MaterialFormat;
  fontSize: "normal" | "large" | "xlarge";
  highContrast: boolean;
  screenReader: boolean;
  signLanguage: boolean;
  simplifiedText: boolean;
  audioDescription: boolean;
  captionsEnabled: boolean;
  switchAccess: boolean;
};

// ---- Materials ----

export type Material = {
  id: string;
  title: string;
  topic: string;
  grade: string;
  category: DisabilityCategory;
  originalFormat: MaterialFormat;
  writtenContent: string;
  audioContent: string;   // simulated transcript/description
  videoContent: string;   // simulated description/script
  // AI-converted accessible versions
  convertedVersions: Record<DisabilityCategory, {
    written: string;
    audio: string;
    video: string;
  }>;
  createdAt: string;
  status: "draft" | "published";
};

// ---- Tests ----

export type TestQuestion = {
  id: string;
  question: string;
  type: "multiple_choice" | "written" | "audio_response" | "visual_match";
  options?: string[];
  correctAnswer: string;
  imageDescription?: string;
};

export type Test = {
  id: string;
  title: string;
  topic: string;
  grade: string;
  category: DisabilityCategory;
  questions: TestQuestion[];
  timeLimit: number; // minutes, 0 = unlimited
  createdAt: string;
  status: "draft" | "published";
  // AI-converted versions per disability
  convertedTests: Record<DisabilityCategory, TestQuestion[]>;
};

export type TestSubmission = {
  id: string;
  testId: string;
  studentName: string;
  answers: Record<string, string>;
  score?: number;
  feedback?: string;
  submittedAt: string;
  method: MaterialFormat; // how the student took the test
};

// ---- Live Classes ----

export type LiveClass = {
  id: string;
  title: string;
  topic: string;
  grade: string;
  status: "scheduled" | "live" | "ended";
  scheduledAt: string;
  chatMessages: { sender: string; message: string; time: string }[];
  transcript: string; // simulated live transcript
  signLanguageEnabled: boolean;
  captionsEnabled: boolean;
  audioDescriptionEnabled: boolean;
};

// ---- Assignments ----

export type Assignment = {
  id: string;
  materialId?: string;
  testId?: string;
  type: "material" | "test";
  title: string;
  category: DisabilityCategory;
  assignedTo: "class" | string;
  dueDate: string;
  instructions: string;
  assignedDate: string;
  status: "pending" | "in_progress" | "submitted" | "reviewed";
  studentResponse?: string;
  score?: number;
  feedback?: string;
};

// ---- Teacher Profile ----

export type TeacherProfile = {
  name: string;
  isSpeciallyAbled: boolean;
  disability?: DisabilityCategory;
  accessibilityPrefs: AccessibilityPreference;
};

// ============ STORAGE HELPERS ============

function get<T>(key: string, fallback: T): T {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch { return fallback; }
}

function set(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ============ MATERIALS ============

const MAT_KEY = "voicelift_materials_v2";

export const getMaterials = (): Material[] => get(MAT_KEY, []);
export const saveMaterials = (m: Material[]) => set(MAT_KEY, m);
export const addMaterial = (m: Material) => { const all = getMaterials(); all.unshift(m); saveMaterials(all); };
export const updateMaterial = (id: string, u: Partial<Material>) => {
  const all = getMaterials();
  const i = all.findIndex(m => m.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...u }; saveMaterials(all); }
};
export const deleteMaterial = (id: string) => saveMaterials(getMaterials().filter(m => m.id !== id));

// ============ TESTS ============

const TEST_KEY = "voicelift_tests";

export const getTests = (): Test[] => get(TEST_KEY, []);
export const saveTests = (t: Test[]) => set(TEST_KEY, t);
export const addTest = (t: Test) => { const all = getTests(); all.unshift(t); saveTests(all); };
export const updateTest = (id: string, u: Partial<Test>) => {
  const all = getTests();
  const i = all.findIndex(t => t.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...u }; saveTests(all); }
};
export const deleteTest = (id: string) => saveTests(getTests().filter(t => t.id !== id));

// ============ TEST SUBMISSIONS ============

const SUB_KEY = "voicelift_submissions";

export const getSubmissions = (): TestSubmission[] => get(SUB_KEY, []);
export const addSubmission = (s: TestSubmission) => { const all = getSubmissions(); all.unshift(s); set(SUB_KEY, all); };
export const updateSubmission = (id: string, u: Partial<TestSubmission>) => {
  const all = getSubmissions();
  const i = all.findIndex(s => s.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...u }; set(SUB_KEY, all); }
};

// ============ LIVE CLASSES ============

const LIVE_KEY = "voicelift_live";

export const getLiveClasses = (): LiveClass[] => get(LIVE_KEY, []);
export const saveLiveClasses = (c: LiveClass[]) => set(LIVE_KEY, c);
export const addLiveClass = (c: LiveClass) => { const all = getLiveClasses(); all.unshift(c); saveLiveClasses(all); };
export const updateLiveClass = (id: string, u: Partial<LiveClass>) => {
  const all = getLiveClasses();
  const i = all.findIndex(c => c.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...u }; saveLiveClasses(all); }
};

// ============ ASSIGNMENTS ============

const ASSIGN_KEY = "voicelift_assignments_v2";

export const getAssignments = (): Assignment[] => get(ASSIGN_KEY, []);
export const saveAssignments = (a: Assignment[]) => set(ASSIGN_KEY, a);
export const addAssignment = (a: Assignment) => { const all = getAssignments(); all.unshift(a); saveAssignments(all); };
export const updateAssignment = (id: string, u: Partial<Assignment>) => {
  const all = getAssignments();
  const i = all.findIndex(a => a.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...u }; saveAssignments(all); }
};
export const deleteAssignment = (id: string) => saveAssignments(getAssignments().filter(a => a.id !== id));

// ============ TEACHER PROFILE ============

const TEACHER_KEY = "voicelift_teacher_profile";

export const getTeacherProfile = (): TeacherProfile => get(TEACHER_KEY, {
  name: "Ms. Sharma",
  isSpeciallyAbled: false,
  accessibilityPrefs: {
    preferredFormat: "written" as MaterialFormat,
    fontSize: "normal" as const,
    highContrast: false,
    screenReader: false,
    signLanguage: false,
    simplifiedText: false,
    audioDescription: false,
    captionsEnabled: false,
    switchAccess: false,
  },
});
export const saveTeacherProfile = (p: TeacherProfile) => set(TEACHER_KEY, p);

// ============ AI CONVERSION SIMULATOR ============

const CATEGORY_LABELS: Record<DisabilityCategory, string> = {
  speech: "Speech & Stammer",
  dyslexia: "Dyslexia & Reading",
  hearing: "Hearing Impairment",
  aac: "AAC & Non-Verbal",
  visual: "Visual Impairment",
  autism: "Autism Spectrum",
  adhd: "ADHD",
  intellectual: "Intellectual Disability",
  motor: "Motor & Physical",
  general: "General Inclusive",
};

export { CATEGORY_LABELS };

export function aiConvertMaterial(
  title: string, content: string, format: MaterialFormat
): Record<DisabilityCategory, { written: string; audio: string; video: string }> {
  const result = {} as Record<DisabilityCategory, { written: string; audio: string; video: string }>;

  const cats: DisabilityCategory[] = ["speech", "dyslexia", "hearing", "aac", "visual", "autism", "adhd", "intellectual", "motor", "general"];

  for (const cat of cats) {
    result[cat] = {
      written: convertWritten(content, cat, title),
      audio: convertAudio(content, cat, title),
      video: convertVideo(content, cat, title),
    };
  }
  return result;
}

function convertWritten(content: string, cat: DisabilityCategory, title: string): string {
  switch (cat) {
    case "speech": return `📖 ${title}\n[Pacing markers added · Breath cues included]\n\n${content.split('. ').join('. (pause) ')}\n\n💡 Read at your own pace. Pauses are marked for you.`;
    case "dyslexia": return `📖 ${title}\n[OpenDyslexic Font · 1.8x Line Spacing · Colour-coded syllables]\n\n${content}\n\n🔤 Key words are highlighted. Use the ruler tool to track lines.`;
    case "hearing": return `📖 ${title}\n[Visual-first layout · Diagrams included · No audio dependency]\n\n${content}\n\n🖼️ All concepts illustrated with diagrams. Sign language glossary below.`;
    case "aac": return `📖 ${title}\n[Symbol-supported text · Core vocabulary highlighted]\n\n${content.split('. ').map(s => `[📗] ${s.trim()}`).join('\n')}\n\n💬 Tap any symbol to hear it spoken.`;
    case "visual": return `📖 ${title}\n[Screen-reader optimized · 18pt font · High contrast]\n[Audio description: This text covers ${title.toLowerCase()}]\n\n${content}\n\n♿ Fully compatible with JAWS, NVDA, and VoiceOver.`;
    case "autism": return `📖 ${title}\n[Predictable structure · Visual supports · Clear steps]\n\n✅ What we will learn: ${title}\n\n${content.split('. ').map((s, i) => `Step ${i + 1}: ${s.trim()}`).join('\n')}\n\n🟢 You're doing great! Take a break if you need one.`;
    case "motor": return `📖 ${title}\n[Switch-accessible · Voice navigation ready · Large targets]\n\nSay "Next" to continue · Say "Read" to hear this section\n\n${content}\n\n⌨️ Keyboard shortcuts: Space=Next, R=Repeat`;
    case "adhd": return `📖 ${title}\n[Chunked into short sections · Max 3-4 sentences · Progress bar]\n\n${content.split('. ').reduce((acc: string[][], s, i) => { const chunk = Math.floor(i / 3); if (!acc[chunk]) acc[chunk] = []; acc[chunk].push(s.trim()); return acc; }, [] as string[][]).map((chunk, i) => `📌 Section ${i + 1}:\n${chunk.join('. ')}.`).join('\n\n')}\n\n✅ Progress: Track your completion above.`;
    case "intellectual": return `📖 ${title}\n[Simple words · Short sentences · Pictures with each idea]\n\n${content.split('. ').map((s, i) => `🖼️ Idea ${i + 1}: ${s.trim()}.`).join('\n')}\n\n👍 Great job reading! Ask your teacher if you need help.`;
    default: return `📖 ${title}\n[Universal Design · Multiple entry points]\n\n${content}\n\n📊 Choose your preferred way to engage with this content.`;
  }
}

function convertAudio(content: string, cat: DisabilityCategory, title: string): string {
  switch (cat) {
    case "speech": return `🎧 Audio: ${title}\n[Slow pace · Clear articulation · Repeat option]\n\n🔊 "Let's learn about ${title.toLowerCase()}. Listen carefully and repeat after me."\n\n${content.split('. ').map(s => `▶ "${s.trim()}." [pause 3s for repetition]`).join('\n')}\n\n🔁 Press repeat to hear any section again.`;
    case "dyslexia": return `🎧 Audio: ${title}\n[Narrated with word highlighting · Adjustable speed]\n\n🔊 "Follow along as I read. Each word will be highlighted."\n\n${content}\n\n⏱️ Speed: 0.75x · 1.0x · 1.25x`;
    case "hearing": return `🎧 Audio: ${title}\n[⚠️ Full visual captions provided · Sign language video overlay]\n\n📝 CAPTIONS:\n${content}\n\n🤟 Sign language interpretation available in video panel.`;
    case "aac": return `🎧 Audio: ${title}\n[Short segments · Symbol cues · Response buttons]\n\n${content.split('. ').map(s => `🔊 "${s.trim()}" → [👍 Got it] [❓ Repeat] [⏭️ Next]`).join('\n')}`;
    case "visual": return `🎧 Audio: ${title}\n[Full audio description · No visual dependency]\n\n🎙️ "Welcome to this lesson on ${title.toLowerCase()}. I'll describe everything you need to know."\n\n${content}\n\n📖 "End of lesson. Say 'Quiz' to test your knowledge."`;
    case "autism": return `🎧 Audio: ${title}\n[Calm voice · Predictable structure · Gentle transitions]\n\n🎵 [Soft chime]\n🔊 "Hello! Today we will learn about ${title.toLowerCase()}. Here's what to expect:"\n\n${content.split('. ').map((s, i) => `Part ${i + 1}: "${s.trim()}."`).join('\n')}\n\n🎵 [Completion chime] "Great job listening!"`;
    case "motor": return `🎧 Audio: ${title}\n[Voice-controlled · Hands-free navigation]\n\n🎤 Commands: "Play" · "Pause" · "Next" · "Repeat" · "Quiz"\n\n🔊 "${content}"\n\n🎤 Say "Next" to continue.`;
    case "adhd": return `🎧 Audio: ${title}\n[Short-burst audio · One chunk at a time · Micro-reward after each]\n\n${content.split('. ').reduce((acc: string[][], s, i) => { const chunk = Math.floor(i / 3); if (!acc[chunk]) acc[chunk] = []; acc[chunk].push(s.trim()); return acc; }, [] as string[][]).map((chunk, i) => `🔊 Chunk ${i + 1}: "${chunk.join('. ')}." [🎵 ding!]`).join('\n')}\n\n🏆 All chunks complete!`;
    case "intellectual": return `🎧 Audio: ${title}\n[Slow narration · Repeat option · Simple words]\n\n🔊 "Hello! Let's learn about ${title.toLowerCase()}. I will speak slowly."\n\n${content.split('. ').map(s => `▶ "${s.trim()}." [🔁 Press to hear again]`).join('\n')}\n\n🔊 "Great job listening! You can play it again."`;
    default: return `🎧 Audio: ${title}\n[Standard narration · Adjustable settings]\n\n🔊 "${content}"`;
  }
}

function convertVideo(content: string, cat: DisabilityCategory, title: string): string {
  switch (cat) {
    case "speech": return `🎬 Video: ${title}\n[Face visible for lip reading · Slow pace · Visual mouth positions]\n\n📹 Scene 1: Teacher faces camera, speaks slowly\n"${content.split('. ').slice(0, 2).join('. ')}"\n\n📹 Scene 2: Close-up of mouth forming key words\n📹 Scene 3: Student practice prompt with timer`;
    case "dyslexia": return `🎬 Video: ${title}\n[Animated text · Word-by-word highlighting · Visual stories]\n\n📹 Scene 1: Title card with large text\n📹 Scene 2: Animated illustration of concepts\n📹 Scene 3: Text appears word-by-word with narration\n"${content}"\n📹 Scene 4: Interactive quiz overlay`;
    case "hearing": return `🎬 Video: ${title}\n[Full captions · Sign language interpreter · Visual cues]\n\n📹 Main view: Visual demonstration\n📹 Bottom: Full captions bar\n📹 Corner: Sign language interpreter\n📹 Visual cues: ⚡ for important · ⭐ for key terms\n\nCaption text: "${content}"`;
    case "aac": return `🎬 Video: ${title}\n[Symbol overlays · Pause points · Choice screens]\n\n📹 Scene 1: Topic intro with large symbols\n📹 Scene 2: Content with AAC symbol overlay\n📹 Pause point: "How do you feel about this?" [😊][😐][🤔]\n📹 Scene 3: Summary with communication board`;
    case "visual": return `🎬 Video: ${title}\n[Full audio description track · High contrast mode · No visual-only info]\n\n🔊 Audio description: "The video shows ${title.toLowerCase()}. On screen, you can see..."\n📹 High contrast visuals\n🔊 Every visual element is described\n\nContent: "${content}"`;
    case "autism": return `🎬 Video: ${title}\n[Calm visuals · No sudden transitions · Timer visible · Structure shown]\n\n📹 Scene 1: "Today's plan" visual schedule\n📹 Scene 2: Calm animated explanation (no flashing)\n📹 Scene 3: Step-by-step content\n📹 Timer: Visible countdown\n📹 End: "All done! ⭐" celebration\n\nContent: "${content}"`;
    case "motor": return `🎬 Video: ${title}\n[Auto-play · Voice controlled · Switch accessible · No manual interaction]\n\n📹 Auto-advancing slides\n🎤 Voice commands: "Pause" · "Back" · "Next"\n🔘 Single-switch scanning mode available\n\nContent: "${content}"`;
    case "adhd": return `🎬 Video: ${title}\n[Minimal visuals · No distractions · Progress bar · Micro-rewards]\n\n📹 Scene 1: Simple title card — no animations\n📹 Scene 2: Content in short 30-second chunks\n📹 After each chunk: "⭐ Great! Keep going!"\n📹 Progress bar visible throughout\n\nContent: "${content}"`;
    case "intellectual": return `🎬 Video: ${title}\n[Simple icons alongside each concept · Slow pace · Guided]\n\n📹 Scene 1: "Today we learn: ${title}" with big icon\n📹 Scene 2: Each idea shown with a simple picture\n📹 Scene 3: Teacher points at each concept one at a time\n📹 End: "Well done! 🌟"\n\nContent: "${content}"`;
    default: return `🎬 Video: ${title}\n[Multi-modal · Captions · Audio description · Interactive]\n\n📹 Standard video with all accessibility features enabled\n\nContent: "${content}"`;
  }
}

export function aiConvertTest(questions: TestQuestion[], cat: DisabilityCategory): TestQuestion[] {
  return questions.map(q => {
    const converted = { ...q, id: `${q.id}_${cat}` };
    switch (cat) {
      case "speech":
        converted.question = `🎤 ${q.question}\n[You may answer by speaking slowly. Take pauses. Repeat if needed.]`;
        break;
      case "dyslexia":
        converted.question = `📖 ${q.question}\n[Large font · Colour-coded · Read aloud available]`;
        break;
      case "hearing":
        converted.question = `👁️ ${q.question}\n[Visual question · Sign language available · No audio required]`;
        if (q.type === "audio_response") converted.type = "written";
        break;
      case "aac":
        converted.question = `💬 ${q.question}\n[Select symbols to answer · Communication board active]`;
        converted.type = "visual_match";
        break;
      case "visual":
        converted.question = `🔊 ${q.question}\n[Screen reader optimized · Audio question available · Voice answer accepted]`;
        if (q.type === "visual_match") converted.type = "audio_response";
        break;
      case "autism":
        converted.question = `✅ ${q.question}\n[Clear format · One step at a time · Take a break if needed]`;
        break;
      case "motor":
        converted.question = `🔘 ${q.question}\n[Large buttons · Switch accessible · Voice input accepted]`;
        break;
      case "adhd":
        converted.question = `⚡ ${q.question}\n[One question at a time · Progress tracker · No distractions]`;
        break;
      case "intellectual":
        converted.question = `🌟 ${q.question}\n[Simple words · Big buttons · Take your time · Ask for help]`;
        converted.type = "multiple_choice";
        break;
      default:
        converted.question = `📝 ${q.question}\n[Choose your preferred answer method]`;
    }
    return converted;
  });
}

// ============ DEFAULT ACCESSIBILITY PREFS BY CATEGORY ============

export function getDefaultPrefs(cat: DisabilityCategory): AccessibilityPreference {
  const base: AccessibilityPreference = {
    preferredFormat: "written",
    fontSize: "normal",
    highContrast: false,
    screenReader: false,
    signLanguage: false,
    simplifiedText: false,
    audioDescription: false,
    captionsEnabled: false,
    switchAccess: false,
  };
  switch (cat) {
    case "speech": return { ...base, preferredFormat: "audio" };
    case "dyslexia": return { ...base, preferredFormat: "audio", fontSize: "large", simplifiedText: true };
    case "hearing": return { ...base, preferredFormat: "video", signLanguage: true, captionsEnabled: true };
    case "aac": return { ...base, preferredFormat: "written", simplifiedText: true };
    case "visual": return { ...base, preferredFormat: "audio", screenReader: true, highContrast: true, audioDescription: true, fontSize: "xlarge" };
    case "autism": return { ...base, preferredFormat: "video", simplifiedText: true };
    case "motor": return { ...base, preferredFormat: "audio", switchAccess: true, fontSize: "large" };
    case "adhd": return { ...base, preferredFormat: "written", fontSize: "normal" };
    case "intellectual": return { ...base, preferredFormat: "video", simplifiedText: true, fontSize: "large" };
    default: return base;
  }
}
