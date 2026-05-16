"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AppHeaderContent = {
  title: ReactNode;
  subtitle?: ReactNode;
};

type AppHeaderContextValue = {
  setHeader: (header: AppHeaderContent | null) => void;
};

export const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);
export const APP_HEADER_CHANGE_EVENT = "saduck:app-header-change";
export type AppHeaderWindow = Window & {
  __saduckAppHeader?: AppHeaderContent | null;
};

export function useAppHeader() {
  const context = useContext(AppHeaderContext);

  return useMemo(
    () => ({
      setHeader(header: AppHeaderContent | null) {
        if (context) {
          context.setHeader(header);
          return;
        }

        if (typeof window !== "undefined") {
          (window as AppHeaderWindow).__saduckAppHeader = header;
          window.dispatchEvent(new CustomEvent(APP_HEADER_CHANGE_EVENT, { detail: header }));
        }
      },
    }),
    [context]
  );
}
