"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle Component
 * ปุ่มสำหรับสลับธีมระหว่างโหมดสว่าง (Light) และโหมดมืด (Dark) แบบพรีเมียม
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // ป้องกัน Hydration mismatch โดยการเรนเดอร์ UI เฉพาะหลังจากที่ client mount แล้วเท่านั้น
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-lg border border-border/40 bg-transparent flex items-center justify-center shrink-0" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border/40 hover:bg-accent/10 text-foreground transition cursor-pointer outline-none hover:text-primary"
      title={isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      aria-label="Toggle Theme"
      id="theme-toggle-btn"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 hover:text-indigo-600" />
      )}
    </button>
  );
}
