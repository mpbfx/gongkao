import Link from "next/link";
import { BarChart3, BookMarked, ClipboardList, Home, LogOut, Settings, User } from "lucide-react";

import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "题库", href: "/", icon: Home },
  { label: "试卷", href: "/question-bank/papers", icon: ClipboardList },
  { label: "错题", href: "/question-bank/wrong", icon: BookMarked },
  { label: "记录", href: "/question-bank/records", icon: BarChart3 },
  { label: "我的", href: "/dashboard", icon: User },
];

function getInitial(name?: string | null, email?: string | null) {
  return (name?.[0] ?? email?.[0] ?? "用").toUpperCase();
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            题
          </div>
          <div className="flex flex-col">
            <span className="font-semibold leading-tight">公考题库</span>
            <span className="text-xs text-muted-foreground">Question Bank</span>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  item.href === "/" && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Badge variant="outline">Phase 7</Badge>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="sticky top-0 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground lg:hidden">
                题
              </div>
              <span className="font-medium">题库工作台</span>
            </div>
            {user ? (
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
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                登录
              </Link>
            )}
          </div>
        </header>

        {children}

        <nav className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="grid h-16 grid-cols-5">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
                    item.href === "/" && "text-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
