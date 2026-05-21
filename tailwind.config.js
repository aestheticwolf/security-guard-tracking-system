/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "#f7f9fc",
          100: "#eff4fb",
          800: "#17243a",
          900: "#0b1320"
        },
        gold: {
          300: "#f9d37b",
          400: "#f3bc52",
          500: "#e8a83f"
        },
        jade: {
          300: "#7ee2c1",
          400: "#38c89b",
          500: "#1ea27e"
        }
      },
      boxShadow: {
        glow: "0 20px 50px rgba(8, 17, 33, 0.28)",
        accent: "0 12px 35px rgba(232, 168, 63, 0.28)"
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at top left, rgba(232, 168, 63, 0.18), transparent 35%), radial-gradient(circle at top right, rgba(30, 162, 126, 0.16), transparent 28%), linear-gradient(135deg, rgba(9, 17, 31, 0.98), rgba(15, 26, 44, 0.94))"
      }
    }
  },
  plugins: []
};
