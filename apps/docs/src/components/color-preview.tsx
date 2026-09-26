"use client";

import { useEffect, useState } from "react";
import { Color } from "saturon";
import { FormattingOptions } from "saturon/formatters";
import { detectUsableGamut, formatColorOutput } from "@/lib/utils";

const checkerboardStyle = {
    backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='8' height='8' fill='%23ccc'/><rect x='8' y='8' width='8' height='8' fill='%23ccc'/></svg>\")",
};

export function ColorPreview({
    color,
    rawInput,
    options,
    theme,
}: {
    color: Color | null;
    rawInput: string;
    options: FormattingOptions;
    theme?: string;
}) {
    const [displayColor, setDisplayColor] = useState<string | null>(null);
    const [usedSpace, setUsedSpace] = useState("");
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!color) {
            setHasError(true);
            setDisplayColor(null);
            setUsedSpace("");
            return;
        }

        setHasError(false);

        try {
            const usable = detectUsableGamut();
            const converted = formatColorOutput(color, usable, options);

            if (!cancelled) {
                setUsedSpace(usable);
                setDisplayColor(converted);
            }
        } catch {
            if (!cancelled) {
                setUsedSpace("");
                setDisplayColor(null);
                setHasError(true);
            }
        }

        return () => {
            cancelled = true;
        };
    }, [color, options, theme]);

    return (
        <section aria-label="Color comparison preview" className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-2">
                <div
                    className="relative h-12 w-full overflow-hidden rounded-xl shadow-sm"
                    aria-label="Device-rendered color input"
                    role="img"
                >
                    <div aria-hidden="true" className="absolute inset-0" style={checkerboardStyle} />

                    <div
                        key={rawInput}
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{ backgroundColor: rawInput }}
                    />
                </div>

                <span className="text-center text-sm">Device-rendered input</span>
            </div>

            <div className="flex flex-col items-center gap-2">
                <div
                    className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl shadow-sm"
                    role="img"
                    aria-label={hasError ? "Invalid color" : `Color rendered in ${usedSpace} space`}
                >
                    <div aria-hidden="true" className="absolute inset-0" style={checkerboardStyle} />

                    <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                            backgroundColor: !hasError && displayColor ? displayColor : "white",
                        }}
                    />

                    {hasError && <span className="relative z-10 text-xs font-bold text-black">Invalid Color</span>}
                </div>

                <span className="text-center text-sm font-medium">
                    {hasError ? "Saturon-converted" : `Saturon-converted (${usedSpace})`}
                </span>
            </div>
        </section>
    );
}
