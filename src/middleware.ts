import { NextResponse, type NextRequest } from "next/server";

/**
 * 逐请求生成 nonce 并下发内容安全策略。
 *
 * 题库富文本以 dangerouslySetInnerHTML 渲染，写入侧的白名单消毒是第一道防线，
 * CSP 是第二道：即使有历史脏数据漏网，注入的内联脚本与事件处理器也无法执行。
 * Next.js 会读取请求头上的 CSP，把同一个 nonce 注入到它自己产出的 script 标签。
 */
function buildContentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    // 开发模式下 webpack HMR 依赖 eval，生产环境不放行。
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Tailwind 与 KaTeX 依赖内联样式；样式内联不构成脚本执行面。
    "style-src 'self' 'unsafe-inline'",
    // 题图来自第三方题库 CDN，统一走 https。
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      // 仅对文档请求生成 nonce；静态资源与预取请求由 next.config 的静态响应头覆盖。
      source: "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
