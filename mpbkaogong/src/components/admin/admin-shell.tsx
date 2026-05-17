import { Bot, Boxes, FileUp, HelpCircle, LayoutDashboard, ScrollText } from "lucide-react";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { label: "概览", href: "/admin", icon: LayoutDashboard },
  { label: "题目", href: "/admin/questions", icon: HelpCircle },
  { label: "试卷", href: "/admin/papers", icon: ScrollText },
  { label: "导入", href: "/admin/imports", icon: FileUp },
  { label: "Agent", href: "/admin/agent", icon: Bot },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Boxes aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold leading-tight">管理后台</span>
            <span className="text-xs text-muted-foreground">Question Admin</span>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {adminNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2 p-3">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            返回前台
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="sticky top-0 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground lg:hidden">
                <Boxes aria-hidden="true" />
              </div>
              <span className="font-medium">题库管理</span>
            </div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              前台
            </Link>
          </div>
        </header>

        <div className="border-b bg-muted/40 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto px-4 py-2">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg border bg-background px-3 py-1.5 text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {children}
      </div>
    </div>
  );
}
