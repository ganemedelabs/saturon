import { FitMethod } from "saturon/fitMethods";
import { OutputType } from "@/types";

interface OutputOptionsProps {
    outputType: OutputType;
    setOutputType: (val: OutputType) => void; // eslint-disable-line no-unused-vars
    fit: FitMethod;
    setFit: (val: FitMethod) => void; // eslint-disable-line no-unused-vars
    fitOptions: string[];
    precision?: number;
    setPrecision: (val?: number) => void; // eslint-disable-line no-unused-vars
    legacy: boolean;
    setLegacy: (val: boolean) => void; // eslint-disable-line no-unused-vars
    units: boolean;
    setUnits: (val: boolean) => void; // eslint-disable-line no-unused-vars
}

export function OutputOptions({
    outputType,
    setOutputType,
    fit,
    setFit,
    fitOptions,
    precision,
    setPrecision,
    legacy,
    setLegacy,
    units,
    setUnits,
}: OutputOptionsProps) {
    return (
        <>
            <div>
                <label htmlFor="output-type" className="block font-semibold">
                    Data Structure
                </label>
                <p className="text-fd-muted-foreground mb-2 text-sm">Choose how the API formats your color data.</p>
                <select
                    id="output-type"
                    value={outputType}
                    onChange={(e) => setOutputType(e.target.value as OutputType)}
                    className="focus:ring-fd-primary w-full rounded-md border p-2 focus:ring-2"
                >
                    <option value="string">String</option>
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                </select>
            </div>

            <div>
                <label htmlFor="fit-method" className="block font-semibold">
                    Gamut Mapping
                </label>
                <p className="text-fd-muted-foreground my-1 text-sm">
                    Determines how out-of-gamut colors are mapped into visible ranges.
                </p>
                <select
                    id="fit-method"
                    value={fit}
                    onChange={(e) => setFit(e.target.value as FitMethod)}
                    className="focus:ring-fd-primary w-full rounded-md border p-2 focus:ring-2"
                >
                    {fitOptions.map((method) => (
                        <option key={method} value={method}>
                            {method}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="precision" className="block font-semibold">
                    Value Precision
                </label>
                <p className="text-fd-muted-foreground my-1 text-sm">
                    Rounds output channels to a specific decimal place.
                </p>
                <input
                    id="precision"
                    type="number"
                    value={precision !== undefined ? precision : ""}
                    onChange={(e) => setPrecision(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="e.g. 2 (leave empty for auto)"
                    className="focus:ring-fd-primary w-full rounded-md border p-2 focus:ring-2"
                />
            </div>

            {outputType === "string" && (
                <fieldset className="space-y-3">
                    <legend className="font-semibold">String Formatting Options</legend>
                    <div className="flex items-center gap-2">
                        <input
                            id="legacy"
                            type="checkbox"
                            checked={legacy}
                            onChange={(e) => setLegacy(e.target.checked)}
                        />
                        <label htmlFor="legacy" className="mb-0 text-sm">
                            Legacy syntax (comma-separated)
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="units"
                            type="checkbox"
                            checked={units}
                            onChange={(e) => setUnits(e.target.checked)}
                        />
                        <label htmlFor="units" className="mb-0 text-sm">
                            Include suffixes (%, deg)
                        </label>
                    </div>
                </fieldset>
            )}
        </>
    );
}
