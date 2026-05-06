"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function RootPage() {
  const router = useRouter();
  const access = useAuthStore((s) => s.access);

  useEffect(() => {
    router.replace(access ? "/dashboard" : "/login");
  }, [access, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading…</div>
    </div>
  );
}
