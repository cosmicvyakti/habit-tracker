import { useState } from "react";
import { Icon, Moon, Sun } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";

export const THEME_KEY = "habit-tracker:theme";

type Theme = "light" | "dark";
// The phone's bars take these, so they read as one surface with the page: Lime's --page in each theme. An installed
// Android app paints its navigation bar with the manifest's one theme_color, so each theme has its own manifest.
export const BARS: Record<Theme, { color: string; manifest: string }> = {
  light: { color: "#ffffff", manifest: "/manifest.webmanifest" },
  dark: { color: "#0e0e0c", manifest: "/manifest-dark.webmanifest" },
};

/**
 * Applies a theme to the page and to the phone's bars. Self-contained, so __root.tsx can inline it before first paint.
 * It owns the theme-color and manifest tags: rendered by React, they came back as a second, light copy at startup.
 */
export function applyTheme(theme: Theme, bars: typeof BARS) {
  document.documentElement.dataset.theme = theme;
  const head = document.head;
  const meta = head.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ?? head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }));
  meta.content = bars[theme].color;
  const link = head.querySelector<HTMLLinkElement>('link[rel="manifest"]') ?? head.appendChild(Object.assign(document.createElement("link"), { rel: "manifest" }));
  link.href = bars[theme].manifest;
}

export default function ThemeToggle({ size = "icon-sm" }: { size?: "icon-sm" | "icon" }) {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  return (
    <Button
      variant="ghost"
      size={size}
      aria-label="Dark theme"
      aria-pressed={dark}
      onClick={() => {
        const theme = dark ? "light" : "dark";
        applyTheme(theme, BARS);
        try {
          localStorage.setItem(THEME_KEY, theme);
        } catch {
          // Private browsing can block storage; the theme still applies until reload.
        }
        setDark(!dark);
      }}
    >
      <Icon icon={dark ? Sun : Moon} size={size === "icon" ? 20 : 16} />
    </Button>
  );
}
