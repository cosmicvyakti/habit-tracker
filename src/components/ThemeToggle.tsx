import { useState } from "react";
import { Icon, Moon, Sun } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";

export const THEME_KEY = "habit-tracker:theme";

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
        document.documentElement.dataset.theme = theme;
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
