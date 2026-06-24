import { createContext, useContext } from "react";

export type ChatDockState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

export const ChatDockStateContext = createContext<ChatDockState | null>(null);

export function useChatDockState() {
  return useContext(ChatDockStateContext);
}

export type BattleNavigation = {
  returnToBattle: () => void;
};

export const BattleNavigationContext = createContext<BattleNavigation | null>(null);

export function useBattleNavigation() {
  return useContext(BattleNavigationContext);
}
