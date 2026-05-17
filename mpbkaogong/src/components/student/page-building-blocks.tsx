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
  info: "bg-info/10 text-info ring-1 ring-info/20",
  success: "bg-success/10 text-success ring-1 ring-success/20",
  warning: "bg-warning/10 text-warning ring-1 ring-warning/20",
  destructive: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
};

const toneBorderClassNames: Record<Tone, string> = {
  default: "border-border",
  info: "border-info/30",
  success: "border-success/30",
  warning: "border-warning/30",
  destructive: "border-destructive/30",
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
        "mx-auto flex w-full flex-1 flex-col gap-5 px-4 py-5 pb-24 md:px-6 md:py-6 lg:pb-8",
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
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow ? (
          <Badge variant="info" className="w-fit">
            {eyebrow}
          </Badge>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

export function TrainingHero({
  eyebrow,
  title,
  description,
  badge,
  badgeVariant = "info",
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  badge?: string;
  badgeVariant?: BadgeVariant;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-card shadow-xs", className)}>
      <div className="grid gap-4 border-l-4 border-primary p-4 md:grid-cols-[minmax(0,1fr)_auto] md:p-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {eyebrow ? <span className="text-xs font-medium text-muted-foreground">{eyebrow}</span> : null}
            {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{title}</h2>
          {description ? <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
      </div>
      {children ? <div className="border-t bg-muted/30 p-4 md:p-5">{children}</div> : null}
    </section>
  );
}

export function TrainingPanel({
  title,
  description,
  icon: Icon,
  action,
  tone = "default",
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-xs", toneBorderClassNames[tone], className)}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", toneClassNames[tone])}>
              <Icon className="size-4" aria-hidden="true" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-semibold leading-6">{title}</h2>
            {description ? <div className="mt-1 text-sm leading-5 text-muted-foreground">{description}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function MetricStrip({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    description?: React.ReactNode;
    icon?: LucideIcon;
    tone?: Tone;
  }>;
  className?: string;
}) {
  return (
    <section className={cn("grid overflow-hidden rounded-lg border bg-card shadow-xs sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="flex min-w-0 items-start gap-3 border-b p-4 last:border-b-0 sm:[&:nth-child(2n)]:border-l lg:border-b-0 lg:border-l lg:first:border-l-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
            {Icon ? (
              <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", toneClassNames[item.tone ?? "default"])}>
                <Icon className="size-4" aria-hidden="true" />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{item.value}</div>
              {item.description ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</div> : null}
            </div>
          </div>
        );
      })}
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
    <Card size="sm" className={toneBorderClassNames[tone]}>
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
  tone = "default",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: BadgeVariant;
  href?: string;
  children?: React.ReactNode;
  tone?: Tone;
}) {
  const icon = (
    <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", toneClassNames[tone])}>
      <Icon aria-hidden="true" />
    </div>
  );

  return (
    <Card className={cn("transition-colors hover:border-primary/30", toneBorderClassNames[tone])}>
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
    <div className="rounded-lg border border-dashed bg-card">
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
    </div>
  );
}

export function FilterPanel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b pb-3">
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
