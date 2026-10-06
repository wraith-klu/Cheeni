import { createContext, useContext, useState, useEffect } from "react";

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Initialize theme from localStorage or system prefers-color-scheme
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("cheeni_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // fallback
    }
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark"; // Default dark studio
  });

  // Keep DOM updated with .dark or .light class & data-theme attribute
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("cheeni_theme", theme);
    } catch (e) {
      console.warn("Theme persistence warning:", e);
    }
  }, [theme]);

  // Listen to OS prefers-color-scheme changes if user hasn't explicitly overridden
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      // If user hasn't set explicit manual preference in localStorage, follow system
      const explicit = localStorage.getItem("cheeni_theme_explicit");
      if (!explicit) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("cheeni_theme_explicit", "true");
        localStorage.setItem("cheeni_theme", next);
      } catch (e) {
        console.warn("Failed saving explicit theme:", e);
      }
      return next;
    });
  };

  const setExplicitTheme = (mode) => {
    if (mode !== "dark" && mode !== "light") return;
    setTheme(mode);
    try {
      localStorage.setItem("cheeni_theme_explicit", "true");
      localStorage.setItem("cheeni_theme", mode);
    } catch (e) {
      console.warn("Failed saving theme:", e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggleTheme, setTheme: setExplicitTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
