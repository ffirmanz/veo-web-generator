// src/app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Veo Web Generator",
  description: "Text/Image/JSON → Video via Google Veo (Gemini API), multi-user",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        <div className="min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
