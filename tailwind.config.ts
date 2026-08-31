import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
        wide: "1680px",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "dark-bg": "hsl(var(--dark-bg))",
        "bg-base": "hsl(var(--bg-base))",
        "bg-surface-1": "hsl(var(--bg-surface-1))",
        "bg-surface-2": "hsl(var(--bg-surface-2))",
        "bg-elevated": "hsl(var(--bg-elevated))",
        "bg-subtle-accent": "hsl(var(--bg-subtle-accent))",
        "bg-dark": "hsl(var(--bg-dark))",
        "bg-darkest": "hsl(var(--bg-darkest))",
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-tertiary": "hsl(var(--text-tertiary))",
        "text-on-dark": "hsl(var(--text-on-dark))",
        "text-on-dark-muted": "hsl(var(--text-on-dark-muted))",
        accent: {
          DEFAULT: "hsl(var(--accent-primary))",
          hover: "hsl(var(--accent-primary-hover))",
          light: "hsl(var(--accent-primary-light))",
          subtle: "hsl(var(--bg-subtle-accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        warm: {
          DEFAULT: "hsl(var(--accent-warm))",
        },
      },
      boxShadow: {
        "elevation-1": "0 1px 2px rgba(2,22,42,0.04)",
        "elevation-2": "0 2px 8px rgba(2,22,42,0.05)",
        "elevation-3": "0 4px 16px rgba(2,22,42,0.07)",
        "elevation-4": "0 8px 32px rgba(2,22,42,0.09)",
        "elevation-5": "0 16px 48px rgba(2,22,42,0.12)",
        "accent-glow": "0 4px 16px rgba(99,102,241,0.25)",
        "accent-glow-lg": "0 8px 24px rgba(99,102,241,0.35)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "star-btn": {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "star-btn": "star-btn calc(var(--duration)*1s) linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
