"use client";
import { Callout } from "fumadocs-ui/components/callout";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ChromePicker } from "react-color";
import { Color } from "saturon";
import { ColorModel } from "saturon/converters";

export interface MixItemState {
    id: string;
    value: string;
    percentage: number;
}

export interface ColorInputProps {
    item: MixItemState;
    updateItem: (id: string, field: keyof MixItemState, val: string | number) => void; // eslint-disable-line no-unused-vars
    removeItem: (id: string) => void; // eslint-disable-line no-unused-vars
    canDelete: boolean;
}

export interface MixResultProps {
    mixedColor: Color | null;
    mixSpace: ColorModel;
    error: string | null;
}

const colorModels = Color.get("color-models") as string[];
const hueInterpolationMethods = Color.get("hue-interpolation-methods") as string[];

const checkerboardStyle = {
    backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='8' height='8' fill='%23808080' fill-opacity='0.25'/><rect x='8' y='8' width='8' height='8' fill='%23808080' fill-opacity='0.25'/></svg>\")",
};

export function ColorInput({ item, updateItem, removeItem, canDelete }: ColorInputProps) {
    const [showPicker, setShowPicker] = useState(false);

    return (
        <div className="bg-fd-secondary border-fd-border flex items-center gap-2 rounded-lg border p-2">
            <div className="relative">
                <button
                    type="button"
                    className="border-fd-border h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded border"
                    style={checkerboardStyle}
                    onClick={() => setShowPicker(!showPicker)}
                    aria-label="Toggle color picker"
                >
                    <div className="h-full w-full" style={{ backgroundColor: item.value }} />
                </button>

                {showPicker && (
                    <div className="absolute top-full left-0 z-10 mt-2">
                        <div
                            className="fixed inset-0"
                            role="button"
                            tabIndex={0}
                            aria-label="Close color picker"
                            onClick={() => setShowPicker(false)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setShowPicker(false);
                                }
                            }}
                        />
                        <div className="relative">
                            <ChromePicker
                                className="rounded-md p-4 font-mono"
                                color={item.value}
                                onChange={(c) => {
                                    const { r, g, b, a } = c.rgb;
                                    const val = a !== undefined && a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : c.hex;
                                    updateItem(item.id, "value", val);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-1 items-center gap-2">
                <input
                    type="text"
                    value={item.value}
                    onChange={(e) => updateItem(item.id, "value", e.target.value)}
                    className="border-fd-border focus:outline-fd-primary w-full min-w-0 rounded border bg-transparent px-2 py-1 font-mono text-sm"
                />
                <div className="border-fd-border focus-within:ring-fd-primary flex items-center gap-1 rounded border bg-transparent px-2 py-1 font-mono text-sm focus-within:ring-2">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.percentage}
                        onChange={(e) => updateItem(item.id, "percentage", Number(e.target.value))}
                        className="w-12 bg-transparent text-right focus:outline-none"
                    />
                    <span className="text-fd-muted-foreground">%</span>
                </div>
            </div>

            {canDelete && (
                <button
                    onClick={() => removeItem(item.id)}
                    className="border-fd-border text-fd-muted-foreground aspect-square shrink-0 rounded-md border p-2 transition-colors hover:text-red-500 disabled:opacity-50 dark:hover:text-red-400"
                    aria-label="Remove color"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

export function MixResult({ mixedColor, error, mixSpace }: MixResultProps) {
    if (error) {
        return <Callout type="error">{error}</Callout>;
    }

    if (!mixedColor) return null;

    const hexString = mixedColor.to("hex-color");

    return (
        <div className="bg-fd-secondary border-fd-border rounded-xl border p-4">
            <div className="flex items-center gap-4">
                <div
                    className="border-fd-border h-16 w-16 shrink-0 overflow-hidden rounded-md border"
                    style={checkerboardStyle}
                >
                    <div className="h-full w-full" style={{ backgroundColor: hexString }} />
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                    <code className="text-fd-foreground! font-mono text-lg">{hexString}</code>
                    <code className="text-fd-muted-foreground! truncate font-mono text-xs">
                        {mixedColor.to(mixSpace)}
                    </code>
                </div>
            </div>
        </div>
    );
}

export default function InteractiveColorMixer() {
    const [items, setItems] = useState<MixItemState[]>(() => {
        const randomHue = Math.floor(Math.random() * 360);
        const oppositeHue = (randomHue + 180) % 360;

        return [
            {
                id: "1",
                value: new Color("hsl", [randomHue, 100, 50]).to("hex-color"),
                percentage: 50,
            },
            {
                id: "2",
                value: new Color("hsl", [oppositeHue, 100, 50]).to("hex-color"),
                percentage: 50,
            },
        ] as MixItemState[];
    });
    const [mixSpace, setMixSpace] = useState<ColorModel>("oklab");
    const [hueMethod, setHueMethod] = useState<string>("shorter");

    const addColor = () => {
        setItems([
            ...items,
            {
                id: crypto.randomUUID(),
                value: Color.random().to("hex-color"),
                percentage: 50,
            },
        ] as MixItemState[]);
    };

    const updateItem = (id: string, field: keyof MixItemState, val: string | number) => {
        setItems(items.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
    };

    const removeItem = (id: string) => {
        setItems(items.filter((item) => item.id !== id));
    };

    const mixData = useMemo(() => {
        try {
            const parsedColors = items.map((item) => ({
                color: Color.from(item.value),
                percentage: item.percentage / 100,
            }));

            const mixOptions: Record<string, unknown> = { in: mixSpace };
            mixOptions.hue = hueMethod;

            const mixed = Color.mix(parsedColors, mixOptions);
            return { color: mixed, error: null };
        } catch (error) {
            return { color: null, error: (error as Error).message };
        }
    }, [items, mixSpace, hueMethod]);

    const codeSnippet = useMemo(() => {
        const declarations = items.map((item, i) => `const color${i + 1} = Color.from("${item.value}");`).join("\n");

        const mixArrayItems = items
            .map((item, i) => `        { color: color${i + 1}, percentage: ${item.percentage / 100} }`)
            .join(",\n");

        let optionsStr = `in: "${mixSpace}"`;
        optionsStr += `, hue: "${hueMethod}"`;

        return `import { Color } from "saturon";\n\n${declarations}\n\nconst mixed = Color.mix(\n    [\n${mixArrayItems}\n    ],\n    { ${optionsStr} } // Leaving them undefined defaults to { in: "oklab", hue: "shorter" }\n);\n\nconsole.log(mixed.to("hex-color"));`;
    }, [items, mixSpace, hueMethod]);

    return (
        <div className="bg-fd-card border-fd-border text-fd-card-foreground not-prose flex flex-col gap-6 rounded-xl border p-6">
            <h3 className="mt-0 mb-0 text-xl font-semibold">Live Color Mixer</h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" htmlFor="in-select">
                        in
                    </label>
                    <select
                        name="in-select"
                        value={mixSpace}
                        onChange={(e) => setMixSpace(e.target.value as ColorModel)}
                        className="focus:ring-fd-primary bg-fd-secondary border-fd-border w-full rounded-md border p-2 font-mono text-sm focus:ring-2 focus:outline-none"
                    >
                        {colorModels.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" htmlFor="hue-select">
                        hue
                    </label>
                    <select
                        name="hue-select"
                        value={hueMethod}
                        onChange={(e) => setHueMethod(e.target.value)}
                        className="focus:ring-fd-primary bg-fd-secondary border-fd-border w-full rounded-md border p-2 font-mono text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {hueInterpolationMethods.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {items.map((item) => (
                    <ColorInput
                        key={item.id}
                        item={item}
                        updateItem={updateItem}
                        removeItem={removeItem}
                        canDelete={items.length > 2}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={addColor}
                className="bg-fd-primary text-fd-primary-foreground focus:ring-fd-primary hover:bg-fd-primary/90 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
                <Plus className="h-4 w-4" /> Add Color
            </button>

            <div className="mt-2 flex flex-col gap-2">
                <div className="text-sm font-medium">Resulting Mix</div>
                <MixResult mixedColor={mixData.color} error={mixData.error} mixSpace={mixSpace} />
            </div>

            <div className="mt-2 flex flex-col gap-2">
                <div className="text-sm font-medium">Generated Code</div>
                <DynamicCodeBlock lang="ts" code={codeSnippet} />
            </div>
        </div>
    );
}
