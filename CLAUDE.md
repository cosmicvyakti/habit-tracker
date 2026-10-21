# Instructions for Claude

- Do not add Claude as a co-author on commits. Leave out any `Co-Authored-By: Claude` line.
- Lime's `--ease-out` in `src/components/lime/tokens.css` is retuned to `cubic-bezier(0.4, 0, 0.2, 1)`, its Google Fonts import is deleted (the app self-hosts Figtree), and `styles.css` maps Tailwind's default transition duration and curve onto Lime's `--dur-fast` and `--ease-out`. Reinstalling or updating Lime overwrites all three, so put them back afterwards.
