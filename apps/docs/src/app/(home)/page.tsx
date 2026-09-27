"use client";

import { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { Color } from "saturon";
import { useTheme } from "next-themes";
import { FitMethod } from "saturon/fitMethods";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { ColorModel } from "saturon/converters";
import { RandomOptions } from "saturon/random";
import { generateCodeSnippet, updateSystemColorsFromEnvironment } from "@/lib/utils";
import { ColorPreview } from "@/components/color-preview";
import { InputTab, OutputType } from "@/types.js";
import { RandomInput } from "@/components/random-input";
import { StringInput } from "@/components/string-input";
import { OutputOptions } from "@/components/output-options";
import { DirectInput } from "@/components/direct-input";
import { ConversionResults } from "@/components/conversion-result";
import { Callout } from "fumadocs-ui/components/callout";

export default function Home() {
    const [inputTab, setInputTab] = useState<InputTab>("string");

    const [stringInput, setStringInput] = useState("red");

    const [randomModel, setRandomModel] = useState("undefined");
    const [randomLimits, setRandomLimits] = useState<Record<string, [string, string]>>({});
    const [randomBase, setRandomBase] = useState<Record<string, string>>({});
    const [randomDeviation, setRandomDeviation] = useState<Record<string, string>>({});
    const [randomColor, setRandomColor] = useState<Color | null>(null);
    const [randomError, setRandomError] = useState<string | null>(null);

    const [directModel, setDirectModel] = useState("rgb");
    const [directC1, setDirectC1] = useState(255);
    const [directC2, setDirectC2] = useState(0);
    const [directC3, setDirectC3] = useState(0);
    const [directAlpha, setDirectAlpha] = useState(1);

    const [outputType, setOutputType] = useState<OutputType>("string");
    const [fit, setFit] = useState<FitMethod>("clip");
    const [precision, setPrecision] = useState<number | undefined>(undefined);
    const [legacy, setLegacy] = useState(false);
    const [units, setUnits] = useState(true);

    const [themeTick, setThemeTick] = useState(0);

    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === "system" ? systemTheme : theme;

    useLayoutEffect(() => {
        if (!currentTheme) return;

        Color.configure({ theme: currentTheme as "light" | "dark" });

        const timeoutId = setTimeout(() => {
            updateSystemColorsFromEnvironment();
            setThemeTick((t) => t + 1);
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [currentTheme]);

    const availableTypes = useMemo(() => Color.get("color-models"), []);
    const fitOptions = useMemo(() => Color.get("fit-methods"), []);

    const updateLimit = (channel: string, index: 0 | 1, val: string) => {
        setRandomLimits((prev) => ({
            ...prev,
            [channel]: index === 0 ? [val, prev[channel]?.[1] ?? ""] : [prev[channel]?.[0] ?? "", val],
        }));
    };

    const updateBase = (channel: string, val: string) => {
        setRandomBase((prev) => ({ ...prev, [channel]: val }));
    };

    const updateDeviation = (channel: string, val: string) => {
        setRandomDeviation((prev) => ({ ...prev, [channel]: val }));
    };

    const resetRandomModelDependencies = () => {
        setRandomLimits({});
        setRandomBase({});
        setRandomDeviation({});
    };

    const getCleanRandomOptions = useCallback(() => {
        const cleanLimits = Object.entries(randomLimits).reduce(
            (acc, [k, v]) => {
                const minStr = v[0]?.trim();
                const maxStr = v[1]?.trim();

                if (minStr !== "" || maxStr !== "") {
                    acc[k] = [minStr !== "" ? Number(minStr) : undefined, maxStr !== "" ? Number(maxStr) : undefined];
                }
                return acc;
            },
            {} as Record<string, [number | undefined, number | undefined]>
        );

        const cleanBase = Object.entries(randomBase).reduce(
            (acc, [k, v]) => {
                if (v !== "") acc[k] = Number(v);
                return acc;
            },
            {} as Record<string, number>
        );

        const cleanDeviation = Object.entries(randomDeviation).reduce(
            (acc, [k, v]) => {
                if (v !== "") acc[k] = Number(v);
                return acc;
            },
            {} as Record<string, number>
        );

        return {
            limits: Object.keys(cleanLimits).length > 0 ? cleanLimits : undefined,
            base: Object.keys(cleanBase).length > 0 ? cleanBase : undefined,
            deviation: Object.keys(cleanDeviation).length > 0 ? cleanDeviation : undefined,
        };
    }, [randomBase, randomDeviation, randomLimits]);

    const handleGenerateRandom = useCallback(() => {
        try {
            setRandomError(null);

            const cleanOpts = getCleanRandomOptions();

            const opts: RandomOptions = {
                model: randomModel === "undefined" ? undefined : (randomModel as ColorModel),
                ...cleanOpts,
            };

            setRandomColor(Color.random(opts));
        } catch (err) {
            setRandomError((err as Error).message);
        }
    }, [randomModel, getCleanRandomOptions]);

    const { activeColor, colorError } = useMemo(() => {
        try {
            if (inputTab === "string") {
                return { activeColor: Color.from(stringInput), colorError: null };
            } else if (inputTab === "random") {
                return { activeColor: randomColor, colorError: randomError };
            } else if (inputTab === "direct") {
                return {
                    activeColor: new Color(directModel as ColorModel, [directC1, directC2, directC3, directAlpha]),
                    colorError: null,
                };
            }
        } catch (e) {
            return {
                activeColor: null,
                colorError: (e as Error).message || "Invalid color",
            };
        }
        return { activeColor: null, colorError: null };
    }, [
        inputTab,
        stringInput,
        randomColor,
        randomError,
        directModel,
        directC1,
        directC2,
        directC3,
        directAlpha,
        themeTick,
    ]);

    const rawInputForPreview = useMemo(() => {
        if (inputTab === "string") return stringInput;
        if (activeColor) {
            try {
                return activeColor.toString();
            } catch {
                return "transparent";
            }
        }
        return "transparent";
    }, [inputTab, stringInput, activeColor]);

    const codeSnippet = useMemo(
        () =>
            generateCodeSnippet({
                inputTab,
                stringInput,
                randomModel,
                getCleanRandomOptions,
                directModel,
                directC1,
                directC2,
                directC3,
                directAlpha,
                outputType,
                fit,
                precision,
                legacy,
                units,
            }),
        [
            inputTab,
            stringInput,
            randomModel,
            getCleanRandomOptions,
            directModel,
            directC1,
            directC2,
            directC3,
            directAlpha,
            outputType,
            fit,
            precision,
            legacy,
            units,
        ]
    );

    const { results, tableError } = useMemo(() => {
        if (!activeColor) return { results: [], tableError: colorError };

        try {
            const colorModel = activeColor.model;
            const generated = availableTypes.map((type) => {
                let value: string | Record<string, number> | number[];
                const baseOptions = { fit, precision };

                try {
                    const conversion = activeColor.in(type);

                    if (outputType === "object") {
                        value = conversion.toObject(baseOptions);
                    } else if (outputType === "array") {
                        value = conversion.toArray(baseOptions);
                    } else {
                        value = conversion.toString({
                            ...baseOptions,
                            legacy,
                            units,
                        });
                    }
                } catch (err) {
                    console.error(err);
                    value = "⚠️ Conversion not supported";
                }
                return { type, value, isMatch: type === colorModel };
            });

            return { results: generated, tableError: null };
        } catch (e) {
            return {
                results: [],
                tableError: (e as Error).message || "Invalid color configuration",
            };
        }
    }, [activeColor, colorError, outputType, fit, precision, legacy, units, availableTypes]);

    return (
        <main className="prose mx-auto w-full max-w-7xl p-6" id="main-content">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
                Skip to main content
            </a>

            <h1 tabIndex={-1}>Saturon Playground</h1>
            <p>
                Experiment with color parsing, gamut mapping, and formatting. The code block below updates automatically
                to show you exactly how to achieve the results using the Saturon API.
            </p>

            <div className="block w-full grid-cols-1 gap-8 sm:grid lg:grid-cols-3">
                <section aria-labelledby="input-section" className="col-span-1 my-6 w-full">
                    <h2 id="input-section" className="sr-only">
                        Input configuration
                    </h2>

                    <form
                        aria-describedby="color-input-help"
                        onSubmit={(e) => e.preventDefault()}
                        className="space-y-6"
                    >
                        <div className="rounded-lg border p-3 shadow-sm">
                            <div className="bg-fd-background mb-4 flex rounded-lg border p-1">
                                {(
                                    [
                                        { id: "string", label: "String" },
                                        { id: "random", label: "Random" },
                                        { id: "direct", label: "Direct" },
                                    ] as const
                                ).map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setInputTab(t.id)}
                                        className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                                            inputTab === t.id
                                                ? "bg-fd-primary text-fd-primary-foreground"
                                                : "hover:bg-fd-secondary text-fd-foreground/70"
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {inputTab === "string" && <StringInput value={stringInput} onChange={setStringInput} />}

                            {inputTab === "random" && (
                                <RandomInput
                                    availableTypes={availableTypes}
                                    randomModel={randomModel}
                                    setRandomModel={setRandomModel}
                                    randomLimits={randomLimits}
                                    randomBase={randomBase}
                                    randomDeviation={randomDeviation}
                                    randomError={randomError}
                                    updateLimit={updateLimit}
                                    updateBase={updateBase}
                                    updateDeviation={updateDeviation}
                                    onGenerate={handleGenerateRandom}
                                    onResetModelDependencies={resetRandomModelDependencies}
                                />
                            )}

                            {inputTab === "direct" && (
                                <DirectInput
                                    availableTypes={availableTypes}
                                    model={directModel}
                                    c1={directC1}
                                    c2={directC2}
                                    c3={directC3}
                                    alpha={directAlpha}
                                    onModelChange={setDirectModel}
                                    onC1Change={setDirectC1}
                                    onC2Change={setDirectC2}
                                    onC3Change={setDirectC3}
                                    onAlphaChange={setDirectAlpha}
                                />
                            )}
                        </div>

                        <OutputOptions
                            outputType={outputType}
                            setOutputType={setOutputType}
                            fit={fit}
                            setFit={setFit}
                            fitOptions={fitOptions}
                            precision={precision}
                            setPrecision={setPrecision}
                            legacy={legacy}
                            setLegacy={setLegacy}
                            units={units}
                            setUnits={setUnits}
                        />
                    </form>
                </section>

                <section aria-labelledby="output-section" className="col-span-2 space-y-6">
                    <ColorPreview
                        key={(currentTheme || "light") + themeTick}
                        color={activeColor}
                        rawInput={rawInputForPreview}
                        options={{ fit, precision }}
                        theme={currentTheme}
                    />

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold lg:mt-0">Live API Usage</h2>
                        <DynamicCodeBlock lang="ts" code={codeSnippet} />
                        <Callout type="idea">
                            <p>
                                Use <code>Color.get(&quot;color-models&quot;)</code> to get all the available color
                                models.
                            </p>
                        </Callout>
                    </div>

                    <div>
                        <h2 id="output-section" className="text-xl font-semibold">
                            Model Conversions
                        </h2>
                        <p className="text-fd-muted-foreground text-sm">
                            Showing the configured output mapped across all supported color models.
                        </p>
                    </div>

                    <ConversionResults outputType={outputType} results={results} tableError={tableError} />
                </section>
            </div>
        </main>
    );
}
