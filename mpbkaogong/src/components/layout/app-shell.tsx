import Link from "next/link";
import { LogOut, Settings } from "lucide-react";

import { AppShellFrame } from "@/components/layout/app-shell-frame";
import type { AppHeaderContent } from "@/components/layout/app-header-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { auth, signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

function getInitial(name?: string | null, email?: string | null) {
  return (name?.[0] ?? email?.[0] ?? "用").toUpperCase();
}

export async function AppShell({
  children,
  header,
  hideMobileNav = false,
}: {
  children: React.ReactNode;
  header?: AppHeaderContent;
  hideMobileNav?: boolean;
}) {
  const session = await auth();
  const user = session?.user;

  const userMenu = user ? (
    <div className="flex items-center gap-2">
      {user.role && user.role !== "USER" ? (
        <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <Settings data-icon="inline-start" />
          后台
        </Link>
      ) : null}
      <Avatar size="sm">
        {user.image ? <AvatarImage src={user.image} alt={user.name ?? "用户头像"} /> : null}
        <AvatarFallback>{getInitial(user.name, user.email)}</AvatarFallback>
      </Avatar>
      <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:block">
        {user.name ?? user.email}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="ghost" size="icon-sm" aria-label="退出登录">
          <LogOut data-icon="icon" />
        </Button>
      </form>
    </div>
  ) : (
    <Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
      登录
    </Link>
  );

  return (
    <AppShellFrame defaultHeader={header} userMenu={userMenu} hideMobileNav={hideMobileNav}>
      {children}
    </AppShellFrame>
  );
}
