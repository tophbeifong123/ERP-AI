"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider สำหรับระบบ Next.js App Router และ next-themes
 * ทำหน้าที่กระจายตัวแปรธีมไปยัง HTML Element สำหรับ Tailwind CSS
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
