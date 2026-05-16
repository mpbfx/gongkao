"use client";

import Link from "next/link";
import {
  BarChart3,
  BookMarked,
  ClipboardList,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "题库", href: "/", icon: Home },
  { label: "试卷", href: "/question-bank/papers", icon: ClipboardList },
  { label: "错题", href: "/question-bank/wrong", icon: BookMarked },
  { label: "记录", href: "/question-bank/records", icon: BarChart3 },
  { label: "我的", href: "/dashboard", icon: User },
];

export function AppShellFrame({
  children,
  userMenu,
}: {
  children: React.ReactNode;
  userMenu: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  function toggleSidebar() {
    setIsCollapsed((current) => !current);
  }

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground [--app-sidebar-width:16rem]",
        isCollapsed && "[--app-sidebar-width:4rem]"
      )}
    >
      <aside
        className={cn(
          "fixed inset-y-0 left-0 hidden border-r bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("flex h-16 items-center gap-2 px-5", isCollapsed && "justify-center px-0")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            题
          </div>
          <div className={cn("flex min-w-0 flex-col", isCollapsed && "hidden")}>
            <span className="truncate font-semibold leading-tight">公考题库</span>
            <span className="truncate text-xs text-muted-foreground">Question Bank</span>
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
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center px-0",
                  item.href === "/" && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className={cn(isCollapsed && "sr-only")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            size={isCollapsed ? "icon-sm" : "sm"}
            className={cn("w-full", isCollapsed && "mx-auto w-8")}
            aria-label={isCollapsed ? "展开侧栏" : "收起侧栏"}
            title={isCollapsed ? "展开侧栏" : "收起侧栏"}
            onClick={toggleSidebar}
          >
            {isCollapsed ? <PanelLeftOpen data-icon="icon" /> : <PanelLeftClose data-icon="inline-start" />}
            {!isCollapsed ? "收起" : null}
          </Button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col transition-[padding] duration-200 lg:pl-[var(--app-sidebar-width)]">
        <header className="sticky top-0 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground lg:hidden">
                题
              </div>
              <span className="font-medium">题库工作台</span>
            </div>
            {userMenu}
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
