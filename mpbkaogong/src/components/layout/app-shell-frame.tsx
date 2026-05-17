"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardList,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  APP_HEADER_CHANGE_EVENT,
  AppHeaderContext,
  type AppHeaderContent,
  type AppHeaderWindow,
} from "@/components/layout/app-header-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首页", href: "/", icon: Home },
  { label: "试卷", href: "/question-bank/papers", icon: ClipboardList },
  { label: "专项", href: "/question-bank/special", icon: BookOpen },
  { label: "错题", href: "/question-bank/wrong", icon: BookMarked },
  { label: "记录", href: "/question-bank/records", icon: BarChart3 },
  { label: "我的", href: "/dashboard", icon: User },
];

export function AppShellFrame({
  children,
  defaultHeader,
  userMenu,
  hideMobileNav = false,
}: {
  children: React.ReactNode;
  defaultHeader?: AppHeaderContent;
  userMenu: React.ReactNode;
  hideMobileNav?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const [header, setHeader] = useState<AppHeaderContent | null>(() =>
    typeof window === "undefined" ? null : ((window as AppHeaderWindow).__saduckAppHeader ?? null)
  );
  const headerContextValue = useMemo(() => ({ setHeader }), []);
  const mobileNavItems = navItems.filter((item) => item.href !== "/question-bank/records");

  function toggleSidebar() {
    setIsCollapsed((current) => !current);
  }

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  useEffect(() => {
    function handleHeaderChange(event: Event) {
      setHeader((event as CustomEvent<AppHeaderContent | null>).detail ?? null);
    }

    window.addEventListener(APP_HEADER_CHANGE_EVENT, handleHeaderChange);
    return () => window.removeEventListener(APP_HEADER_CHANGE_EVENT, handleHeaderChange);
  }, []);

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground [--app-sidebar-width:16rem]",
        isCollapsed && "[--app-sidebar-width:4rem]"
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        跳到主要内容
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 hidden border-r bg-sidebar/95 transition-[width] duration-200 lg:flex lg:flex-col",
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
            const active = isActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  isCollapsed && "justify-center px-0",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground"
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

      <AppHeaderContext.Provider value={headerContextValue}>
        <div className="flex min-h-dvh flex-col transition-[padding] duration-200 lg:pl-[var(--app-sidebar-width)]">
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground lg:hidden">
                  题
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium leading-tight">{header?.title ?? defaultHeader?.title ?? "题库工作台"}</span>
                  {header?.subtitle ?? defaultHeader?.subtitle ? (
                    <span className="truncate text-xs leading-tight text-muted-foreground">{header?.subtitle ?? defaultHeader?.subtitle}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {header?.actions ?? defaultHeader?.actions ? (
                  <div className="hidden items-center gap-2 md:flex">{header?.actions ?? defaultHeader?.actions}</div>
                ) : null}
                {userMenu}
              </div>
            </div>
          </header>

          <div id="main-content" className="contents">
            {children}
          </div>

          {!hideMobileNav ? (
            <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:hidden">
              <div className="grid h-16 grid-cols-5">
                {mobileNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        active && "text-primary"
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </div>
      </AppHeaderContext.Provider>
    </div>
  );
}
