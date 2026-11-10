export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

export const parseTheme = (value: string | undefined): Theme =>
  (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : "system";
