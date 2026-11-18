"use client";

import { usePathname } from "next/navigation";
import ChatWidget from "./ChatWidget";

/**
 * The assistant is available across the app, but never on the public waiting
 * room display (it is a passive, full-screen screen for patients).
 */
export default function ChatWidgetMount() {
  const pathname = usePathname();

  if (pathname?.startsWith("/display")) return null;

  return <ChatWidget />;
}
