import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { FileText, Heart, Package } from "lucide-react";

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
                text: "Sponsor",
                external: true,
                url: "https://github.com/sponsors/yusefalmamari",
                icon: <Heart />,
            },
            {
                text: "npm",
                external: true,
                url: "https://www.npmjs.com/package/saturon",
                icon: <Package />,
            },
        ],
    };
}
