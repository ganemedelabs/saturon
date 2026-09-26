import { Dices } from "lucide-react";
import { Color } from "saturon";
import { Callout } from "fumadocs-ui/components/callout";
import { Getter } from "saturon/getters";

interface RandomInputProps {
    availableTypes: string[];
    randomModel: string;
    setRandomModel: (model: string) => void; // eslint-disable-line no-unused-vars
    randomLimits: Record<string, [string, string]>;
    randomBase: Record<string, string>;
    randomDeviation: Record<string, string>;
    randomError: string | null;
    updateLimit: (channel: string, index: 0 | 1, val: string) => void; // eslint-disable-line no-unused-vars
    updateBase: (channel: string, val: string) => void; // eslint-disable-line no-unused-vars
    updateDeviation: (channel: string, val: string) => void; // eslint-disable-line no-unused-vars
    onGenerate: () => void;
    onResetModelDependencies: () => void;
}

export function RandomInput({
    availableTypes,
    randomModel,
    setRandomModel,
    randomLimits,
    randomBase,
    randomDeviation,
    randomError,
    updateLimit,
    updateBase,
    updateDeviation,
    onGenerate,
    onResetModelDependencies,
}: RandomInputProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="select">
                    Model
                </label>
                <select
                    name="model-select"
                    value={randomModel}
                    onChange={(e) => {
                        setRandomModel(e.target.value);
                        onResetModelDependencies();
                    }}
                    className="focus:ring-fd-primary w-full rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
                >
                    <option value="undefined">Any (Undefined)</option>
                    {availableTypes.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
            </div>

            {randomModel !== "undefined" ? (
                <>
                    <div className="overflow-x-auto rounded-md">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr>
                                    <th>Channel</th>
                                    <th>Limits (Min - Max)</th>
                                    <th>Base</th>
                                    <th>Deviation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {((Color.get(`components:${randomModel}` as Getter) as string[]) || []).map(
                                    (channel) => (
                                        <tr key={channel}>
                                            <th>{channel}</th>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        placeholder="Min"
                                                        value={randomLimits[channel]?.[0] ?? ""}
                                                        onChange={(e) => updateLimit(channel, 0, e.target.value)}
                                                        className="focus:ring-fd-primary w-20 rounded-md border p-1.5 text-xs focus:ring-2 focus:outline-none"
                                                    />
                                                    <span className="text-gray-400">-</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Max"
                                                        value={randomLimits[channel]?.[1] ?? ""}
                                                        onChange={(e) => updateLimit(channel, 1, e.target.value)}
                                                        className="focus:ring-fd-primary w-20 rounded-md border p-1.5 text-xs focus:ring-2 focus:outline-none"
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    placeholder="Value"
                                                    value={randomBase[channel] ?? ""}
                                                    onChange={(e) => updateBase(channel, e.target.value)}
                                                    className="focus:ring-fd-primary w-24 rounded-md border p-1.5 text-xs focus:ring-2 focus:outline-none"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    placeholder="Value"
                                                    value={randomDeviation[channel] ?? ""}
                                                    onChange={(e) => updateDeviation(channel, e.target.value)}
                                                    className="focus:ring-fd-primary w-24 rounded-md border p-1.5 text-xs focus:ring-2 focus:outline-none"
                                                />
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Callout type="info" title="Options">
                        <ul>
                            <li>
                                <b>Limits:</b> Sets hard minimum and maximum bounds <code>[min, max]</code> for specific
                                color channels (e.g., restricting light/dark ranges).
                            </li>
                            <li>
                                <b>Base:</b> Sets a target center point for a channel around which values will be
                                randomly generated using a normal distribution.
                            </li>
                            <li>
                                <b>Deviation:</b> Controls how far generated values spread out from the target Base
                                value (standard deviation).
                            </li>
                        </ul>
                    </Callout>
                </>
            ) : (
                <Callout type="info">
                    Select a specific model above to configure detailed channel limits, base, and deviations.
                </Callout>
            )}

            {randomError && <Callout type="error">{randomError}</Callout>}

            <button
                type="button"
                onClick={onGenerate}
                className="bg-fd-primary text-fd-primary-foreground focus:ring-fd-primary hover:bg-fd-primary/90 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors"
            >
                <Dices className="h-4 w-4" /> Generate Color
            </button>
        </div>
    );
}
