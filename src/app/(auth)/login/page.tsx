import { AlertCircle, LogIn } from "lucide-react";
import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

function safeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }

  return callbackUrl;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params?.callbackUrl);
  const hasCredentialsError = params?.error === "CredentialsSignin";
  const hasServiceError = params?.error === "ServiceUnavailable";

  async function loginAction(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: callbackUrl,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const errorCode = error.type === "CredentialsSignin"
          ? "CredentialsSignin"
          : "ServiceUnavailable";
        redirect(`/login?error=${errorCode}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }

      throw error;
    }
  }

  return (
    <main className="student-auth flex min-h-dvh items-center justify-center bg-muted px-4 py-10 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(30rem,0.72fr)] lg:bg-background lg:p-0">
      <section className="relative hidden h-full min-h-dvh overflow-hidden border-r border-border bg-sidebar px-14 py-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="relative z-10">
          <div className="mb-16 flex items-center gap-4 border-b border-sidebar-foreground/20 pb-6">
            <div className="grid size-11 place-items-center border border-sidebar-foreground/45 font-semibold text-primary">编</div>
            <div>
              <div className="student-heading text-2xl font-semibold tracking-[0.08em]">备考编辑部</div>
              <div className="mt-1 text-xs tracking-[0.16em] text-sidebar-foreground/60">公考提分研究院</div>
            </div>
          </div>
          <span className="text-xs tracking-[0.16em] text-primary">今日训练入口</span>
          <h1 className="student-heading mt-5 max-w-2xl text-5xl font-semibold leading-[1.12] tracking-[-0.03em] xl:text-6xl">
            每一次作答，<br />都应该留下<br /><span className="text-primary">清晰的刻度。</span>
          </h1>
          <p className="mt-8 max-w-lg border-l border-primary pl-5 text-base leading-8 text-sidebar-foreground/68">
            真题、专项、错题与复盘，在同一个训练流程里持续校准。
          </p>
        </div>
        <div className="relative z-10 flex items-end justify-between border-t border-sidebar-foreground/20 pt-6 text-xs tracking-[0.12em] text-sidebar-foreground/48">
          <span>公考提分研究院</span>
          <span>专注 · 高效 · 精准</span>
        </div>
      </section>
      <div className="relative flex w-full items-center justify-center px-4 py-10 lg:px-12">
      <section className="relative w-full max-w-sm border border-foreground/30 bg-card p-6 lg:max-w-md lg:p-10">
        <div className="border-b-2 border-foreground pb-5">
          <span className="text-xs font-semibold tracking-[0.14em] text-primary">账号登录</span>
          <h2 className="student-heading mt-3 text-3xl font-semibold lg:text-4xl">登录开始训练</h2>
          <p className="mt-2 text-sm text-muted-foreground">回到你的今日任务与复盘现场。</p>
        </div>
        <form action={loginAction}>
          <div className="py-6">
            <FieldGroup>
              {hasCredentialsError || hasServiceError ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>{hasServiceError ? "登录服务异常" : "登录失败"}</AlertTitle>
                  <AlertDescription>
                    {hasServiceError
                      ? "数据库连接异常，请启动数据库服务后重试。"
                      : "邮箱或密码不正确。"}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={hasCredentialsError || undefined}>
                <FieldLabel htmlFor="email">邮箱</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="demo@saduck.local"
                  required
                  aria-invalid={hasCredentialsError || undefined}
                />
                <FieldDescription>种子数据会创建 demo@saduck.local。</FieldDescription>
              </Field>

              <Field data-invalid={hasCredentialsError || undefined}>
                <FieldLabel htmlFor="password">密码</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="password123"
                  required
                  minLength={8}
                  aria-invalid={hasCredentialsError || undefined}
                />
                <FieldError>{hasCredentialsError ? "请重新输入密码。" : null}</FieldError>
              </Field>
            </FieldGroup>
          </div>
          <div className="flex flex-col gap-3 border-t border-foreground/25 pt-5">
            <Button type="submit" className="h-12 w-full text-base">
              <LogIn data-icon="inline-start" />
              登录
            </Button>
            <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
              返回首页
            </Link>
          </div>
        </form>
      </section>
      </div>
    </main>
  );
}
