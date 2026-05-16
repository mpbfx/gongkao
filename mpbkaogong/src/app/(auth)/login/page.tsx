import { AlertCircle, LogIn } from "lucide-react";
import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    return "/dashboard";
  }

  return callbackUrl;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params?.callbackUrl);
  const hasCredentialsError = params?.error === "CredentialsSignin";

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
        redirect(`/login?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }

      throw error;
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录公考题库</CardTitle>
          <CardDescription>使用种子账号或后续接入的正式账号进入练习。</CardDescription>
        </CardHeader>
        <form action={loginAction}>
          <CardContent>
            <FieldGroup>
              {hasCredentialsError ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>登录失败</AlertTitle>
                  <AlertDescription>邮箱或密码不正确。</AlertDescription>
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
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full">
              <LogIn data-icon="inline-start" />
              登录
            </Button>
            <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
              返回首页
            </Link>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

