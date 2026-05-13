"use client";

import { createContext, useContext, type ReactNode } from "react";

interface ClientContextValue {
  locationId: string;
  locationName: string;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({ children, locationId, locationName }: {
  children: ReactNode;
  locationId: string;
  locationName: string;
}) {
  return (
    <ClientContext.Provider value={{ locationId, locationName }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClientContext must be used within ClientProvider");
  return ctx;
}
