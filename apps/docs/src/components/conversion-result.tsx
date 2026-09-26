import { Callout } from "fumadocs-ui/components/callout";
import { ConversionResultItem, OutputType } from "@/types";

interface ConversionResultsProps {
    outputType: OutputType;
    results: ConversionResultItem[];
    tableError: string | null;
}

export function ConversionResults({ outputType, results, tableError }: ConversionResultsProps) {
    if (tableError) {
        return <Callout type="error">{tableError}</Callout>;
    }

    return (
        <div aria-live="polite">
            {outputType === "string" && (
                <div className="overflow-x-auto">
                    <table className="mt-0 w-full table-fixed font-mono text-sm" role="table">
                        <caption className="sr-only">Converted color values as strings</caption>
                        <thead>
                            <tr>
                                <th scope="col" className="w-1/4 text-left">
                                    Target Model
                                </th>
                                <th scope="col" className="w-3/4 text-left">
                                    String Value
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(({ type, value, isMatch }) => (
                                <tr key={type} className={isMatch ? "bg-fd-primary/10" : ""}>
                                    <th className="wrap-break-word" scope="row">
                                        {type}
                                    </th>
                                    <td className="break-all">{String(value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {outputType === "array" && (
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed font-mono text-sm">
                        <caption className="sr-only">Converted color values as numeric arrays</caption>
                        <thead>
                            <tr>
                                <th>Target Model</th>
                                <th>C1</th>
                                <th>C2</th>
                                <th>C3</th>
                                <th>Alpha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(({ type, value, isMatch }) => {
                                const arr = Array.isArray(value) ? value : [];
                                return (
                                    <tr key={type} className={isMatch ? "bg-fd-primary/10" : ""}>
                                        <th scope="row" className="wrap-break-word">
                                            {type}
                                        </th>
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <td key={i}>{arr[i] ?? "—"}</td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {outputType === "object" && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {results.map(({ type, value, isMatch }) => (
                        <article
                            key={type}
                            className={`border-fd-border flex flex-col gap-2 rounded-lg border p-4 shadow-sm ${
                                isMatch ? "bg-fd-primary/10" : ""
                            }`}
                            aria-label={`Color model ${type}`}
                        >
                            <h3 className="mt-0">{type}</h3>
                            {typeof value === "object" && !Array.isArray(value) ? (
                                <table className="w-full font-mono text-sm">
                                    <thead>
                                        <tr>
                                            <th>Channel</th>
                                            <th>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(value).map(([key, val]) => (
                                            <tr key={key}>
                                                <th className="wrap-break-word" scope="row">
                                                    {key}
                                                </th>
                                                <td>{String(val)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div role="note">⚠️ Invalid object data</div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
