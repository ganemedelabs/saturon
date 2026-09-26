interface DirectInputProps {
    availableTypes: string[];
    model: string;
    c1: number;
    c2: number;
    c3: number;
    alpha: number;
    onModelChange: (model: string) => void; // eslint-disable-line no-unused-vars
    onC1Change: (val: number) => void; // eslint-disable-line no-unused-vars
    onC2Change: (val: number) => void; // eslint-disable-line no-unused-vars
    onC3Change: (val: number) => void; // eslint-disable-line no-unused-vars
    onAlphaChange: (val: number) => void; // eslint-disable-line no-unused-vars
}

export function DirectInput({
    availableTypes,
    model,
    c1,
    c2,
    c3,
    alpha,
    onModelChange,
    onC1Change,
    onC2Change,
    onC3Change,
    onAlphaChange,
}: DirectInputProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="model-select">
                    Model
                </label>
                <select
                    name="model-select"
                    value={model}
                    onChange={(e) => onModelChange(e.target.value)}
                    className="focus:ring-fd-primary w-full rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
                >
                    {availableTypes.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="c1-input">
                        C1
                    </label>
                    <input
                        name="c1-input"
                        type="number"
                        step="any"
                        value={c1}
                        onChange={(e) => onC1Change(parseFloat(e.target.value) || 0)}
                        className="focus:ring-fd-primary w-full rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="c2-input">
                        C2
                    </label>
                    <input
                        name="c2-input"
                        type="number"
                        step="any"
                        value={c2}
                        onChange={(e) => onC2Change(parseFloat(e.target.value) || 0)}
                        className="focus:ring-fd-primary w-full rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="c3-input">
                        C3
                    </label>
                    <input
                        name="c3-input"
                        type="number"
                        step="any"
                        value={c3}
                        onChange={(e) => onC3Change(parseFloat(e.target.value) || 0)}
                        className="focus:ring-fd-primary w-full rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="alpha-input">
                        Alpha
                    </label>
                    <input
                        name="alpha-input"
                        type="number"
                        step="any"
                        value={alpha}
                        onChange={(e) => onAlphaChange(parseFloat(e.target.value) || 0)}
                        className="focus:ring-fd-primary w-full rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
                    />
                </div>
            </div>
        </div>
    );
}
