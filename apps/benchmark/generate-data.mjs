import { mkdirSync, writeFileSync } from "node:fs";
import { Color } from "saturon";

const COUNT = 10000;

const MODELS = new Set(["rgb", "hsl", "lab", "lch"]);

const MAX_ATTEMPTS = COUNT * 1000;

function collect(build) {
    const out = [];
    let attempts = 0;
    while (out.length < COUNT) {
        if (++attempts > MAX_ATTEMPTS) {
            throw new Error(`Gave up after ${attempts} attempts with only ${out.length}/${COUNT} entries`);
        }
        const color = Color.random();
        if (!MODELS.has(color.model)) continue;
        if (!color.coords.every(Number.isFinite)) continue;
        out.push(build(color));
    }
    return out;
}

const colors = collect((color) => color.toString({ precision: 1, units: true }));

const conversions = collect(({ model, coords }) => ({ model, coords }));

const dataDir = new URL("./data/", import.meta.url);
mkdirSync(dataDir, { recursive: true });
writeFileSync(new URL("colors.json", dataDir), JSON.stringify(colors));
writeFileSync(new URL("conversions.json", dataDir), JSON.stringify(conversions));

console.log(`Wrote ${colors.length} strings to data/colors.json`);
console.log(`Wrote ${conversions.length} entries to data/conversions.json`);
