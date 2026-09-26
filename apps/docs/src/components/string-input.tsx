interface StringInputProps {
    value: string;
    onChange: (value: string) => void; // eslint-disable-line no-unused-vars
}

export function StringInput({ value, onChange }: StringInputProps) {
    return (
        <div className="space-y-2">
            <label htmlFor="color-input" className="block font-semibold">
                String Input
            </label>
            <p className="text-fd-muted-foreground text-sm">Accepts any valid CSS color string.</p>
            <input
                id="color-input"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g. #ff00ff, red, rgb(255, 100, 0)"
                className="focus:ring-fd-primary w-full rounded-md border p-2 font-mono focus:ring-2 focus:outline-none"
            />
        </div>
    );
}
