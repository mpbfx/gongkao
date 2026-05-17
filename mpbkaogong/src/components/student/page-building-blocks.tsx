import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type Tone = "default" | "info" | "success" | "warning" | "destructive";

const toneClassNames: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export function StudentPage({
  children,
  wide = false,
  className,
}: {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-5 pb-24 md:px-6 md:py-7 lg:pb-8",
        wide ? "max-w-7xl" : "max-w-6xl",
        className
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        {eyebrow ? (
          <Badge variant="info" className="w-fit">
            {eyebrow}
          </Badge>
        ) : null}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="font-mono text-2xl font-semibold tabular-nums">
              {value}
            </CardTitle>
          </div>
          <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", toneClassNames[tone])}>
            <Icon aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      {description ? <CardContent className="text-sm text-muted-foreground">{description}</CardContent> : null}
    </Card>
  );
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  badge,
  badgeVariant = "outline",
  href,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: BadgeVariant;
  href?: string;
  children?: React.ReactNode;
}) {
  const icon = (
    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
      <Icon aria-hidden="true" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon}
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
        </div>
      </CardHeader>
      {children ? <CardFooter className="gap-2">{children}</CardFooter> : href ? (
        <CardFooter>
          <Link href={href} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}>
            进入
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="grid size-12 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon aria-hidden="true" />
        </div>
        <div className="flex max-w-md flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {children ? <div className="flex flex-wrap justify-center gap-2">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

export function FilterPanel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden="true" />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export { Button };
