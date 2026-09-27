"use client";

import { useEffect, useState } from "react";
import { Color } from "saturon";
import { FormattingOptions } from "saturon/formatters";

const checkerboardStyle = {
    backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='8' height='8' fill='%23ccc'/><rect x='8' y='8' width='8' height='8' fill='%23ccc'/></svg>\")",
};

const RENDER_MODELS = Color.get("color-models");

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
    const [renderModel, setRenderModel] = useState<string>("oklab");
    const [displayColor, setDisplayColor] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!color) {
            setHasError(true);
            setDisplayColor(null);
            return;
        }

        setHasError(false);

        try {
            const converted = color.to(renderModel, options);

            if (!cancelled) {
                setDisplayColor(converted);
            }
        } catch {
            if (!cancelled) {
                setDisplayColor(null);
                setHasError(true);
            }
        }

        return () => {
            cancelled = true;
        };
    }, [color, renderModel, options, theme]);

    return (
        <section aria-label="Color comparison preview" className="grid grid-cols-2 gap-4">
            {/* Device-rendered input */}
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

            {/* Saturon-converted output */}
            <div className="flex flex-col items-center gap-2">
                <div
                    className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl shadow-sm"
                    role="img"
                    aria-label={hasError ? "Invalid color" : "Saturon-converted color"}
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

                <div className="flex items-center gap-1.5">
                    <label htmlFor="render-model-select" className="text-sm">
                        Saturon-converted
                    </label>
                    <select
                        id="render-model-select"
                        value={renderModel}
                        onChange={(e) => setRenderModel(e.target.value)}
                        className="focus:ring-fd-primary rounded-md border p-2 text-sm focus:ring-2"
                    >
                        {RENDER_MODELS.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </section>
    );
}
