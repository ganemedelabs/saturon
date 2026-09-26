"use client";
import { Callout } from "fumadocs-ui/components/callout";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ChromePicker } from "react-color";
import { Color } from "saturon";
import { HueInterpolationMethod } from "saturon/colorMix";
import { ColorModel } from "saturon/converters";

export interface StopState {
    id: string;
    value: string;
}

export interface StopInputProps {
    stop: StopState;
    index: number;
    updateStop: (id: string, val: string) => void; // eslint-disable-line no-unused-vars
    removeStop: (id: string) => void; // eslint-disable-line no-unused-vars
    canDelete: boolean;
}

const colorModels = Color.get("color-models") as string[];
const hueInterpolationMethods = Color.get("hue-interpolation-methods") as string[];
const MIN_STEPS = 2;
const MAX_STEPS = 12;

const checkerboardStyle = {
    backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='8' height='8' fill='%23808080' fill-opacity='0.25'/><rect x='8' y='8' width='8' height='8' fill='%23808080' fill-opacity='0.25'/></svg>\")",
};

export function StopInput({ stop, index, updateStop, removeStop, canDelete }: StopInputProps) {
    const [showPicker, setShowPicker] = useState(false);

    return (
        <div className="bg-fd-secondary border-fd-border flex items-center gap-2 rounded-lg border p-2">
            <div className="relative">
                <button
                    type="button"
                    aria-label={`Pick color for stop ${index}`}
                    className="border-fd-border h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded border"
                    style={checkerboardStyle}
                    onClick={() => setShowPicker((value) => !value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setShowPicker((value) => !value);
                        }
                    }}
                >
                    <span className="block h-full w-full" style={{ backgroundColor: stop.value }} />
                </button>

                {showPicker && (
                    <div className="absolute top-full left-0 z-10 mt-2">
                        <button
                            type="button"
                            aria-label="Close color picker"
                            className="fixed inset-0 border-0 bg-transparent p-0"
                            onClick={() => setShowPicker(false)}
                        />
                        <div className="relative">
                            <ChromePicker
                                className="rounded-md p-4 font-mono"
                                color={stop.value}
                                onChange={(c) => {
                                    const { r, g, b, a } = c.rgb;
                                    const val = a !== undefined && a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : c.hex;
                                    updateStop(stop.id, val);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-1 items-center gap-2">
                <span className="text-fd-muted-foreground w-14 shrink-0 font-mono text-xs">stop {index}</span>
                <input
                    type="text"
                    value={stop.value}
                    onChange={(e) => updateStop(stop.id, e.target.value)}
                    className="border-fd-border focus:outline-fd-primary w-full rounded border bg-transparent px-2 py-1 font-mono text-sm"
                />
            </div>

            {canDelete && (
                <button
                    onClick={() => removeStop(stop.id)}
                    className="border-fd-border text-fd-muted-foreground aspect-square shrink-0 rounded-md border p-2 transition-colors hover:text-red-500 disabled:opacity-50 dark:hover:text-red-400"
                    aria-label="Remove stop"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

export interface SwatchProps {
    color: Color;
    mixSpace: ColorModel;
}

export function Swatch({ color, mixSpace }: SwatchProps) {
    const hex = color.to("hex-color");

    return (
        <div className="group flex min-w-0 flex-1 flex-col gap-2 text-left" aria-label={`Copy ${hex}`}>
            <div
                className="border-fd-border relative aspect-square w-full overflow-hidden rounded-md border"
                style={checkerboardStyle}
            >
                <div className="absolute inset-0" style={{ backgroundColor: hex }} />
            </div>
            <div className="flex flex-col gap-0.5 overflow-hidden">
                <code className="text-fd-foreground! font-mono text-xs leading-snug">{hex}</code>
                <code className="text-fd-muted-foreground! font-mono text-[10px] leading-snug text-wrap">
                    {color.to(mixSpace)}
                </code>
            </div>
        </div>
    );
}

export default function InteractiveColorScale() {
    const [stops, setStops] = useState<StopState[]>(() => {
        const randomHue = Math.floor(Math.random() * 360);
        const oppositeHue = (randomHue + 180) % 360;

        return [
            {
                id: "1",
                value: new Color("hsl", [randomHue, 100, 50]).to("hex-color"),
            },
            {
                id: "2",
                value: new Color("hsl", [oppositeHue, 100, 50]).to("hex-color"),
            },
        ] as StopState[];
    });
    const [mixSpace, setMixSpace] = useState<ColorModel>("oklab");
    const [hueMethod, setHueMethod] = useState<HueInterpolationMethod>("shorter");
    const [steps, setSteps] = useState(5);

    const addStop = () => {
        setStops([...stops, { id: crypto.randomUUID(), value: Color.random().to("hex-color") }] as StopState[]);
    };

    const updateStop = (id: string, val: string) => {
        setStops(stops.map((s) => (s.id === id ? { ...s, value: val } : s)));
    };

    const removeStop = (id: string) => {
        setStops(stops.filter((s) => s.id !== id));
    };

    const clampSteps = (n: number) => Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.round(n) || MIN_STEPS));

    const { palette, error } = useMemo(() => {
        try {
            const parsedColors = stops.map((s) => Color.from(s.value));
            const arr = Color.scale(parsedColors, {
                in: mixSpace,
                hue: hueMethod,
                steps,
            });
            return { palette: arr, error: null as string | null };
        } catch (e) {
            return { palette: null, error: (e as Error).message };
        }
    }, [stops, mixSpace, hueMethod, steps]);

    const codeSnippet = useMemo(() => {
        const declarations = stops.map((s, i) => `const color${i + 1} = Color.from("${s.value}");`).join("\n");
        const colorArgs = stops.map((_, i) => `color${i + 1}`).join(", ");

        const optionsStr = `steps: ${steps}, in: "${mixSpace}", hue: "${hueMethod}"`;

        return `import { Color } from "saturon";\n\n${declarations}\n\nconst palette = Color.scale(\n    [${colorArgs}],\n    { ${optionsStr} } // Leaving them undefined defaults to { steps: 5, in: "oklab", hue: "shorter" }\n);\n\npalette.forEach((color) => console.log(color.to("hex-color")));`;
    }, [stops, mixSpace, hueMethod, steps]);

    return (
        <div className="bg-fd-card border-fd-border text-fd-card-foreground not-prose flex flex-col gap-6 rounded-xl border p-6">
            <h3 className="mt-0 mb-0 text-xl font-semibold">Live Palette Generator</h3>

            <div className="grid grid-cols-3 gap-4">
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
                        onChange={(e) => setHueMethod(e.target.value as HueInterpolationMethod)}
                        className="focus:ring-fd-primary bg-fd-secondary border-fd-border w-full rounded-md border p-2 font-mono text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {hueInterpolationMethods.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" htmlFor="steps-input">
                        steps
                    </label>
                    <input
                        name="steps-input"
                        type="number"
                        min={MIN_STEPS}
                        max={MAX_STEPS}
                        value={steps}
                        onChange={(e) => setSteps(clampSteps(Number(e.target.value)))}
                        className="focus:ring-fd-primary bg-fd-secondary border-fd-border w-full rounded-md border p-2 font-mono text-sm focus:ring-2 focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {stops.map((stop, i) => (
                    <StopInput
                        key={stop.id}
                        stop={stop}
                        index={i}
                        updateStop={updateStop}
                        removeStop={removeStop}
                        canDelete={stops.length > 2}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={addStop}
                className="bg-fd-primary text-fd-primary-foreground focus:ring-fd-primary hover:bg-fd-primary/90 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
                <Plus className="h-4 w-4" /> Add Stop
            </button>

            <div className="mt-2 flex flex-col gap-2">
                <div className="text-sm font-medium">Resulting Palette</div>
                {error ? (
                    <Callout type="error">{error}</Callout>
                ) : (
                    palette && (
                        <div className="flex gap-2">
                            {palette.map((color, i) => (
                                <Swatch key={i} color={color} mixSpace={mixSpace} />
                            ))}
                        </div>
                    )
                )}
            </div>

            <div className="mt-2 flex flex-col gap-2">
                <div className="text-sm font-medium">Generated Code</div>
                <DynamicCodeBlock lang="ts" code={codeSnippet} />
            </div>
        </div>
    );
}
