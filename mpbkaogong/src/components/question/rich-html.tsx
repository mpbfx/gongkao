import { cn } from "@/lib/utils";

type RichHtmlProps = {
  html?: string | null;
  className?: string;
};

export function RichHtml({ html, className }: RichHtmlProps) {
  if (!html) {
    return null;
  }

  return (
    <div
      className={cn("rich-html min-w-0", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
