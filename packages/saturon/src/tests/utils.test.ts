import { parse } from "../parse.js";
import { convert } from "../convert.js";
import { format } from "../format.js";
import { configure } from "../config.js";
import { isValid } from "../isValid.js";
import { toArray } from "../toArray.js";
import { toObject } from "../toObject.js";
import { inGamut, toGamut } from "../gamut.js";
import { random } from "../random.js";
import { ColorModel } from "../converters.js";

describe("Utilities", () => {
    it("should parse strings into { model, coords }", () => {
        const color = parse("red");
        expect(color.model).toBe("rgb");
        expect(Array.isArray(color.coords)).toBe(true);
        expect(color.coords).toHaveLength(4);
        expect(parse("color(display-p3 0.5 0.34 0.2)").model).toBe("display-p3");
        expect(parse("color(from color(from red srgb 1 1 1) srgb-linear r g b)").model).toBe("srgb-linear");
    });

    it("should validate supported color syntaxes", () => {
        const cases = [
            ["#ff5733", "<hex-color>"],
            ["rgb(255, 87, 51)", "<rgb()>"],
            ["hsl(9, 100%, 60%)", "<hsl()>"],
            ["hwb(9 10% 20%)", "<hwb()>"],
            ["lab(53.23288% 80.10933 67.22006)", "<lab()>"],
            ["lch(50% 80% 30)", "<lch()>"],
            ["oklab(59% 0.1 0.1 / 0.5)", "<oklab()>"],
            ["oklch(60% 0.15 50)", "<oklch()>"],
            ["color(srgb 0.88 0.75 0.49)", "<color()>"],
            ["red", "<named-color>"],
            ["color-mix(in hsl, red, blue)", "<color-mix()>"],
            ["transparent", "transparent"],
            ["ButtonText", "<system-color>"],
            ["contrast-color(lime)", "<contrast-color()>"],
            ["light-dark(green, yellow)", "<light-dark-color>"],
            ["hsl(from red calc(h + s) s l)", "<hsl()>"],
            ["color(from red xyz-d50 x y z / alpha)", "<color()>"],
        ];

        cases.forEach(([input, rule]) => {
            expect(isValid(input, { rule })).toBe(true);
        });

        expect(isValid("not a color")).toBe(false);
    });

    it("should return correct coords", () => {
        const cases: [string, number[]][] = [
            ["blanchedalmond", [255, 235, 205, 1]],
            ["#7a7239", [122, 114, 57, 1]],
            ["rgb(68% 16% 50% / 0.3)", [173, 41, 128, 0.3]],
            ["hsla(182, 43%, 33%, 0.8)", [182, 43, 33, 0.8]],
            ["lab(52.23% 40.16% 59.99% / 0.5)", [52.23, 50.2, 74.9875, 0.5]],
            ["oklab(42.1% 41% -25% / 0.5)", [0.421, 0.164, -0.1, 0.5]],
            ["color(srgb 0.7 0.2 0.5 / 0.3)", [0.7, 0.2, 0.5, 0.3]],
            ["color(xyz 0.2 0.7 0.3 / 0.2)", [0.2, 0.7, 0.3, 0.2]],
        ];

        cases.forEach(([input, expected]) => {
            expect(toArray(parse(input), { fit: "clip", precision: undefined })).toEqual(expected);
        });
    });

    it("should convert HEX color to RGB string", () => {
        expect(format(parse("#ff5733"), "rgb")).toBe("rgb(255 87 51)");
    });

    it("should convert between models", () => {
        const rgb = parse("rgb(0, 0, 255)");
        const converted = convert(rgb, "hsl");
        const { h } = toObject<"hsl">({ model: "hsl", coords: converted }, { fit: "clip" });
        expect(h > 60 && h < 300).toBe(true);

        expect(() => convert(parse("rgb(255, 255, 255)"), "invalidModel" as ColorModel)).toThrow();
    });

    it("should output strings with different options", () => {
        const hsl = parse("hsl(339 83 46 / 0.5)");
        const lch = parse("lch(83 122 270)");
        const oklab = parse("oklab(0.18751241 0.22143 -0.398685234 / 0.5432)");
        const xyz = parse("color(xyz 1.4 0.3 -0.2)");

        expect(format(hsl, "hsl", { legacy: true })).toBe("hsla(339, 83%, 46%, 0.5)");
        expect(format(lch, "lch", { units: true })).toBe("lch(83% 122 270deg)");
        expect(format(oklab, "oklab", { precision: 1 })).toBe("oklab(0.2 0.2 -0.4 / 0.5)");
        expect(format(oklab, "oklab", { precision: undefined })).toBe("oklab(0.18751 0.22143 -0.39869 / 0.543)");
        expect(format(oklab, "oklab", { precision: null })).toBe("oklab(0.18751241 0.22143 -0.398685234 / 0.5432)");
        expect(format(xyz, "xyz", { fit: "none" })).toBe("color(xyz 1.4 0.3 -0.2)");
    });

    it("should output array and object with different options", () => {
        const oklab = parse("oklab(0.18751241 0.22143 -0.398685234 / 0.5432)");
        const xyz = parse("color(xyz 1.4 0.3 -0.2)");

        expect(toArray(oklab, { precision: 1 })).toEqual([0.2, 0.2, -0.4, 0.5]);
        expect(toArray(oklab, { precision: null })).toEqual([0.18751241, 0.22143, -0.398685234, 0.5432]);
        expect(toArray(xyz, { fit: "none" })).toEqual([1.4, 0.3, -0.2, 1]);

        expect(toObject(oklab, { precision: 1 })).toEqual({ l: 0.2, a: 0.2, b: -0.4, alpha: 0.5 });
        expect(toObject(xyz, { fit: "none" })).toEqual({ x: 1.4, y: 0.3, z: -0.2, alpha: 1 });
    });

    it("should handle none, calc(NaN) and calc(infinity) components", () => {
        expect(format(parse("hsl(none calc(NaN) 50%)"), "hsl")).toBe("hsl(0 0 50)");
        expect(format(parse("hsl(calc(infinity) calc(-infinity) 50%)"), "hsl")).toBe("hsl(0 0 50)");
    });

    it("should parse deeply nested colors", () => {
        const color = parse(`
            color-mix(
                in oklch longer hue,
                color(
                    from hsl(240deg none calc(-infinity) / 0.5)
                    display-p3
                    r calc(g + b) 100 / alpha
                ),
                rebeccapurple 20%
            )
        `);
        expect(convert(color, "hwb")).toBeDefined();
    });

    it("should mix colors", () => {
        const mixed = parse("color-mix(in srgb, red, blue)");
        expect(mixed).toBeDefined();
        expect(mixed.coords).toHaveLength(4);
    });

    it("should check and fit gamut", () => {
        const color = parse("color(display-p3 1.2 -0.3 0.5)");
        expect(inGamut(color, "srgb")).toBe(false);

        const fitted = toGamut(color, "srgb");
        expect(inGamut({ model: "display-p3", coords: fitted }, "srgb")).toBe(true);

        expect(inGamut(parse("color(display-p3 1 0 0)"), "srgb")).toBe(false);
        expect(inGamut(parse("color(display-p3 1 0 0)"), "xyz")).toBe(true);
    });

    it("should gamut map out-of-gamut coords with different fit methods", () => {
        const color = { model: "srgb" as ColorModel, coords: [1.2, -0.3, 0.5, 1] };
        const epsilon = 1e-5;

        const clip = toArray(color, { fit: "clip" });
        const chroma = toArray(color, { fit: "chroma-reduction" });
        const css = toArray(color, { fit: "css-gamut-map" });

        expect(clip).toEqual([1, 0, 0.5, 1]);
        expect(chroma.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);
        expect(css.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);
        expect(chroma).not.toEqual(clip);
        expect(css).not.toEqual(clip);
    });

    it("should return random colors based on options", () => {
        const c1 = random();
        expect(typeof c1.model).toBe("string");
        expect(Array.isArray(c1.coords)).toBe(true);

        const c2 = random({ model: "oklch" });
        expect(c2.model).toBe("oklch");
        expect(c2.coords).toHaveLength(4);

        const c3 = random({ model: "oklch", limits: { l: [0.4, 0.6] } });
        expect(c3.coords[0]).toBeGreaterThanOrEqual(0.4);
        expect(c3.coords[0]).toBeLessThanOrEqual(0.6);

        expect(() => random({ model: "rgb" as "hsl", base: { h: 120 } })).toThrow();
    });

    it("should generate random colors whose string output is valid", () => {
        const types = ["hex-color", "rgb", "hsl", "hwb", "lab", "lch", "oklab", "oklch"] as const;

        for (let i = 0; i < 1000; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const str = format(random(), type);
            expect(isValid(str as string)).toBe(true);
        }
    });

    it("should change config correctly", () => {
        const lightDark = "light-dark(red, blue)";
        const systemColor = "LinkText";

        expect(format(parse(lightDark), "named-color")).toBe("red");
        expect(format(parse(systemColor), "rgb")).toBe("rgb(0 0 255)");

        configure({ theme: "dark" });

        expect(format(parse(lightDark), "named-color")).toBe("blue");
        expect(format(parse(systemColor), "rgb")).toBe("rgb(0 128 255)");

        configure({
            systemColors: {
                LinkText: [
                    [0, 0, 255],
                    [50, 150, 250],
                ],
            },
        });

        expect(format(parse(systemColor), "rgb")).toBe("rgb(50 150 250)");
    });

    it("should route device-cmyk through a registered profile's toLab", () => {
        const toLab = jest.fn(() => [50, 10, -10]);
        configure({
            colorProfiles: {
                "device-cmyk": { renderingIntent: "perceptual", toLab },
            },
        });

        const resolved = parse("device-cmyk(0.5 0 0.6 0.1 / 0.8)");

        expect(toLab).toHaveBeenCalledWith([0.5, 0, 0.6, 0.1], "perceptual");
        expect(resolved.model).toBe("lab");
        expect(resolved.coords).toEqual([50, 10, -10, 0.8]);
    });
});
