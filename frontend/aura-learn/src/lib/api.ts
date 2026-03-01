/**
 * EduVoice API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralises all fetch calls to the FastAPI backend.
 * Uses the Auth0 token (passed in via `getAccessToken`) for Bearer auth.
 * TanStack Query is used for all GET/reactive data — import hooks from here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthProvider";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
    path: string,
    token: string,
    options: RequestInit = {}
): Promise<T> {
    const fullUrl = `${BASE_URL}${path}`;
    console.log(`[API Request] Calling: ${fullUrl}`);
    console.log(`[API Request] Token present: ${!!token}, Length: ${token?.length}`);

    try {
        const res = await fetch(fullUrl, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers ?? {}),
            },
        });

        console.log(`[API Response] ${path} -> Status: ${res.status}`);

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[API Error] ${path}`, errBody);
            throw new Error(`API ${res.status}: ${errBody}`);
        }

        // 204 No Content
        if (res.status === 204) return undefined as T;
        return res.json() as Promise<T>;
    } catch (err) {
        console.error(`[API Fetch Failed] Network or CORS error for ${fullUrl}:`, err);
        throw err;
    }
}

// Multipart form data variant (for audio uploads)
async function apiFetchForm<T>(
    path: string,
    token: string,
    formData: FormData
): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody}`);
    }
    return res.json() as Promise<T>;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Hook: token getter from our local auth */
export function useToken() {
    const { getToken } = useAuth();
    return () => Promise.resolve(getToken() || "");
}

/** Hook: extract user role from local auth */
export function useUserRole(): "teacher" | "student" | "admin" | null {
    const { user, isAuthenticated } = useAuth();
    if (!isAuthenticated || !user) return null;
    return (user.role as "teacher" | "student" | "admin") ?? "student";
}

// ─── Types (mirror FastAPI schemas) ───────────────────────────────────────────

export interface AccessibilityProfile {
    high_contrast?: boolean;
    font_scale?: number;
    dyslexia_font?: boolean;
    focus_line?: boolean;
    captions_always_on?: boolean;
    visual_rubric?: boolean;
    stammer_friendly?: boolean;
    longer_response_window?: boolean;
    sensory_friendly?: boolean;
    gamification_off?: boolean;
    aac_mode?: boolean;
}

export interface UserProfile {
    user_id: string;
    name: string | null;
    email: string | null;
    role: string;
    sub_role?: string | null;
    school_id: string | null;
    disability_type?: string | null;
    learning_style?: string | null;
    onboarding_complete?: boolean;
    accessibility_profile: AccessibilityProfile | null;
}

export interface StudentUpload {
    user_id: string;
    email: string;
    disability_type?: string | null;
    learning_style?: string | null;
}

export interface LessonTier {
    level: number;
    label: string;
    passage: string;
    questions: string[];
    audio_url: string | null;
}

export interface Lesson {
    lesson_id: string;
    topic: string;
    grade: string;
    tiers: number;
    content_json?: any;
    created_at: string;
}

export interface LessonSummary {
    lesson_id: string;
    topic: string;
    grade: string;
    tiers: number;
    created_at: string;
}

export interface AdaptedLesson {
    lesson_id: string;
    disability_type: string;
    learning_style: string;
    original_text: string;
    adapted_text: string;
    is_adaptive?: boolean;
    adaptive_version?: Record<string, any>;
}

export interface SpeechScores {
    fluency: number;
    grammar: number;
    confidence: number;
    pronunciation: number;
}

export interface WordMark {
    word: string;
    issue: string | null;
    start_sec: number | null;
    end_sec: number | null;
}

export interface SpeechAnalysisResult {
    session_id: string;
    transcript: string;
    scores: SpeechScores;
    feedback_text: string;
    word_marks: WordMark[];
    spoken_feedback_url: string | null;
}

export interface SessionInfo {
    session_id: string;
    started_at: string;
}

export interface ClassInsights {
    class_id: string | null;
    total_sessions: number;
    avg_fluency: number | null;
    avg_grammar: number | null;
    avg_confidence: number | null;
    common_errors: string[];
    improvement_trend: string | null;
    accessibility_usage: Record<string, number>;
}

export interface StudentProgress {
    student_id: string;
    name: string | null;
    session_count: number;
    avg_fluency: number | null;
    avg_grammar: number | null;
    avg_confidence: number | null;
    last_active: string | null;
    accessibility_modes_used: string[];
}

export interface VocabAsset {
    word: string;
    sign_url: string | null;
    caption: string | null;
    language: string;
}

export interface StudentStats {
    total_sessions: number;
    avg_fluency: number;
    streak_days: number;
    badges_earned: number;
    total_badges: number;
    fluency_trend: string;
    sessions_trend: string;
    streak_trend: string;
    badges_trend: string;
    xp: number;
    level: number;
    xp_progress: number;
    activity_data: { date: string; count: number }[];
}

export interface ProfileUpdateRequest {
    name?: string;
    disability_type?: string;
    learning_style?: string;
    accessibility_preferences?: AccessibilityProfile;
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

/** GET /auth/me — current user profile */
export function useMe() {
    const getToken = useToken();
    return useQuery<UserProfile>({
        queryKey: ["me"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch("/auth/me", token);
        },
        staleTime: 5 * 60 * 1000, // 5 min
    });
}

export function useUpdateProfile() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: ProfileUpdateRequest) => {
            const token = await getToken();
            return apiFetch("/auth/profile/update", token, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
        }
    });
}

/** GET /lesson/library — teacher's saved lessons */
export function useLessonLibrary() {
    const getToken = useToken();
    return useQuery<LessonSummary[]>({
        queryKey: ["lesson-library"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch("/lesson/library", token);
        },
    });
}

export interface StudentAssignment {
    assignment_id: string;
    lesson_id: string;
    teacher_id: string;
    assigned_to: string;
    due_date: string | null;
    status: string;
    created_at: string;
    topic: string;
    grade: string;
}

/** GET /lesson/student-assignments — fetch student assignments from db */
export function useStudentAssignments() {
    const getToken = useToken();
    return useQuery<StudentAssignment[]>({
        queryKey: ["student-assignments"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch("/lesson/student-assignments", token);
        },
    });
}

/** GET /lesson/{id} — full lesson object */
export function useLesson(lessonId: string | null) {
    const getToken = useToken();
    return useQuery<Lesson>({
        queryKey: ["lesson", lessonId],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch(`/lesson/${lessonId}`, token);
        },
        enabled: !!lessonId,
    });
}

/** GET /lesson/{id}/adapted — dynamically adapted lesson object */
export function useAdaptedLesson(lessonId: string | null) {
    const getToken = useToken();
    return useQuery<AdaptedLesson>({
        queryKey: ["lesson-adapted", lessonId],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch(`/lesson/${lessonId}/adapted`, token);
        },
        enabled: !!lessonId,
        staleTime: 5 * 60 * 1000,
    });
}

/** POST /lesson/{assignmentId}/submit */
export function useSubmitAssignment() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<{ status: string }, Error, { assignmentId: string; studentResponse?: string }>({
        mutationFn: async ({ assignmentId, studentResponse }) => {
            const token = await getToken();
            return apiFetch(`/lesson/${assignmentId}/submit`, token, {
                method: "POST",
                body: studentResponse ? JSON.stringify({ student_response: studentResponse }) : undefined,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
        },
    });
}

export type VideoEvaluationResult = {
    transcript: string;
    score: number;
    feedback: string;
};

/** POST /lesson/{assignmentId}/submit-video */
export function useSubmitVideoAssignment() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<{ status: string; assignment_id: string; evaluation: VideoEvaluationResult }, Error, { assignmentId: string; video: File; context: string }>({
        mutationFn: async ({ assignmentId, video, context }) => {
            const token = await getToken();
            const formData = new FormData();
            formData.append("video", video);
            formData.append("assignment_context", context);
            return apiFetchForm(`/lesson/${assignmentId}/submit-video`, token, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
        },
    });
}

export interface TeacherSubmissionInfo {
    assignment_id: string;
    lesson_id: string;
    assigned_to: string;
    due_date: string | null;
    status: string;
    created_at: string;
    student_response: string | null;
    raw_score: number | null;
    topic: string;
    grade: string;
    student_name: string;
    disability_type: string;
    student_id: string;
}

/** GET /teacher/assignments/submissions */
export function useTeacherSubmissions() {
    const getToken = useToken();
    return useQuery<TeacherSubmissionInfo[]>({
        queryKey: ["teacher-submissions"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch(`/lesson/teacher/assignments/submissions`, token);
        }
    });
}

// ─── Adaptive Material Generation ─────────────────────────────────────────

export interface AdaptiveGeneratePayload {
    topic: string;
    grade: string;
    description: string;
    generate_audio?: boolean;
}

export interface AdaptiveGenerateResult {
    status: string;
    lesson_id: string;
    topic: string;
    grade: string;
    created_at: string;
    adaptive_versions: Record<string, any>;
    generation_stats: { total: number; success: number; failed: string[] };
}

/** POST /lesson/generate-adaptive — generates 9 disability-category study materials */
export function useGenerateAdaptiveMaterial() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<AdaptiveGenerateResult, Error, AdaptiveGeneratePayload>({
        mutationFn: async (payload) => {
            const token = await getToken();
            return apiFetch("/lesson/generate-adaptive", token, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lesson-library"] });
        },
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export interface TestQuestion {
    id: string;
    type: string;
    question: string;
    options?: string[];
    correctAnswer?: string;
    mediaUrl?: string;
}

export interface CreateTestPayload {
    title: string;
    topic: string;
    grade: string;
    timeLimit: number;
    questions: TestQuestion[];
}

export function useCreateTest() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<{ status: string; test_id: string }, Error, CreateTestPayload>({
        mutationFn: async (payload) => {
            const token = await getToken();
            return apiFetch("/test/", token, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["test-library"] });
        },
    });
}

export function useStudentTests() {
    const getToken = useToken();
    return useQuery<any[]>({
        queryKey: ["student-tests"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch(`/test/student/available`, token);
        }
    });
}

export function useStudentStats() {
    const getToken = useToken();
    return useQuery<StudentStats>({
        queryKey: ["student-stats"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch("/student/stats", token);
        },
        staleTime: 60 * 1000, // 1 min
    });
}

/** POST /test/{testId}/assign */
export function useAssignTest() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<{ status: string; assignment_id: string; test_id: string }, Error, { testId: string; class_id: string; due_date?: string }>({
        mutationFn: async ({ testId, class_id, due_date }) => {
            const token = await getToken();
            return apiFetch(`/test/${testId}/assign`, token, {
                method: "POST",
                body: JSON.stringify({ class_id, due_date })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student-tests"] });
        },
    });
}

export interface NormalizeScoreResult {
    normalized_score: number;
    justification: string;
}

/** POST /lesson/{assignmentId}/normalize-score */
export function useNormalizeScore() {
    const getToken = useToken();
    return useMutation<{ status: string; normalization: NormalizeScoreResult }, Error, { assignmentId: string; transcript: string; raw_score: number; disability_type: string }>({
        mutationFn: async ({ assignmentId, transcript, raw_score, disability_type }) => {
            const token = await getToken();
            return apiFetch(`/lesson/${assignmentId}/normalize-score`, token, {
                method: "POST",
                body: JSON.stringify({ transcript, raw_score, disability_type })
            });
        }
    });
}

/** POST /lesson/{assignmentId}/review */
export function useReviewAssignment() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<{ status: string }, Error, { assignmentId: string; final_score: number; teacher_feedback: string }>({
        mutationFn: async ({ assignmentId, final_score, teacher_feedback }) => {
            const token = await getToken();
            return apiFetch(`/lesson/${assignmentId}/review`, token, {
                method: "POST",
                body: JSON.stringify({ final_score, teacher_feedback })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teacher-submissions"] });
        },
    });
}

/** GET /teacher/class/insights */
export function useClassInsights(classId?: string) {
    const getToken = useToken();
    return useQuery<ClassInsights>({
        queryKey: ["class-insights", classId],
        queryFn: async () => {
            const token = await getToken();
            const qs = classId ? `?class_id=${classId}` : "";
            return apiFetch(`/teacher/class/insights${qs}`, token);
        },
    });
}

/** GET /teacher/class/:id/students */
export function useClassStudents(classId: string) {
    const getToken = useToken();
    return useQuery<StudentProgress[]>({
        queryKey: ["class-students", classId],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch(`/teacher/class/${classId}/students`, token);
        },
        enabled: !!classId,
    });
}

// ─── Admin Hooks ──────────────────────────────────────────────────────────────

export function useAdminStudents() {
    const getToken = useToken();
    return useQuery<{ students: UserProfile[] }>({
        queryKey: ["admin-students"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch("/admin/students", token);
        }
    });
}

export function useAdminAnalytics() {
    const getToken = useToken();
    return useQuery({
        queryKey: ["admin-analytics"],
        queryFn: async () => {
            const token = await getToken();
            return apiFetch<{ total_students: number; disability_breakdown: Record<string, number> }>("/admin/analytics", token);
        }
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCompleteOnboarding() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<
        { status: string },
        Error,
        {
            sub_role: string;
            is_specially_abled?: boolean;
            disability_type?: string;
            learning_style?: string;
            accessibility_preferences?: AccessibilityProfile;
        }
    >({
        mutationFn: async (payload) => {
            const token = await getToken();
            return apiFetch("/auth/onboarding", token, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
        },
    });
}

export function useUploadProfiles() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<{ status: string; uploaded_count: number }, Error, { students: StudentUpload[] }>({
        mutationFn: async (payload) => {
            const token = await getToken();
            return apiFetch("/admin/students/upload-profiles", token, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-students"] });
        },
    });
}

/** POST /lesson/generate */
export function useGenerateLesson() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<
        Lesson,
        Error,
        {
            topic: string;
            grade: string;
            tiers: number;
            language: string;
            base_text?: string;
            generate_audio?: boolean;
        }
    >({
        mutationFn: async (payload) => {
            const token = await getToken();
            return apiFetch("/lesson/generate", token, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lesson-library"] });
        },
    });
}

/** POST /lesson/transcribe */
export function useTranscribeMedia() {
    const getToken = useToken();
    return useMutation<{ transcript: string }, Error, { audioBlob: Blob; audioFilename?: string }>({
        mutationFn: async ({ audioBlob, audioFilename = "audio.webm" }) => {
            const token = await getToken();
            const form = new FormData();
            form.append("audio", audioBlob, audioFilename);
            return apiFetchForm("/lesson/transcribe", token, form);
        },
    });
}

/** POST /lesson/s2s */
export function useSpeechToSpeech() {
    const getToken = useToken();
    return useMutation<Blob, Error, { audioBlob: Blob; audioFilename?: string; voiceId?: string }>({
        mutationFn: async ({ audioBlob, audioFilename = "audio.webm", voiceId }) => {
            const token = await getToken();
            const form = new FormData();
            form.append("audio", audioBlob, audioFilename);
            if (voiceId) {
                form.append("voice_id", voiceId);
            }

            const res = await fetch(`${BASE_URL}/lesson/s2s`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`API ${res.status}: ${errBody}`);
            }
            return await res.blob();
        },
    });
}

/** PUT /lesson/{id} */
export function useUpdateLesson() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<
        { status: string; lesson_id: string },
        Error,
        { lessonId: string; content_json: any }
    >({
        mutationFn: async ({ lessonId, content_json }) => {
            const token = await getToken();
            return apiFetch(`/lesson/${lessonId}`, token, {
                method: "PUT",
                body: JSON.stringify({ content_json }),
            });
        },
        onSuccess: (_, { lessonId }) => {
            queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
            queryClient.invalidateQueries({ queryKey: ["lesson-library"] });
        },
    });
}

/** POST /lesson/{id}/assign */
export function useAssignLesson() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<
        { status: string },
        Error,
        { lessonId: string; class_id: string; due_date?: string; mode?: string }
    >({
        mutationFn: async ({ lessonId, ...body }) => {
            const token = await getToken();
            return apiFetch(`/lesson/${lessonId}/assign`, token, {
                method: "POST",
                body: JSON.stringify(body),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["class-insights"] });
        },
    });
}

/** POST /practice/session/start */
export function useStartSession() {
    const getToken = useToken();
    return useMutation<
        SessionInfo,
        Error,
        {
            lesson_id?: string;
            mode: string;
            accessibility_json?: AccessibilityProfile;
        }
    >({
        mutationFn: async (payload) => {
            const token = await getToken();
            return apiFetch("/practice/session/start", token, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
    });
}

/** POST /practice/speech-analyze — multipart audio upload */
export function useAnalyzeSpeech() {
    const getToken = useToken();
    const queryClient = useQueryClient();
    return useMutation<
        SpeechAnalysisResult,
        Error,
        {
            sessionId: string;
            mode: string;
            audioBlob: Blob;
            audioFilename?: string;
            accessibilityJson?: AccessibilityProfile;
            generateSpokenFeedback?: boolean;
        }
    >({
        mutationFn: async ({
            sessionId,
            mode,
            audioBlob,
            audioFilename = "recording.wav",
            accessibilityJson = {},
            generateSpokenFeedback = false,
        }) => {
            const token = await getToken();
            const form = new FormData();
            form.append("session_id", sessionId);
            form.append("mode", mode);
            form.append("accessibility_json", JSON.stringify(accessibilityJson));
            form.append(
                "generate_spoken_feedback",
                String(generateSpokenFeedback)
            );
            form.append("audio", audioBlob, audioFilename);
            return apiFetchForm("/practice/speech-analyze", token, form);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["class-insights"] });
        },
    });
}

/** POST /practice/session/{id}/end */
export function useEndSession() {
    const getToken = useToken();
    return useMutation<{ status: string }, Error, string>({
        mutationFn: async (sessionId) => {
            const token = await getToken();
            return apiFetch(`/practice/session/${sessionId}/end`, token, {
                method: "POST",
            });
        },
    });
}

/** POST /sign/vocab-assets */
export function useVocabAssets() {
    const getToken = useToken();
    return useMutation<{ assets: VocabAsset[] }, Error, string[]>({
        mutationFn: async (words) => {
            const token = await getToken();
            return apiFetch("/sign/vocab-assets", token, {
                method: "POST",
                body: JSON.stringify({ words }),
            });
        },
    });
}

/** POST /aac/speak — returns audio blob URL */
export async function aacSpeak(
    text: string,
    token: string,
    voiceId?: string
): Promise<string> {
    const res = await fetch(`${BASE_URL}/aac/speak`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, voice_id: voiceId }),
    });
    if (!res.ok) throw new Error(`AAC speak failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

/** POST /events — fire-and-forget accessibility event logging */
export async function logEvent(
    eventType: string,
    payload: Record<string, unknown>,
    token: string
): Promise<void> {
    try {
        await apiFetch("/events/", token, {
            method: "POST",
            body: JSON.stringify({ event_type: eventType, payload }),
        });
    } catch {
        // Non-critical
    }
}
