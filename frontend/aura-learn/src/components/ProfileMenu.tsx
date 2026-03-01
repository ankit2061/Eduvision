import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    User, LogOut, Settings, X, Save,
    Loader2, CheckCircle2, AlertCircle, Sparkles,
    Eye, Mic, Ear, MessageSquare, Brain, Hand, Accessibility, Type
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useMe, useUpdateProfile, type ProfileUpdateRequest } from "@/lib/api";
import * as store from "@/lib/store";

const categories: { id: store.DisabilityCategory; label: string; icon: any }[] = [
    { id: "speech", label: "Speech & Stammer", icon: Mic },
    { id: "dyslexia", label: "Dyslexia & Reading", icon: Type },
    { id: "hearing", label: "Hearing Impairment", icon: Ear },
    { id: "aac", label: "AAC & Non-Verbal", icon: MessageSquare },
    { id: "visual", label: "Visual Impairment", icon: Eye },
    { id: "autism", label: "Autism Spectrum", icon: Brain },
    { id: "adhd", label: "ADHD", icon: Sparkles },
    { id: "intellectual", label: "Intellectual Disability", icon: Brain },
    { id: "motor", label: "Motor & Physical", icon: Hand },
    { id: "general", label: "General Inclusive", icon: Accessibility },
];

export const ProfileModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { data: me } = useMe();
    const updateProfile = useUpdateProfile();

    const [name, setName] = useState(me?.name || "");
    const [category, setCategory] = useState<store.DisabilityCategory>(me?.disability_type as any || "general");
    const [learningStyle, setLearningStyle] = useState(me?.learning_style || "visual");
    const [isSuccess, setIsSuccess] = useState(false);

    // Sync state with me data when modal opens
    React.useEffect(() => {
        if (isOpen && me) {
            setName(me.name || "");
            setCategory(me.disability_type as any || "general");
            setLearningStyle(me.learning_style || "visual");
        }
    }, [isOpen, me]);

    const handleSave = async () => {
        try {
            await updateProfile.mutateAsync({
                name,
                disability_type: category,
                learning_style: learningStyle as any
            });
            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                onClose();
            }, 1500);
        } catch (err) {
            console.error("Failed to update profile", err);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={e => e.stopPropagation()}
                    className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                        <h3 className="font-serif font-bold text-xl text-foreground">Edit Profile</h3>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                        {/* Name */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-5 py-3.5 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium"
                                placeholder="Your Name"
                            />
                        </div>

                        {/* Disability Category */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Learning Profile</label>
                            <div className="grid grid-cols-2 gap-3">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategory(cat.id)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${category === cat.id
                                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary shadow-sm"
                                            : "border-border hover:bg-muted/50 text-muted-foreground"
                                            }`}
                                    >
                                        <cat.icon className={`w-4 h-4 ${category === cat.id ? "text-primary" : "text-muted-foreground"}`} />
                                        <span className="text-xs font-semibold">{cat.label}</span>
                                        {me?.disability_type === cat.id && (
                                            <span className="ml-auto text-[8px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Saved</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Learning Style */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Preferred Learning Style</label>
                            <div className="flex gap-2 p-1.5 bg-muted/50 rounded-2xl border border-border">
                                {["visual", "auditory", "reading"].map(style => (
                                    <button
                                        key={style}
                                        onClick={() => setLearningStyle(style)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${learningStyle === style
                                            ? "bg-card text-primary shadow-sm ring-1 ring-border"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-muted/30 border-t border-border flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={updateProfile.isPending || isSuccess}
                            className={`px-8 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md ${isSuccess
                                ? "bg-success text-white shadow-success/20"
                                : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                                }`}
                        >
                            {updateProfile.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                            ) : isSuccess ? (
                                <><CheckCircle2 className="w-4 h-4" /> Updated!</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save Changes</>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export const ProfileMenu = ({ children, align = "right" }: { children: React.ReactNode, align?: "left" | "right" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { logout, user } = useAuth();
    const { data: me } = useMe();

    return (
        <div className="relative">
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                {children}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className={`absolute z-50 mt-2 w-56 rounded-2xl bg-card border border-border shadow-xl p-2 ${align === "right" ? "right-0" : "left-0"
                                }`}
                        >
                            <div className="px-3 py-3 border-b border-border mb-1">
                                <div className="text-xs font-bold text-foreground truncate">{me?.name || user?.name || "User"}</div>
                                <div className="text-[10px] text-muted-foreground capitalize">
                                    {me?.role || user?.role || "Guest"}
                                    {me?.disability_type && ` • ${store.CATEGORY_LABELS[me.disability_type as store.DisabilityCategory]}`}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setIsModalOpen(true);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                            >
                                <User className="w-4 h-4 text-primary" />
                                View Profile
                            </button>

                            <button
                                onClick={() => logout()}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Log Out
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <ProfileModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};
