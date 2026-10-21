import { useState } from "react";
import { Icon, Moon, Sun } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";

export const THEME_KEY = "habit-tracker:theme";

type Theme = "light" | "dark";
// The status bar takes this through theme-color, so it reads as one surface with the page: the page's ground in each
// theme (`--ground` in app.css, Lime's --surface by day and --raised by night). An installed Android app's navigation bar
// can't follow it: Chrome paints that from the manifest it saved at install, which has one color, so the manifest pins
// it to the dark one.
export const BAR_COLOR: Record<Theme, string> = { light: "#f6f5f2", dark: "#1f1f1c" };

/**
 * Applies a theme to the page and to the status bar. Self-contained, so __root.tsx can inline it before first paint.
 * It owns the theme-color tag: rendered by React, it came back as a second, light copy at startup.
 */
export function applyTheme(theme: Theme, colors: typeof BAR_COLOR) {
  document.documentElement.dataset.theme = theme;
  const head = document.head;
  const meta =
    head.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ??
    head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }));
  meta.content = colors[theme];
}

/** Whether the dark theme is on, and a switch that pins the other one on this device. */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const toggle = () => {
    const theme = dark ? "light" : "dark";
    applyTheme(theme, BAR_COLOR);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private browsing can block storage; the theme still applies until reload.
    }
    setDark(!dark);
  };
  return { dark, toggle };
}

/** The theme as one button, where there is no account menu to hold it: the sign-in page. */
export default function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Dark theme" aria-pressed={dark} onClick={toggle}>
      {/* Keyed, so the new glyph mounts and fades in from its starting style instead of swapping in place. */}
      <Icon
        key={dark ? "sun" : "moon"}
        icon={dark ? Sun : Moon}
        size={16}
        className="transition-[opacity,scale] duration-(--dur-fast) ease-out starting:scale-(--scale-enter) starting:opacity-0"
      />
    </Button>
  );
}
