import { readFileSync } from "node:fs";
import { run, bench, group, summary, do_not_optimize } from "mitata";

import { Color as Saturon } from "saturon";
import { parse as saturonParse } from "saturon/parse";
import { convert as saturonConvert } from "saturon/convert";
import { format as saturonFormat } from "saturon/format";
import chroma from "chroma-js";
import ColorJS from "colorjs.io";
import color from "color";
import { parse as culoriParse, converter as culoriConverter, formatCss as culoriFormat } from "culori";

const colorStrings = JSON.parse(readFileSync(new URL("./data/colors.json", import.meta.url), "utf8"));
const conversions = JSON.parse(readFileSync(new URL("./data/conversions.json", import.meta.url), "utf8"));

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
const targets = conversions.map(() => MODELS[Math.floor(rand() * MODELS.length)]);

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

        bench("color", () => {
            let sink;
            for (let i = 0; i < colorStrings.length; i++) sink = color(colorStrings[i]).rgb().array();
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
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = new Saturon(model, coords).in(targets[i]);
            }
            return do_not_optimize(sink);
        });

        bench("saturon (utils)", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = saturonConvert({ model, coords }, targets[i]);
            }
            return do_not_optimize(sink);
        });

        bench("chroma-js", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = chroma(coords, model)[targets[i]]();
            }
            return do_not_optimize(sink);
        });

        bench("colorjs.io", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = new ColorJS(colorjsSpace[model], coords).to(colorjsSpace[targets[i]]);
            }
            return do_not_optimize(sink);
        });

        bench("color", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = color(coords, model)[targets[i]]();
            }
            return do_not_optimize(sink);
        });

        bench("culori", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
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
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = new Saturon(model, coords).toString();
            }
            return do_not_optimize(sink);
        });

        bench("saturon (utils)", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = saturonFormat({ model, coords }, model);
            }
            return do_not_optimize(sink);
        });

        bench("chroma-js", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = chroma(coords, model).css(model);
            }
            return do_not_optimize(sink);
        });

        bench("colorjs.io", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = new ColorJS(colorjsSpace[model], coords).toString();
            }
            return do_not_optimize(sink);
        });

        bench("color", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = color(coords, model).string();
            }
            return do_not_optimize(sink);
        });

        bench("culori", () => {
            let sink;
            for (let i = 0; i < conversions.length; i++) {
                const { model, coords } = conversions[i];
                sink = culoriFormat(culoriColor(model, coords));
            }
            return do_not_optimize(sink);
        });
    });
});

await run();
