import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { FileText, Lightbulb } from "lucide-react";

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <>
                    <Image src="/images/logo.svg" width={20} height={20} alt="Saturon Logo" />
                    Saturon
                </>
            ),
        },
        githubUrl: "https://github.com/ganemedelabs/saturon",
        links: [
            { text: "Documentation", url: "/docs", type: "main", icon: <FileText /> },
            {
                text: "More",
                type: "menu",
                icon: <Lightbulb />,
                items: [
                    {
                        text: "Sponsor",
                        external: true,
                        url: "https://github.com/sponsors/yusefalmamari",
                        description: "Support Saturon's development and help sustain open-source innovation.",
                    },
                    {
                        text: "NPM",
                        external: true,
                        url: "https://www.npmjs.com/package/saturon",
                        description: "Install Saturon from npm and integrate it into your color and design workflows.",
                    },
                ],
            },
        ],
    };
}
