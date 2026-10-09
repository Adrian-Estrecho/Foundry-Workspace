import type { Metadata, Viewport } from "next";
import { Geist_Mono, Literata, Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The book serif of SOP pages; only downloaded where one is shown.
const literata = Literata({ variable: "--font-literata", subsets: ["latin"], style: ["normal", "italic"], preload: false });

export const metadata: Metadata = {
  title: { default: "ReEdit", template: "%s · ReEdit" },
  description: "ReEdit: run your editing team from one place.",
  applicationName: "ReEdit",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#130d0a" },
    { media: "(prefers-color-scheme: light)", color: "#f8f4f1" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `dark` is the default; the init script corrects it before first paint.
    <html lang="en" className={`${outfit.variable} ${geistMono.variable} ${literata.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
