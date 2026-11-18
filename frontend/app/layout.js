import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import ChatWidgetMount from "@/components/ChatWidgetMount";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "MediQueue — Doctor Appointments & Smart Queue",
  description:
    "Book appointments, track your live token and manage clinic queues in real time.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Suspense fallback={null}>
          <ChatWidgetMount />
        </Suspense>
      </body>
    </html>
  );
}
