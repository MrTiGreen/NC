type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
};

type TelegramWebApp = {
  initData: string;
  themeParams?: TelegramThemeParams;
  ready: () => void;
  expand: () => void;
  onEvent?: (event: string, callback: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTelegram() {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready();
  webApp?.expand();
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData ?? "";
}

export function syncTelegramTheme() {
  applyTheme();
  window.Telegram?.WebApp?.onEvent?.("themeChanged", applyTheme);
}

function applyTheme() {
  const theme = window.Telegram?.WebApp?.themeParams;
  const root = document.documentElement;

  if (!theme) {
    return;
  }

  setCssVar(root, "--tg-bg", theme.bg_color);
  setCssVar(root, "--tg-text", theme.text_color);
  setCssVar(root, "--tg-muted", theme.hint_color);
  setCssVar(root, "--tg-accent", theme.button_color ?? theme.link_color);
  setCssVar(root, "--tg-accent-text", theme.button_text_color);
  setCssVar(root, "--tg-surface", theme.secondary_bg_color);
}

function setCssVar(root: HTMLElement, name: string, value?: string) {
  if (value) {
    root.style.setProperty(name, value);
  }
}
