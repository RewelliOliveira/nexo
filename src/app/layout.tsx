import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Newsreader,
  Schibsted_Grotesk,
} from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-schibsted-grotesk",
  subsets: ["latin"],
});
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const FONT_VARIABLES = [geist, geistMono, newsreader, schibstedGrotesk, ibmPlexMono]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Nexo Assist",
  description: "Service desk de TI da Nexo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${FONT_VARIABLES} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
