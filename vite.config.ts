import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the app works under /habit-tracker/ on GitHub Pages.
  base: "./",
});
