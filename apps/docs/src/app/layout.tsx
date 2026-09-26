// @ts-ignore
import "@/app/global.css";
import { Providers } from "@/app/providers";
import { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

const jetBrainsMono = JetBrains_Mono({
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "Saturon",
        template: "%s | Saturon",
    },
    description: "The CSS color engine for the web's future.",
    icons: {
        icon: "favicon.ico",
        apple: "images/apple-touch-icon.png",
    },
    authors: [{ name: "Ganemede Labs", url: "https://github.com/ganemedelabs" }],
    metadataBase: new URL("https://saturon.js.org"),
    openGraph: {
        title: "Saturon",
        description: "The CSS color engine for the web's future.",
        url: "https://saturon.js.org",
        siteName: "Saturon",
        images: [
            {
                url: "images/social-card.png",
                width: 1200,
                height: 675,
                alt: "Saturon Social Card",
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Saturon",
        description: "The CSS color engine for the web's future.",
        images: ["images/social-card.png"],
        creator: "@ganemedelabs",
    },
};

export default function Layout({ children }: LayoutProps<"/">) {
    const HUES = [160, 215, 260, 290, 340, 100, 75, 25, 16];

    return (
        <html lang="en" className={jetBrainsMono.className} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function() {
    var hues = ${JSON.stringify(HUES)};
    var randomHue = hues[Math.floor(Math.random() * hues.length)];
    document.documentElement.style.setProperty('--primary-hue', randomHue);
})();
`,
                    }}
                />
            </head>
            <body className="[&_figure]:bg-fd-card flex min-h-screen flex-col overflow-x-hidden">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
