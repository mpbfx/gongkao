"use client";

import { Bot, FileUp, HelpCircle, LayoutDashboard, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const adminNavItems = [
  { label: "概览", href: "/admin", icon: LayoutDashboard },
  { label: "题目", href: "/admin/questions", icon: HelpCircle },
  { label: "试卷", href: "/admin/papers", icon: ScrollText },
  { label: "导入", href: "/admin/imports", icon: FileUp },
  { label: "Agent", href: "/admin/agent", icon: Bot },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const pathname = usePathname();

  return (
    <nav className={cn(variant === "sidebar" ? "flex flex-1 flex-col gap-1 p-3" : "flex gap-2 overflow-x-auto px-4 py-2")}>
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              variant === "sidebar" &&
                "flex items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              variant === "mobile" &&
                "inline-flex min-h-11 items-center border bg-background px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
              active &&
                (variant === "sidebar"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-primary/30 bg-secondary text-secondary-foreground")
            )}
          >
            {variant === "sidebar" ? <Icon className="size-4" aria-hidden="true" /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
