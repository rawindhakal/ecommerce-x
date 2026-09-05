import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--color-primary-rgb) / <alpha-value>)",
          foreground: "#ffffff",
        },
        ink: "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        cream: "#FBF6F2",
        blush: "#FDF1F1",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 2px 20px -4px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
