import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run, bench, group, summary, do_not_optimize } from "mitata";

import { Color } from "saturon";
import { Color as Saturon } from "saturon";
import { parse as saturonParse } from "saturon/parse";
import { convert as saturonConvert } from "saturon/convert";
import { format as saturonFormat } from "saturon/format";
import chroma from "chroma-js";
import ColorJS from "colorjs.io";
import { parse as culoriParse, converter as culoriConverter, formatCss as culoriFormat } from "culori";

const COUNT = 10000;
const MODELS_SET = new Set(["rgb", "hsl", "lab", "lch"]);
const MAX_ATTEMPTS = COUNT * 1000;

function collect(build) {
    const out = [];
    let attempts = 0;
    while (out.length < COUNT) {
        if (++attempts > MAX_ATTEMPTS) {
            throw new Error(`Gave up after ${attempts} attempts with only ${out.length}/${COUNT} entries`);
        }
        const randColor = Color.random();
        if (!MODELS_SET.has(randColor.model)) continue;
        if (!randColor.coords.every(Number.isFinite)) continue;
        out.push(build(randColor));
    }
    return out;
}

console.log("Generating benchmark dataset in memory...");
const colors = collect((c) => c.toString({ precision: 1, units: true }));
const conversions = collect(({ model, coords }) => ({ model, coords }));

const tempDir = join(tmpdir(), `saturon-bench-${Date.now()}`);
mkdirSync(tempDir, { recursive: true });

const colorsPath = join(tempDir, "colors.json");
const conversionsPath = join(tempDir, "conversions.json");

writeFileSync(colorsPath, JSON.stringify(colors));
writeFileSync(conversionsPath, JSON.stringify(conversions));

const colorStrings = JSON.parse(readFileSync(colorsPath, "utf8"));
const benchConversions = JSON.parse(readFileSync(conversionsPath, "utf8"));

const MODELS = ["rgb", "hsl", "lab", "lch"];

function mulberry32(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(42);
const targets = benchConversions.map(() => MODELS[Math.floor(rand() * MODELS.length)]);

const colorjsSpace = { rgb: "srgb", hsl: "hsl", lab: "lab", lch: "lch" };
const culoriChannels = { rgb: "rgb", hsl: "hsl", lab: "lab", lch: "lch" };
const culoriTo = Object.fromEntries(MODELS.map((m) => [m, culoriConverter(m)]));

function culoriColor(model, [a, b, c]) {
    const ch = culoriChannels[model];
    return { mode: model, [ch[0]]: a, [ch[1]]: b, [ch[2]]: c };
}

summary(() => {
    group("parse: color string -> numbers", () => {
        bench("saturon (class)", () => {
            let sink;
            for (let i = 0; i < colorStrings.length; i++) sink = Saturon.from(colorStrings[i]).coords;
            return do_not_optimize(sink);
        });

        bench("saturon (utils)", () => {
            let sink;
            for (let i = 0; i < colorStrings.length; i++) sink = saturonParse(colorStrings[i]).coords;
            return do_not_optimize(sink);
        });

        bench("chroma-js", () => {
            let sink;
            for (let i = 0; i < colorStrings.length; i++) sink = chroma(colorStrings[i]).rgba();
            return do_not_optimize(sink);
        });

        bench("colorjs.io", () => {
            let sink;
            for (let i = 0; i < colorStrings.length; i++) sink = new ColorJS(colorStrings[i]).coords;
            return do_not_optimize(sink);
        });

        bench("culori", () => {
            let sink;
            for (let i = 0; i < colorStrings.length; i++) sink = culoriParse(colorStrings[i]);
            return do_not_optimize(sink);
        });
    });
});

summary(() => {
    group("convert: { model, coords } -> random target model", () => {
        bench("saturon (class)", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = new Saturon(model, coords).in(targets[i]);
            }
            return do_not_optimize(sink);
        });

        bench("saturon (utils)", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = saturonConvert({ model, coords }, targets[i]);
            }
            return do_not_optimize(sink);
        });

        bench("chroma-js", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = chroma(coords, model)[targets[i]]();
            }
            return do_not_optimize(sink);
        });

        bench("colorjs.io", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = new ColorJS(colorjsSpace[model], coords).to(colorjsSpace[targets[i]]);
            }
            return do_not_optimize(sink);
        });

        bench("culori", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = culoriTo[targets[i]](culoriColor(model, coords));
            }
            return do_not_optimize(sink);
        });
    });
});

summary(() => {
    group("stringify: { model, coords } -> CSS string", () => {
        bench("saturon (class)", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = new Saturon(model, coords).toString();
            }
            return do_not_optimize(sink);
        });

        bench("saturon (utils)", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = saturonFormat({ model, coords }, model);
            }
            return do_not_optimize(sink);
        });

        bench("chroma-js", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = chroma(coords, model).css(model);
            }
            return do_not_optimize(sink);
        });

        bench("colorjs.io", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                const alpha = coords[3] !== undefined ? coords[3] : 1;
                sink = new ColorJS(colorjsSpace[model], coords.slice(0, 3), { alpha }).toString();
            }
            return do_not_optimize(sink);
        });

        bench("culori", () => {
            let sink;
            for (let i = 0; i < benchConversions.length; i++) {
                const { model, coords } = benchConversions[i];
                sink = culoriFormat(culoriColor(model, coords));
            }
            return do_not_optimize(sink);
        });
    });
});

await run();

try {
    rmSync(tempDir, { recursive: true, force: true });
} catch {} // eslint-disable-line no-empty
