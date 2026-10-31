import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Home, User, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);
  if (loading || !user)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Crown className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="mx-auto min-h-screen max-w-2xl pb-28">{children}</div>
      <nav className="glass fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-around rounded-full py-3">
        <Link to="/" className="flex flex-col items-center text-xs text-muted-foreground" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>
          <Home className="h-6 w-6" />
          الغرف
        </Link>
        <Link to="/profile" className="flex flex-col items-center text-xs text-muted-foreground" activeProps={{ className: "text-primary" }}>
          <User className="h-6 w-6" />
          حسابي
        </Link>
      </nav>
    </RequireAuth>
  );
}
