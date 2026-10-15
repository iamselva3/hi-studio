/** Lets CSS-variable colours take Tailwind opacity modifiers, e.g. `bg-canvas/90`. */
const withAlpha = (cssVar) => `color-mix(in srgb, ${cssVar} calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: withAlpha("var(--canvas, #0D0C0B)"),
          subtle: withAlpha("var(--canvas-subtle, #141312)"),
          elevated: withAlpha("var(--canvas-elevated, #1B1A18)"),
          surface: withAlpha("var(--canvas-surface, #242220)"),
          border: withAlpha("var(--hairline, rgba(249, 244, 232, 0.08))"),
        },
        paper: {
          DEFAULT: "#F9F4E8",
          tint: "#F4EDE0",
          muted: "#E8DECB",
          dark: "#D8CBB6",
        },
        ink: {
          DEFAULT: withAlpha("var(--ink, #0E0D0C)"),
          soft: withAlpha("var(--ink-soft, #2A2825)"),
          muted: withAlpha("var(--ink-muted, #666159)"),
          faint: withAlpha("var(--ink-faint, #A8A196)"),
          light: withAlpha("var(--ink-light, #F7F2E4)"),
        },
        accent: {
          DEFAULT: withAlpha("var(--accent, #D6C098)"),
          hover: withAlpha("var(--accent-hover, #E4D1AC)"),
          deep: withAlpha("var(--accent-deep, #9E8458)"),
          glow: withAlpha("var(--accent-glow, rgba(214, 192, 152, 0.25))"),
        },
        hairline: {
          DEFAULT: withAlpha("var(--hairline, rgba(249, 244, 232, 0.08))"),
          strong: withAlpha("var(--hairline-strong, rgba(249, 244, 232, 0.16))"),
          faint: withAlpha("var(--hairline-faint, rgba(249, 244, 232, 0.04))"),
          dark: "rgba(14, 13, 12, 0.10)",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Playfair Display", "Georgia", "serif"],
        display: ["Cormorant Garamond", "Cinzel", "serif"],
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        widest: "0.25em",
        extreme: "0.35em",
        caps: "0.18em",
      },
      fontSize: {
        "display-hero": "clamp(2rem, 4.5vw, 4.25rem)",
        "display-section": "clamp(1.5rem, 2.8vw, 2.75rem)",
        "display-sub": "clamp(1.1rem, 1.8vw, 1.65rem)",
      },
      animation: {
        "shutter-flash": "shutterFlash 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "float-subtle": "floatSubtle 6s ease-in-out infinite",
      },
      keyframes: {
        shutterFlash: {
          "0%": { opacity: "0" },
          "50%": { opacity: "0.95" },
          "100%": { opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floatSubtle: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
