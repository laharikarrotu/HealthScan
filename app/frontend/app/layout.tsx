import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Nav from "./components/Nav";
import NavigationLoading from "./components/NavigationLoading";
import ErrorBoundary from "./components/ErrorBoundary";
import { HealthScanProvider } from "./context/HealthScanContext";

export const metadata: Metadata = {
  title: "HealthScan - AI Healthcare Assistant",
  description: "Scan medical forms, prescriptions, and healthcare documents. Get instant help with healthcare paperwork.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body
        className="antialiased h-full w-full flex flex-col bg-slate-50 pb-[env(safe-area-inset-bottom)]"
      >
        <ErrorBoundary>
        <HealthScanProvider>
            {/* Navigation Loading Indicator - Shows progress bar at top during navigation */}
            <NavigationLoading />
            {/* Skip Navigation Link for Accessibility */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
          <Nav />
            <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto">
              {children}
            </main>
          </HealthScanProvider>
        </ErrorBoundary>
        <SpeedInsights />
      </body>
    </html>
  );
}
