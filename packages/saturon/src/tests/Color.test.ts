import { Color } from "../Color.js";
import { type Component } from "../converters.js";
import { type FitMethod } from "../fitMethods.js";

describe("Color", () => {
    it("should define a Color instance in different ways", () => {
        expect(Color.from("red")).toBeInstanceOf(Color);
        expect(new Color("rgb", [233, 45, 92])).toBeInstanceOf(Color);
        expect(new Color("display-p3", [NaN, Infinity, -Infinity])).toBeInstanceOf(Color);
    });

    it("should correctly identify all supported color syntaxes", () => {
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
            ["color(srgb-linear 0.5 0.3 0.2)", "<color()>"],
            ["color(display-p3 0.5 0.34 0.2)", "<color()>"],
            ["color(rec2020 0.5 0.34 0.2)", "<color()>"],
            ["color(a98-rgb 0.5 0.34 0.2)", "<color()>"],
            ["color(prophoto-rgb 0.5 0.34 0.2)", "<color()>"],
            ["color(xyz-d65 0.37 0.4 0.42)", "<color()>"],
            ["color(xyz-d50 0.37 0.4 0.32)", "<color()>"],
            ["color(xyz 0.37 0.4 0.42)", "<color()>"],
            ["red", "<named-color>"],
            ["color-mix(in hsl, red, blue)", "<color-mix()>"],
            ["transparent", "transparent"],
            ["currentColor", "currentColor"],
            ["ButtonText", "<system-color>"],
            ["contrast-color(lime)", "<contrast-color()>"],
            ["device-cmyk(0.1 0.2 0.3 0.4)", "<device-cmyk()>"],
            ["light-dark(green, yellow)", "<light-dark-color>"],
        ];

        cases.forEach(([input, rule]) => {
            expect(Color.isValid(input, { rule })).toBe(true);
        });
    });

    it("should correctly identify relative colors", () => {
        const cases = [
            ["color(from red a98-rgb r g b)", "<color()>"],
            ["color(from red xyz-d50 x y z / alpha)", "<color()>"],
            ["hsl(from red calc(h + s) s l)", "<hsl()>"],
            ["hwb(from red h 50 b / alpha)", "<hwb()>"],
            ["lab(from lch(51.51% 52.21 325.8) l a b)", "<lab()>"],
            ["oklab(from oklch(100% calc(NaN) none) a calc(l * (a + b)) b / calc(alpha))", "<oklab()>"],
        ];

        cases.forEach(([input, rule]) => {
            expect(Color.isValid(input, { rule })).toBe(true);
        });
    });

    it("should regognize color space name in deeply nested color() syntax", () => {
        const color = Color.from("color(from color(from red srgb 1 1 1) srgb-linear r g b)");
        expect(color.model).toBe("srgb-linear");
    });

    it("should return correct coords", () => {
        const cases: [string, number[]][] = [
            ["blanchedalmond", [255, 235, 205, 1]],
            ["#7a7239", [122, 114, 57, 1]],
            ["rgb(68% 16% 50% / 0.3)", [173, 41, 128, 0.3]],
            ["hsla(182, 43%, 33%, 0.8)", [182, 43, 33, 0.8]],
            ["hwb(228 6% 9% / 0.6)", [228, 6, 9, 0.6]],
            ["lab(52.23% 40.16% 59.99% / 0.5)", [52.23, 50.2, 74.9875, 0.5]],
            ["lch(62.23% 59.2% 126.2 / 0.5)", [62.23, 88.8, 126.2, 0.5]],
            ["oklab(42.1% 41% -25% / 0.5)", [0.421, 0.164, -0.1, 0.5]],
            ["oklch(72.32% 0.12% 247.99 / 0.5)", [0.7232, 0.00048, 247.99, 0.5]],
            ["color(srgb 0.7 0.2 0.5 / 0.3)", [0.7, 0.2, 0.5, 0.3]],
            ["color(srgb-linear 0.49 0.04 0.25 / 0.4)", [0.49, 0.04, 0.25, 0.4]],
            ["color(rec2020 0.6 0.3 0.4 / 0.5)", [0.6, 0.3, 0.4, 0.5]],
            ["color(prophoto-rgb 0.8 0.1 0.6 / 0.6)", [0.8, 0.1, 0.6, 0.6]],
            ["color(a98-rgb 0.5 0.4 0.7 / 0.7)", [0.5, 0.4, 0.7, 0.7]],
            ["color(xyz-d65 0.4 0.5 0.2 / 0.8)", [0.4, 0.5, 0.2, 0.8]],
            ["color(xyz-d50 0.3 0.6 0.1 / 0.9)", [0.3, 0.6, 0.1, 0.9]],
            ["color(xyz 0.2 0.7 0.3 / 0.2)", [0.2, 0.7, 0.3, 0.2]],
        ];

        cases.forEach(([input, expected]) => {
            expect(Color.from(input).toArray({ fit: "clip", precision: undefined })).toEqual(expected);
        });
    });

    it("should convert HEX color to RGB", () => {
        expect(Color.from("#ff5733").toString()).toBe("rgb(255 87 51)");
    });

    it("should output with different options", () => {
        const hsl = Color.from("hsl(339 83 46 / 0.5)");
        const lch = Color.from("lch(83 122 270)");
        const oklab = Color.from("oklab(0.18751241 0.22143 -0.398685234)");
        const xyz = Color.from("color(xyz 1.4 0.3 -0.2)");

        expect(hsl.toString({ legacy: true })).toBe("hsla(339, 83%, 46%, 0.5)");
        expect(lch.toString({ units: true })).toBe("lch(83% 122 270deg)");
        expect(oklab.toString({ precision: 1 })).toBe("oklab(0.2 0.2 -0.4)");
        expect(xyz.toString({ fit: "none" })).toBe("color(xyz 1.4 0.3 -0.2)");
    });

    it("should parse deeply nested colors", () => {
        const color = Color.from(`
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
        expect(color.to("hwb")).toBeDefined();

        const getNestedColor = (deepness: number = 1): string => {
            const randomNum = (): number => Math.floor(Math.random() * 49) + 1;
            const randomRgbSpace = (): string =>
                ["srgb", "srgb-linear", "display-p3", "rec2020", "a98-rgb", "prophoto-rgb"][
                    Math.floor(Math.random() * 6)
                ];
            const randomXyzSpace = (): string => ["xyz-d65", "xyz-d50", "xyz"][Math.floor(Math.random() * 3)];
            const randomModel = (): string =>
                ["hsl", "hwb", "lab", "lch", "oklab", "oklch"][Math.floor(Math.random() * 6)];
            const optionalAlpha = () => {
                return Math.random() < 0.5 ? " / alpha" : "";
            };

            const colorFns = [
                (inner: string) => `light-dark(${inner}, ${getNestedColor()})`,
                (inner: string) =>
                    `color-mix(in ${randomModel()}, ${inner} ${randomNum()}%, rebeccapurple ${randomNum()}%)`,
                (inner: string) => `contrast-color(${inner})`,
                (inner: string) => `rgb(from ${inner} r g b${optionalAlpha()})`,
                (inner: string) => `hsl(from ${inner} h s l${optionalAlpha()})`,
                (inner: string) => `hwb(from ${inner} h w b${optionalAlpha()})`,
                (inner: string) => `lab(from ${inner} l a b${optionalAlpha()})`,
                (inner: string) => `lch(from ${inner} l c h${optionalAlpha()})`,
                (inner: string) => `oklab(from ${inner} l a b${optionalAlpha()})`,
                (inner: string) => `oklch(from ${inner} l c h${optionalAlpha()})`,
                (inner: string) => `color(from ${inner} ${randomRgbSpace()} r g b${optionalAlpha()})`,
                (inner: string) => `color(from ${inner} ${randomXyzSpace()} x y z${optionalAlpha()})`,
            ];

            if (deepness <= 0) {
                return `hsl(120deg ${randomNum()}% ${randomNum()}%)`;
            }

            const randomFn = colorFns[Math.floor(Math.random() * colorFns.length)];
            const inner = getNestedColor(deepness - 1);
            return randomFn(inner);
        };

        for (let depth = 1; depth <= 100; depth++) {
            const color = Color.from(getNestedColor(depth));
            expect(color).toBeInstanceOf(Color);
        }
    });

    it("should calculate contrast ratio correctly", () => {
        expect(Color.contrast(Color.from("#fff"), Color.from("#000"))).toBeCloseTo(21);
    });

    it("should determine if a color is cool", () => {
        const color = Color.from("rgb(0, 0, 255)");
        const { h } = color.in("hsl").toObject();
        expect(h > 60 && h < 300).toBe(true);
    });

    it("should determine if a color is warm", () => {
        const color = Color.from("rgb(255, 0, 0)");
        const { h } = color.in("hsl").toObject();
        expect(h <= 60 || h >= 300).toBe(true);
    });

    it("should return random Color instance based on different options", () => {
        const c1 = Color.random();
        expect(c1).toBeInstanceOf(Color);
        expect(typeof c1.model).toBe("string");
        expect(Array.isArray(c1.coords)).toBe(true);

        const c2 = Color.random({ model: "oklch" });
        expect(c2.model).toBe("oklch");
        expect(c2.coords.length).toBe(4);

        const c3 = Color.random({
            model: "oklch",
            limits: { l: [0.4, 0.6] },
        });
        expect(c3.coords[0]).toBeGreaterThanOrEqual(0.4);
        expect(c3.coords[0]).toBeLessThanOrEqual(0.6);

        const samplesBias = Array.from(
            { length: 100 },
            () =>
                Color.random({
                    model: "oklch",
                    bias: { l: (t) => t * (2 - t) }, // ease-out bias
                }).coords[0]
        );
        const avgBias = samplesBias.reduce((a, b) => a + b, 0) / samplesBias.length;
        expect(avgBias).toBeGreaterThan(0.5);

        const base = { l: 0.7, c: 0.2 };
        const deviation = { l: 0.05, c: 0.05 };
        const samplesDev = Array.from({ length: 50 }, () => Color.random({ model: "oklch", base, deviation }).coords);
        const avgL = samplesDev.reduce((a, b) => a + b[0], 0) / samplesDev.length;
        expect(avgL).toBeGreaterThan(0.6);
        expect(avgL).toBeLessThan(0.8);

        const c4 = Color.random({
            model: "lch",
            base: { h: 400 },
            deviation: { h: 10 },
        });
        expect(c4.coords[2]).toBeGreaterThanOrEqual(0);
        expect(c4.coords[2]).toBeLessThanOrEqual(360);

        expect(() =>
            Color.random({
                model: "rgb",
                base: { h: 120 } as Partial<Record<Component<"rgb">, number>>,
            })
        ).toThrow();
    });

    it("should fit color into a supported gamut using default method", () => {
        const color = Color.from("color(display-p3 1.2 -0.3 0.5)");
        expect(color.inGamut("srgb")).toBe(false);

        const fitted = color.within("srgb");
        expect(fitted.model).toBe("display-p3");
        expect(fitted.inGamut("srgb")).toBe(true);
    });

    it("should return true if a color is in gamut", () => {
        expect(Color.from("color(display-p3 1 0 0)").inGamut("srgb")).toBe(false);
        expect(Color.from("color(display-p3 1 0 0)").inGamut("xyz")).toBe(true);
    });

    it("should handle none and calc(NaN) components correctly", () => {
        const color = Color.from("hsl(none calc(NaN) 50%)");
        expect(color.toString()).toBe("hsl(0 0 50)");
        const adjusted = color.with({ h: 150, s: 100 });
        expect(adjusted.toString()).toBe("hsl(150 100 50)");
    });

    it("should handle calc(infinity) components correctly", () => {
        const color = Color.from("hsl(calc(infinity) calc(-infinity) 50%)");
        expect(color.toString()).toBe("hsl(0 0 50)");
        const adjusted = color.with({ h: 100, s: 100 });
        expect(adjusted.toString()).toBe("hsl(100 100 50)");
    });

    it("should return correct component values", () => {
        const color = Color.from("rgb(0, 157, 255)");
        const rgb = color.toObject({ fit: "clip" });
        expect(rgb).toEqual({ r: 0, g: 157, b: 255, alpha: 1 });
    });

    it("should retrieve the correct array of components", () => {
        const color = Color.from("rgb(0, 157, 255)");
        expect(color.toArray({ fit: "clip" })).toEqual([0, 157, 255, 1]);
    });

    it("should clamp component values when getting components", () => {
        const rgbColor = Color.from("rgb(200, 100, 50)").with({ g: 400 });
        const [, g] = rgbColor.toArray({ fit: "clip" });
        expect(g).toBe(255);
    });

    it("should throw an error for an invalid model", () => {
        expect(() => Color.from("rgb(255, 255, 255)").in("invalidModel")).toThrow();
    });

    it("should update multiple components with an object", () => {
        const color = Color.from("hsl(0, 100%, 50%)");
        const updated = color.with({
            h: (h) => h + 50,
            s: (s) => s - 20,
        });
        const [h, s] = updated.toArray({ fit: "clip" });
        expect([h, s]).toStrictEqual([50, 80]);
    });

    it("should update multiple components with an array", () => {
        const color = Color.from("hsl(200 100% 50%)");
        const updated = color.with([undefined, 50, 80]);
        const coords = updated.toArray({ fit: "clip" });
        expect(coords).toStrictEqual([200, 50, 80, 1]);
    });

    it("should adjust opacity correctly", () => {
        const color = Color.from("rgb(120, 20, 170)");
        const adjusted = color.with({ alpha: 0.5 });
        expect(adjusted.toString()).toBe("rgb(120 20 170 / 0.5)");
    });

    it("should adjust saturation correctly", () => {
        const color = Color.from("hsl(120, 80%, 50%)");
        const adjusted = color.with({ s: 10 });
        expect(adjusted.toString({ units: true })).toBe("hsl(120deg 10% 50%)");
    });

    it("should adjust hue correctly", () => {
        const color = Color.from("hsl(30, 100%, 50%)");
        const adjusted = color.with({ h: (h) => h - 70 });
        expect(adjusted.toString({ units: true })).toBe("hsl(320deg 100% 50%)");
    });

    it("should adjust brightness correctly", () => {
        const color = Color.from("hsl(50, 100%, 30%)");
        const adjusted = color.with({ l: 50 });
        expect(adjusted.toString({ units: true })).toBe("hsl(50deg 100% 50%)");
    });

    it("should adjust contrast correctly", () => {
        const color = Color.from("rgb(30, 190, 250)");
        const amount = 2;
        const adjusted = color.with(({ r, g, b }) => [
            (r - 128) * amount + 128,
            (g - 128) * amount + 128,
            (b - 128) * amount + 128,
        ]);
        expect(adjusted.toString()).toBe("rgb(0 252 255)");
    });

    it("should apply sepia filter", () => {
        const color = Color.from("rgb(255, 50, 70)");
        const amount = 1;

        const adjusted = color.with(({ r, g, b }) => ({
            r: r + (0.393 * r + 0.769 * g + 0.189 * b - r) * amount,
            g: g + (0.349 * r + 0.686 * g + 0.168 * b - g) * amount,
            b: b + (0.272 * r + 0.534 * g + 0.131 * b - b) * amount,
        }));

        expect(adjusted.toString()).toBe("rgb(152 135 105)");
    });

    it("should change config correctly", () => {
        const lightDark = "light-dark(red, blue)";
        const systemColor = "LinkText";

        expect(Color.from(lightDark).to("named-color")).toBe("red");
        expect(Color.from(systemColor).toString()).toBe("rgb(0 0 255)");

        Color.configure({ theme: "dark" });

        expect(Color.from(lightDark).to("named-color")).toBe("blue");
        expect(Color.from(systemColor).toString()).toBe("rgb(0 128 255)");

        Color.configure({
            systemColors: {
                LinkText: [
                    [0, 0, 255],
                    [50, 150, 250],
                ],
            },
        });

        expect(Color.from(systemColor).toString()).toBe("rgb(50 150 250)");
    });

    it("should gamut map out-of-gamut sRGB coords consistently", () => {
        const coords = [1.2, -0.3, 0.5];
        const model = "srgb";
        const epsilon = 1e-5;

        const clipCoords = new Color(model, coords).toArray({ fit: "clip" });
        const chromaCoords = new Color(model, coords).toArray({ fit: "chroma-reduction" });
        const cssCoords = new Color(model, coords).toArray({ fit: "css-gamut-map" });

        expect(clipCoords).toEqual([1, 0, 0.5, 1]);
        expect(chromaCoords.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);
        expect(cssCoords.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);

        expect(chromaCoords).not.toEqual(clipCoords);
        expect(cssCoords).not.toEqual(clipCoords);
    });

    it("should leave already in-gamut coords unchanged", () => {
        const fitMethods: FitMethod[] = ["clip", "chroma-reduction", "css-gamut-map"];
        const coords = [0.5, 0.5, 0.5];
        const model = "srgb";

        for (const fit of fitMethods) {
            const fitted = new Color(model, coords).toArray({ fit });
            expect(fitted).toEqual([...coords, 1]);
        }
    });

    it("should gamut map extreme coords differently per method", () => {
        const fitMethods: FitMethod[] = ["clip", "chroma-reduction", "css-gamut-map"];
        const coords = [2, 2, -1];
        const model = "srgb";
        const epsilon = 1e-5;

        const results = fitMethods.map((fit) => new Color(model, coords).toArray({ fit }));

        for (const res of results) {
            expect(res.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);
        }

        expect(new Set(results.map((r) => JSON.stringify(r))).size).toBeGreaterThan(1);
    });

    it("should return Color instance with fitted compnents", () => {
        const color = Color.from("color(display-p3 1.2 -0.3 0.5)");
        const fitted = color.fit({ method: "clip" });
        expect(fitted.model).toBe("display-p3");
        expect(fitted.coords).toEqual([1, 0, 0.5, 1]);
    });

    it("should generate 1000 random colors and validate their string output formats", () => {
        const types = Color.get("output-types").filter((t) => t !== "named-color");
        expect(Array.isArray(types)).toBe(true);
        expect(types.length).toBeGreaterThan(0);

        for (let i = 0; i < 1000; i++) {
            const index = Math.floor(Math.random() * types.length);
            const type = types[index];
            const random = Color.random();
            const str = random.to(type);
            expect(Color.isValid(str)).toBe(true);
        }
    });

    it("should correctly calculate color differences using various delta E methods", () => {
        const red = Color.from("red");
        const blue = Color.from("blue");
        const oklab1 = Color.from("oklab(0.6 0.1 0.1)");
        const oklab2 = Color.from("oklab(0.8 0.1 0.1)");

        expect(Color.deltaE76(red, red)).toBeCloseTo(0);
        expect(Color.deltaE94(red, red)).toBeCloseTo(0);
        expect(Color.deltaE2000(red, red)).toBeCloseTo(0);
        expect(Color.deltaEOK(oklab1, oklab1)).toBeCloseTo(0);

        expect(Color.deltaE76(red, blue)).toBeGreaterThan(180);
        expect(Color.deltaE94(red, blue)).toBeGreaterThan(70);
        expect(Color.deltaE2000(red, blue)).toBeGreaterThan(50);
        expect(Color.deltaEOK(oklab1, oklab2)).toBeGreaterThan(20);
    });

    it("should interpolate between multiple colors using Color.interpolate", () => {
        const black = new Color("srgb", [0, 0, 0, 1]);
        const red = new Color("srgb", [1, 0, 0, 1]);
        const white = new Color("srgb", [1, 1, 1, 1]);

        const int2 = Color.interpolate([black, white], { in: "srgb" });

        const mid2 = int2(0.5);
        expect(mid2.model).toBe("srgb");
        expect(mid2.coords[0]).toBeCloseTo(0.5);
        expect(mid2.coords[1]).toBeCloseTo(0.5);
        expect(mid2.coords[2]).toBeCloseTo(0.5);
        expect(mid2.coords[3]).toBe(1);

        const int3 = Color.interpolate([black, red, white], { in: "srgb" });

        const start = int3(0);
        expect(start.coords).toEqual([0, 0, 0, 1]);

        const mid3 = int3(0.5);
        expect(mid3.coords).toEqual([1, 0, 0, 1]);

        const end = int3(1);
        expect(end.coords).toEqual([1, 1, 1, 1]);
    });

    it("should generate an array of colors using Color.scale", () => {
        const black = new Color("srgb", [0, 0, 0, 1]);
        const white = new Color("srgb", [1, 1, 1, 1]);

        const palette = Color.scale([black, white], { in: "srgb", steps: 3 });

        expect(palette).toHaveLength(3);

        expect(palette[0].model).toBe("srgb");
        expect(palette[0].coords).toEqual([0, 0, 0, 1]);

        expect(palette[1].model).toBe("srgb");
        expect(palette[1].coords[0]).toBeCloseTo(0.5);
        expect(palette[1].coords[1]).toBeCloseTo(0.5);
        expect(palette[1].coords[2]).toBeCloseTo(0.5);
        expect(palette[1].coords[3]).toBe(1);

        expect(palette[2].model).toBe("srgb");
        expect(palette[2].coords).toEqual([1, 1, 1, 1]);
    });

    it("should configure device-cmyk to route through a registered profile's toLab with the correct rendering intent", () => {
        const naive = Color.from("device-cmyk(0.5 0 0.6 0.1)");
        expect(naive.model).toBe("srgb");
        expect(naive.coords).toEqual([
            1 - (0.5 * (1 - 0.1) + 0.1),
            1 - (0 * (1 - 0.1) + 0.1),
            1 - (0.6 * (1 - 0.1) + 0.1),
            1,
        ]);

        const toLab = jest.fn(() => [50, 10, -10]);
        Color.configure({
            colorProfiles: {
                "device-cmyk": {
                    renderingIntent: "perceptual",
                    toLab,
                },
            },
        });

        const resolved = Color.from("device-cmyk(0.5 0 0.6 0.1 / 0.8)");

        expect(Color.config.colorProfiles["device-cmyk"]).toBeDefined();
        expect(toLab).toHaveBeenCalledWith([0.5, 0, 0.6, 0.1], "perceptual");
        expect(resolved.model).toBe("lab");
        expect(resolved.coords).toEqual([50, 10, -10, 0.8]);

        delete Color.config.colorProfiles["device-cmyk"];

        const toLabDefaultIntent = jest.fn(() => [20, 0, 0]);
        Color.configure({
            colorProfiles: {
                "device-cmyk": {
                    toLab: toLabDefaultIntent,
                },
            },
        });

        const resolvedDefaultIntent = Color.from("device-cmyk(0 0 0 1)");

        expect(toLabDefaultIntent).toHaveBeenCalledWith([0, 0, 0, 1], "relative-colorimetric");
        expect(resolvedDefaultIntent.model).toBe("lab");
        expect(resolvedDefaultIntent.coords).toEqual([20, 0, 0, 1]);
    });
});
