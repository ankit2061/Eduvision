/**
 * AuthPage — Custom Login / Signup page.
 * Replaces Auth0's Universal Login entirely.
 * Collects NAME, EMAIL, PASSWORD, and ROLE explicitly.
 */

import { useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Eye, EyeOff, GraduationCap, Users } from "lucide-react";

export default function AuthPage() {
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState<"login" | "signup">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"teacher" | "student">("student");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            let loggedInUser;
            if (mode === "signup") {
                if (!name.trim()) {
                    setError("Please enter your full name");
                    setLoading(false);
                    return;
                }
                loggedInUser = await register(name.trim(), email.trim(), password, role);
            } else {
                loggedInUser = await login(email.trim(), password);
            }
            // Navigate based on the role returned from the backend
            navigate(loggedInUser.role === "teacher" ? "/teacher" : "/student");
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <BookOpen className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">EduVoice</h1>
                    <p className="text-sm text-muted-foreground mt-1">Inclusive Education for Everyone</p>
                </div>

                {/* Card */}
                <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
                    {/* Tab Switcher */}
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => { setMode("login"); setError(""); }}
                            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === "login"
                                ? "text-primary border-b-2 border-primary bg-primary/5"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => { setMode("signup"); setError(""); }}
                            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === "signup"
                                ? "text-primary border-b-2 border-primary bg-primary/5"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Role Selector (signup only) */}
                        {mode === "signup" && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-2 block">I am a...</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole("student")}
                                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${role === "student"
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/30"
                                            }`}
                                    >
                                        <Users className="w-5 h-5" />
                                        <span className="text-sm font-semibold">Student</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole("teacher")}
                                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${role === "teacher"
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/30"
                                            }`}
                                    >
                                        <GraduationCap className="w-5 h-5" />
                                        <span className="text-sm font-semibold">Teacher</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Name Field (signup only) */}
                        {mode === "signup" && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    required
                                    autoFocus
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
                                    className="w-full px-4 py-3 pr-12 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    required
                                    minLength={mode === "signup" ? 6 : 1}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : mode === "signup" ? (
                                "Create Account"
                            ) : (
                                "Log In"
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    By continuing, you agree to the EduVoice Terms of Service.
                </p>
            </div>
        </div>
    );
}
