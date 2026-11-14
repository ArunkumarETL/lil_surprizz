"use client";
import { StoreProvider } from "@/components/store-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
