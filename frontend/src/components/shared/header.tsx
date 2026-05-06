"use client";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { logout } from "@/lib/auth";
import { toast } from "sonner";

export function Header() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.replace("/login");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div>
        <h1 className="text-sm font-medium text-muted-foreground">
          {user?.hospital?.name ?? "HMS"}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <div className="font-medium">{user?.full_name || user?.username}</div>
            <div className="text-xs text-muted-foreground">
              {user?.roles.join(", ") || "—"}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
