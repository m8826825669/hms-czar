import { AuthGuard } from "@/components/shared/auth-guard";
import { Sidebar } from "@/components/shared/sidebar";
import { Header } from "@/components/shared/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
