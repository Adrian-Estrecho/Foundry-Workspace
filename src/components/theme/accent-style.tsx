import { brandCss } from "@/lib/theme";

/**
 * Server-rendered accent variables. Rendered by each layout with the colour
 * that applies there (the user's choice inside the app, the company default
 * on public pages), so the right accent is in the first paint.
 */
export function AccentStyle({ accent, tint = true }: { accent: string | null | undefined; tint?: boolean }) {
  return <style dangerouslySetInnerHTML={{ __html: brandCss(accent, tint) }} />;
}
