import { useAuth } from "@/lib/AuthProvider";
import { LogOut, Users, BarChart3, Shield, Settings } from "lucide-react";
import { useMe } from "@/lib/api";

export default function AdminDashboard() {
    const { logout, user } = useAuth();
    const { data: profile } = useMe();

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-60 bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
                <h1 className="text-lg font-serif font-bold text-sidebar-foreground mb-6">Admin</h1>
                <nav className="flex-1 space-y-1">
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-sidebar-foreground bg-sidebar-accent">
                        <BarChart3 className="w-4 h-4" /> Dashboard
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-sidebar-foreground/60">
                        <Users className="w-4 h-4" /> Users
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-sidebar-foreground/60">
                        <Shield className="w-4 h-4" /> Roles
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-sidebar-foreground/60">
                        <Settings className="w-4 h-4" /> Settings
                    </button>
                </nav>
                <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-destructive/80 hover:bg-destructive/10">
                    <LogOut className="w-4 h-4" /> Sign Out
                </button>
            </aside>
            <main className="flex-1 p-8">
                <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Welcome {profile?.name || user?.name || "Admin"}. Manage users, roles, and system settings.
                </p>
            </main>
        </div>
    );
}
