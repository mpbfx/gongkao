"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardList,
  Home,
  LibraryBig,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  APP_HEADER_CHANGE_EVENT,
  AppHeaderContext,
  type AppHeaderContent,
  type AppHeaderWindow,
} from "@/components/layout/app-header-context";
import { cn } from "@/lib/utils";

const navItems = [
  { number: "01", label: "今日校准", shortLabel: "首页", href: "/", icon: Home },
  { number: "02", label: "历年试卷", shortLabel: "试卷", href: "/question-bank/papers", icon: ClipboardList },
  { number: "03", label: "专项提分", shortLabel: "专项", href: "/question-bank/special", icon: BookOpen },
  { number: "04", label: "错题复盘", shortLabel: "错题", href: "/question-bank/wrong", icon: BookMarked },
  { number: "05", label: "学习情况", shortLabel: "学情", href: "/dashboard", icon: BarChart3 },
  { number: "06", label: "课程知识", shortLabel: "课程", href: "/knowledge", icon: LibraryBig },
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
  const pathname = usePathname();
  const isPracticeFocus = pathname.startsWith("/practice/");
  const [header, setHeader] = useState<AppHeaderContent | null>(() =>
    typeof window === "undefined" ? null : ((window as AppHeaderWindow).__saduckAppHeader ?? null)
  );
  const headerContextValue = useMemo(() => ({ setHeader }), []);
  const mobileNavItems = navItems;

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
        "student-shell student-shell-v2 min-h-dvh bg-background text-foreground [--app-sidebar-width:10.75rem]",
        isPracticeFocus && "student-practice-focus [--app-sidebar-width:0rem]"
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
          "student-spine fixed inset-y-0 left-0 z-40 hidden w-[var(--app-sidebar-width)] overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col",
          isPracticeFocus && "lg:hidden"
        )}
      >
        <div className="student-spine-brand relative flex h-[7.25rem] shrink-0 flex-col justify-center px-5">
          <span className="student-heading whitespace-nowrap text-[1.2rem] font-semibold leading-none tracking-[0.02em]">备考编辑部</span>
          <span className="mt-2 text-[0.62rem] tracking-[0.34em] text-sidebar-foreground/70">公考提分研究院</span>
        </div>
        <nav className="flex flex-1 flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "student-spine-link group relative flex min-h-[5.35rem] items-center gap-3 border-b border-sidebar-border px-5 text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent/45 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring focus-visible:outline-none",
                  active && "is-active bg-sidebar-accent/58 text-sidebar-foreground"
                )}
              >
                <span className="font-mono text-[1.4rem] font-light tabular-nums text-sidebar-foreground/42 group-[.is-active]:text-primary">{item.number}</span>
                <span className="student-heading text-[0.98rem] font-semibold tracking-[0.08em]">{item.label}</span>
                <Icon className="absolute bottom-2.5 right-3 size-3.5 opacity-0 transition-opacity group-hover:opacity-45 group-[.is-active]:opacity-55" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
        <div className="student-spine-footer border-t border-sidebar-border px-4 py-4">
          <span className="block text-[0.6rem] tracking-[0.28em] text-sidebar-foreground/45">STUDY FILE</span>
          <span className="student-heading mt-1.5 block text-sm tracking-[0.08em]">训练记录 · 持续校准</span>
          <div className="student-sidebar-user mt-4 border-t border-sidebar-border pt-4">
            {userMenu}
          </div>
        </div>
      </aside>

      <AppHeaderContext.Provider value={headerContextValue}>
        <div className="flex min-h-dvh flex-col transition-[padding] duration-200 lg:pl-[var(--app-sidebar-width)]">
          <header className={cn("student-topbar sticky top-0 z-30 border-b bg-background/95 backdrop-blur", !isPracticeFocus && "lg:hidden", isPracticeFocus && "practice-focus-topbar")}>
            <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:h-[4.25rem] lg:px-9">
              <div className="flex min-w-0 items-center gap-2">
                {isPracticeFocus ? (
                  <Link
                    href="/"
                    aria-label="返回首页"
                    className="mr-1 inline-flex h-9 shrink-0 items-center gap-1.5 border border-foreground/20 px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    <span>返回首页</span>
                  </Link>
                ) : null}
                <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground lg:hidden">
                  题
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="student-heading truncate font-medium leading-tight lg:text-[0.98rem] lg:tracking-[0.08em]">{header?.title ?? defaultHeader?.title ?? "备考编辑部"}</span>
                  {header?.subtitle ?? defaultHeader?.subtitle ? (
                  <span className="truncate text-xs leading-tight text-muted-foreground lg:hidden">{header?.subtitle ?? defaultHeader?.subtitle}</span>
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
              <div className="grid h-16 grid-cols-6">
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
                      {item.shortLabel}
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
