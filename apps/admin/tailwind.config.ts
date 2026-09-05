import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#C2185B",
          50: "#FDF1F5",
          100: "#FBE0EA",
          500: "#C2185B",
          600: "#A31350",
          700: "#800F40",
        },
      },
    },
  },
  plugins: [],
};

export default config;
