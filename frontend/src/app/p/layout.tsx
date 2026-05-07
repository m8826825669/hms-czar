// Public route group layout - no auth, no sidebar
// All /p/* routes use this minimal layout

export const metadata = {
  title: "Hospital - Public View",
  description: "Public prescription and queue view",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
