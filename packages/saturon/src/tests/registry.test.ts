import { Color } from "../Color.js";
import { MATRICES } from "../matrices.js";
import { ColorModel, ColorModelConverter, colorModels, ColorSpace, multiplyMatrices } from "../converters.js";
import { fit, FitMethod } from "../fitMethods.js";
import { parseNode, ParseNode } from "../syntax.js";
import { inGamut } from "../gamut.js";
import { convert } from "../convert.js";
import { toArray } from "../toArray.js";

describe("Color registration system", () => {
    it("should register multiple custom named colors and convert correctly", () => {
        const namedColors = [
            { name: "Dusk Mint", value: [123, 167, 151] },
            { name: "Twilight Coral", value: [220, 128, 144] },
            { name: "Moonstone Blue", value: [115, 166, 213] },
            { name: "Sunset Amber", value: [255, 183, 77] },
            { name: "Forest Whisper", value: [34, 139, 97] },
            { name: "Slate Blue Gray", value: [115, 124, 161] },
        ];

        Color.register(
            "named-colors",
            namedColors.map(({ name, value }) => ({ name, value }))
        );

        namedColors.forEach(({ value, name }) => {
            const normalizedName = name.replace(/\s+/g, "").toLowerCase();
            expect(Color.from(`rgb(${value.join(" ")})`).to("named-color")).toBe(normalizedName);
        });
    });

    it("should register a color space for <color()> function", () => {
        /**
         * @see {@link https://www.w3.org/TR/css-color-hdr-1/|CSS Color HDR Module Level 1}
         */
        Color.register("color-spaces", [
            {
                name: "rec2100-hlg",
                value: {
                    components: ["r", "g", "b", "alpha"],
                    bridge: "xyz-d65",
                    toLinear: (c: number) => {
                        const a = 0.17883277;
                        const b = 1 - 4 * a;
                        const c1 = 0.5 - a * Math.log(4 * a);
                        if (c <= 0.5) return c ** 2 / 3;
                        return (Math.exp((c - c1) / a) + b) / 12;
                    },
                    fromLinear: (E: number) => {
                        const a = 0.17883277;
                        const b = 1 - 4 * a;
                        const c1 = 0.5 - a * Math.log(4 * a);
                        const sign = E < 0 ? -1 : 1;
                        const absE = Math.abs(E);
                        if (absE <= 1 / 12) return sign * Math.sqrt(3 * absE);
                        return sign * (a * Math.log(12 * absE - b) + c1);
                    },
                    toBridgeMatrix: MATRICES.REC2020_to_XYZD65,
                    fromBridgeMatrix: MATRICES.XYZD65_to_REC2020,
                },
            },
        ]);

        const rec2100 = Color.from("color(rec2100-hlg none calc(-infinity) 100%)");
        expect(rec2100.toArray()).toEqual([0, 0, 1, 1]);
        expect(() => rec2100.with({ r: 0 }).to("xyz-d65")).not.toThrow();

        const instance = new Color("rec2100-hlg" as ColorModel, [NaN, -Infinity, Infinity]);
        expect(instance.toArray()).toEqual([0, 0, 1, 1]);

        const relative = "color(from color(rec2100-hlg 0.7 0.3 0.1) rec2100-hlg r g b)";
        expect(Color.isValid(relative, { rule: "<color()>" }));

        const colorMix = "color-mix(in rec2100-hlg, red, blue)";
        expect(Color.isValid(colorMix, { rule: "<color-mix()>" }));

        const outOfSrgb = Color.from("color(rec2100-hlg 0 1 0)");
        expect(outOfSrgb.inGamut("srgb")).toBe(false);
        expect(outOfSrgb.inGamut("rec2100-hlg")).toBe(true);
    });

    it("should register a <color-function>", () => {
        /**
         * @see {@link https://www.color.org/hdr/04-Timo_Kunkel.pdf|The Perceptual Quantizer}
         */
        Color.register("color-spaces", [
            {
                name: "rec2100-pq",
                value: {
                    components: ["r", "g", "b", "alpha"],
                    bridge: "xyz-d65",
                    toLinear: (c: number) => {
                        const ninv = 2 ** 14 / 2610;
                        const minv = 2 ** 5 / 2523;
                        const c1 = 3424 / 2 ** 12;
                        const c2 = 2413 / 2 ** 7;
                        const c3 = 2392 / 2 ** 7;
                        const x = Math.pow(Math.max(Math.pow(c, minv) - c1, 0) / (c2 - c3 * Math.pow(c, minv)), ninv);
                        const Yw = 203;
                        return (x * 10000) / Yw;
                    },
                    fromLinear: (c: number) => {
                        const Yw = 203;
                        const x = (c * Yw) / 10000;
                        const n = 2610 / 2 ** 14;
                        const m = 2523 / 2 ** 5;
                        const c1 = 3424 / 2 ** 12;
                        const c2 = 2413 / 2 ** 7;
                        const c3 = 2392 / 2 ** 7;
                        return Math.pow((c1 + c2 * Math.pow(x, n)) / (1 + c3 * Math.pow(x, n)), m);
                    },
                    toBridgeMatrix: MATRICES.REC2020_to_XYZD65,
                    fromBridgeMatrix: MATRICES.XYZD65_to_REC2020,
                },
            },
        ]);

        const m1 = 2610 / 16384;
        const m2 = (2523 / 4096) * 128;
        const c1 = 3424 / 4096;
        const c2 = (2413 / 4096) * 32;
        const c3 = (2392 / 4096) * 32;

        /**
         * @see {@link https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BT.2390-8-2020-PDF-E.pdf|High dynamic range television for production and international}
         */
        Color.register("color-models", [
            {
                name: "ictcp",
                value: {
                    components: {
                        i: { index: 0, value: [0, 1], precision: 5 },
                        ct: { index: 1, value: [-1, 1], precision: 5 },
                        cp: { index: 2, value: [-1, 1], precision: 5 },
                        alpha: { index: 3, value: [0, 1], precision: 5 },
                    },
                    bridge: "rec2100-pq",
                    fromBridge: ([R, G, B]: number[]) => {
                        const pqOETF = (x: number) => {
                            const xp = Math.pow(x, m1);
                            return Math.pow((c1 + c2 * xp) / (1 + c3 * xp), m2);
                        };
                        const RGB_to_LMS = [
                            [1688 / 4096, 2146 / 4096, 262 / 4096],
                            [683 / 4096, 2951 / 4096, 462 / 4096],
                            [99 / 4096, 309 / 4096, 3688 / 4096],
                        ];
                        const LMSp_to_ICTCP = [
                            [2048 / 4096, 2048 / 4096, 0 / 4096],
                            [6610 / 4096, -13613 / 4096, 7003 / 4096],
                            [17933 / 4096, -17390 / 4096, -543 / 4096],
                        ];
                        const LMS = multiplyMatrices(RGB_to_LMS, [R, G, B]);
                        const LMSp = LMS.map(pqOETF);
                        const ICTCP = multiplyMatrices(LMSp_to_ICTCP, LMSp);
                        return ICTCP;
                    },
                    toBridge: ([I, Ct, Cp]: number[]) => {
                        const pqEOTF = (y: number) => {
                            const yp = Math.pow(y, 1 / m2);
                            return Math.pow(Math.max(yp - c1, 0) / (c2 - c3 * yp), 1 / m1);
                        };
                        const ICTCP_to_LMSp = [
                            [1.0, 0.00860903703704, 0.111029625],
                            [1.0, -0.00860903703704, -0.111029625],
                            [1.0, 0.56003133501049, -0.32062717499839],
                        ];
                        const LMS_to_RGB = [
                            [3.43660668650384, -2.50645211965619, 0.06984543315235],
                            [-0.791329556583, 1.98360045251401, -0.19227089593101],
                            [0.02594989937188, -0.09891371469193, 1.07296381532005],
                        ];
                        const LMSp = multiplyMatrices(ICTCP_to_LMSp, [I, Ct, Cp]);
                        const LMS = LMSp.map(pqEOTF);
                        const RGB = multiplyMatrices(LMS_to_RGB, LMS);
                        return RGB.map((v) => Math.min(1, Math.max(0, v)));
                    },
                },
            },
        ]);

        const ictcp = Color.from("ictcp(none calc(-infinity) 100%)");
        expect(ictcp.toArray()).toEqual([0, -1, 1, 1]);
        expect(() => ictcp.with({ cp: 0 }).to("rgb")).not.toThrow();

        const instance = new Color("ictcp" as ColorModel, [NaN, -Infinity, Infinity]);
        expect(instance.toArray()).toEqual([0, -1, 1, 1]);

        const relative = "ictcp(from ictcp(0.5 0.3 -0.2) i ct cp)";
        expect(Color.isValid(relative, { rule: "<ictcp()>" }));

        const colorMix = "color-mix(in ictcp, red, blue)";
        expect(Color.isValid(colorMix, { rule: "<color-mix()>" }));

        const outOfSrgb = Color.from("ictcp(0.8 -0.4 -0.1)");
        expect(outOfSrgb.inGamut("srgb")).toBe(false);
        expect(outOfSrgb.inGamut("rec2020")).toBe(true);
    });

    it("should register a new <color> syntax", () => {
        Color.register("parsers", [
            {
                name: "<color-at-time>",
                value: { rule: "<percentage [0,100]> | <number [0,1]>" },
            },
            {
                name: "<color-at()>",
                value: {
                    appendTo: "<color>",
                    rule: `color-at( [ <color-at-time> <color> ]# )`,
                    parse: (node) => {
                        const children = node.value;
                        const stops = [];

                        for (let i = 2; i < children.length; i++) {
                            const current = children[i] as ParseNode;

                            if (current.type === "symbol" && (current.value === "," || current.value === ")")) {
                                continue;
                            }

                            if (current.type === "<color-at-time>") {
                                const timeNode = current.value[0] as ParseNode;
                                const valStr = String(timeNode.value);

                                const progress =
                                    timeNode.type === "<percentage>" ? parseFloat(valStr) / 100 : parseFloat(valStr);

                                i++;
                                const colorNode = children[i] as ParseNode;

                                if (colorNode && colorNode.type === "<color>") {
                                    stops.push({ progress, node: colorNode });
                                }
                            }
                        }

                        if (stops.length === 0) {
                            throw new Error("color-at() must contain at least one valid progress and color stop.");
                        }

                        stops.sort((a, b) => a.progress - b.progress);

                        const now = new Date();
                        const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                        const currentProgress = secondsSinceMidnight / 86400;

                        let activeNode = stops[stops.length - 1].node;

                        for (const stop of stops) {
                            if (currentProgress >= stop.progress) {
                                activeNode = stop.node;
                            } else {
                                break;
                            }
                        }

                        return parseNode(activeNode);
                    },
                },
            },
        ]);

        const timed = "color-at(0.25 skyblue, 0.5 gold, 0.7 orangered, 0.8 midnightblue)";
        const value = Color.from(timed).to("named-color");
        expect(["skyblue", "gold", "orangered", "midnightblue"].includes(value)).toBe(true);

        const complex = `
            color-at(
                25% rgb(135, 206, 235),                  /* 06:00 */
                33.33% hsl(195 53% 79%),                 /* 08:00 */
                41.67% hwb(203 53% 2%),                  /* 10:00 */
                50% lab(51.98 -8.36 -32.83),             /* 12:00 */
                58.33% lch(58.36 64.78 270.78),          /* 14:00 */
                66.67% oklab(0.79 0.05 0.16),            /* 16:00 */
                75% oklch(0.69 0.19 32.32),              /* 18:00 */
                83.33% color(srgb 0.09 0.09 0.43),       /* 20:00 */
                91.67% color(display-p3 0.02 0.04 0.05)  /* 22:00 */
            )
        `;
        expect(Color.isValid(complex, { rule: "<color-at()>" }));
    });

    it("should register custom color formatters", () => {
        Color.register("formatters", [
            {
                name: "fluid-volume",
                value: {
                    bridge: "srgb",
                    fromBridge: (coords: number[]) => coords,
                    format: (coords: number[]) => {
                        const r = Math.round(coords[0] * 255);
                        const g = Math.round(coords[1] * 255);
                        const b = Math.round(coords[2] * 255);
                        const sum = r + g + b;

                        if (sum === 0) return "fluid-volume()";

                        const targetLength = 20;
                        const rChars = "R".repeat(Math.round((r / sum) * targetLength));
                        const gChars = "G".repeat(Math.round((g / sum) * targetLength));
                        const bChars = "B".repeat(Math.round((b / sum) * targetLength));

                        return `fluid-volume(${rChars}${gChars}${bChars})`;
                    },
                },
            },
        ]);
        const purGreen = new Color("rgb", [0, 255, 0]);
        expect(purGreen.to("fluid-volume")).toBe("fluid-volume(GGGGGGGGGGGGGGGGGGGG)");

        const magenta = new Color("rgb", [255, 0, 255]);
        expect(magenta.to("fluid-volume")).toBe("fluid-volume(RRRRRRRRRRBBBBBBBBBB)");

        const white = new Color("rgb", [255, 255, 255]);
        expect(white.to("fluid-volume")).toBe("fluid-volume(RRRRRRRGGGGGGGBBBBBBB)");

        const gray = new Color("rgb", [128, 128, 128]);
        expect(gray.to("fluid-volume")).toBe("fluid-volume(RRRRRRRGGGGGGGBBBBBBB)");

        const black = new Color("rgb", [0, 0, 0]);
        expect(black.to("fluid-volume")).toBe("fluid-volume()");

        const orange = new Color("srgb", [255, 128, 0]); // sum = 255 + 128 = 383
        // R ratio: 255/383 * 20 ≈ 13.31 -> 13 chars
        // G ratio: 128/383 * 20 ≈ 6.68 -> 7 chars
        expect(orange.to("fluid-volume")).toBe("fluid-volume(RRRRRRRRRRRRRGGGGGGG)");
    });

    it("should register parser shortcuts", () => {
        Color.register("shortcuts", [
            {
                name: "<rgb()>",
                value: {
                    appendTo: undefined,
                    parse: (str: string) => {
                        if (str.startsWith("rgb(") && str.endsWith(")")) {
                            return { model: "rgb", coords: [0, 0, 0, 0] };
                        }
                        return null;
                    },
                },
            },
            {
                name: "<test-rule>",
                value: {
                    appendTo: "<color>",
                    parse: (str: string) => {
                        if (str === "test") {
                            return { model: "rgb", coords: [NaN, NaN, NaN] };
                        }
                        return null;
                    },
                },
            },
        ]);

        const rgbShortcut = Color.from("rgb(...)");
        expect(rgbShortcut.coords).toEqual([0, 0, 0, 0]);

        const newRuleShortcut = Color.from("test");
        expect(newRuleShortcut.coords).toEqual([NaN, NaN, NaN, 1]);
    });

    it("register a new fit method", () => {
        const MATRIX_16 = [
            [0.401288, 0.650173, -0.051461],
            [-0.250268, 1.204414, 0.045854],
            [-0.002079, 0.048952, 0.953127],
        ];

        const invert3x3 = (m: number[][]) => {
            const a = m[0][0],
                b = m[0][1],
                c = m[0][2];
            const d = m[1][0],
                e = m[1][1],
                f = m[1][2];
            const g = m[2][0],
                h = m[2][1],
                i = m[2][2];

            const A = e * i - f * h;
            const B = c * h - b * i;
            const C = b * f - c * e;
            const D = f * g - d * i;
            const E = a * i - c * g;
            const F = c * d - a * f;
            const G = d * h - e * g;
            const H = b * g - a * h;
            const I = a * e - b * d;

            const det = a * A + b * D + c * G;
            if (Math.abs(det) < 1e-12) throw new Error("Singular matrix");

            const invDet = 1 / det;
            return [
                [A * invDet, B * invDet, C * invDet],
                [D * invDet, E * invDet, F * invDet],
                [G * invDet, H * invDet, I * invDet],
            ];
        };

        const MATRIX_INVERSE_16 = invert3x3(MATRIX_16);

        const sign = (x: number) => (x < 0 ? -1 : 1);

        const luminanceLevelAdaptationFactor = (L_A: number) => {
            const k = 1 / (5 * L_A + 1);
            const k4 = Math.pow(k, 4);
            return 0.2 * k4 * (5 * L_A) + 0.1 * Math.pow(1 - k4, 2) * Math.pow(5 * L_A, 1 / 3);
        };

        const chromaticInductionFactors = (n: number): [number, number] => {
            const N_bb = 0.725 * Math.pow(1 / n, 0.2);
            return [N_bb, N_bb];
        };

        const baseExponentialNonLinearity = (n: number) => 1.48 + Math.sqrt(n);

        const viewingConditionsDependentParameters = (Y_b: number, Y_w: number, L_A: number) => {
            const n = Y_b / Y_w;
            const F_L = luminanceLevelAdaptationFactor(L_A);
            const [N_bb, N_cb] = chromaticInductionFactors(n);
            const z = baseExponentialNonLinearity(n);
            return { n, F_L, N_bb, N_cb, z };
        };

        const degreeOfAdaptation = (F: number, L_A: number) => F * (1 - (1 / 3.6) * Math.exp((-L_A - 42) / 92));

        const postAdaptationNonLinearResponseCompressionForward = (RGB: number[], F_L: number) => {
            return RGB.map((comp) => {
                const tmp = Math.pow((F_L * comp) / 100.0, 0.42);
                return (400 * tmp) / (27.13 + tmp) + 0.1;
            });
        };

        const postAdaptationNonLinearResponseCompressionInverse = (RGBc: number[], F_L: number) => {
            return RGBc.map((comp) => {
                const v = comp - 0.1;
                const s = sign(v);
                const absV = Math.abs(v);
                if (absV <= 1e-12) return 0;
                const inner = (27.13 * absV) / (400 - absV);
                return s * (100 / F_L) * Math.pow(inner, 1 / 0.42);
            });
        };

        const opponentColorDimensionsForward = (RGB: number[]) => {
            const [R, G, B] = RGB;
            const a = R - (12 * G) / 11 + B / 11;
            const b = (R + G - 2 * B) / 9;
            return [a, b];
        };

        const hueAngle = (a: number, b: number) => {
            const rad = Math.atan2(b, a);
            let deg = (rad * 180) / Math.PI;
            if (deg < 0) deg += 360;
            return deg % 360;
        };

        const eccentricityFactor = (h: number) => 0.25 * (Math.cos(2 + (h * Math.PI) / 180) + 3.8);

        const achromaticResponseForward = (RGB_a: number[], N_bb: number) => {
            const [R, G, B] = RGB_a;
            return (2 * R + G + (1 / 20) * B - 0.305) * N_bb;
        };

        const achromaticResponseInverse = (A_w: number, J: number, c: number, z: number) => {
            return A_w * Math.pow(J / 100, 1 / (c * z));
        };

        const lightnessCorrelate = (A: number, A_w: number, c: number, z: number) => {
            return 100 * Math.pow(A / A_w, c * z);
        };

        const brightnessCorrelate = (c: number, J: number, A_w: number, F_L: number) => {
            return (4 / c) * Math.sqrt(J / 100) * (A_w + 4) * Math.pow(F_L, 0.25);
        };

        const temporaryMagnitudeQuantityForward = (
            N_c: number,
            N_cb: number,
            e_t: number,
            a: number,
            b: number,
            RGB_a: number[]
        ) => {
            const [Ra, Ga, Ba] = RGB_a;
            const denom = Ra + Ga + (21 * Ba) / 20;
            if (denom === 0) return 0;
            return ((50000 / 13) * N_c * N_cb * e_t * Math.sqrt(a * a + b * b)) / denom;
        };

        const temporaryMagnitudeQuantityInverse = (C: number, J: number, n: number) => {
            const base = Math.sqrt(J / 100) * Math.pow(1.64 - Math.pow(0.29, n), 0.73);
            if (base === 0) return 0;
            return Math.pow(C / base, 1 / 0.9);
        };

        const chromaCorrelate = (
            J: number,
            n: number,
            N_c: number,
            N_cb: number,
            e_t: number,
            a: number,
            b: number,
            RGB_a: number[]
        ) => {
            const t = temporaryMagnitudeQuantityForward(N_c, N_cb, e_t, a, b, RGB_a);
            return Math.pow(t, 0.9) * Math.sqrt(J / 100) * Math.pow(1.64 - Math.pow(0.29, n), 0.73);
        };

        const colorfulnessCorrelate = (C: number, F_L: number) => C * Math.pow(F_L, 0.25);

        const saturationCorrelate = (M: number, Q: number) => 100 * Math.sqrt(M / Q);

        const P = (N_c: number, N_cb: number, e_t: number, t: number, A: number, N_bb: number) => {
            const P1 = ((50000 / 13) * N_c * N_cb * e_t) / t;
            const P2 = A / N_bb + 0.305;
            const P3 = 21 / 20;
            return [P1, P2, P3] as [number, number, number];
        };

        const postAdaptationNonLinearResponseCompressionMatrix = (P_2: number, a: number, b: number) => {
            const R_a = (460 * P_2 + 451 * a + 288 * b) / 1403;
            const G_a = (460 * P_2 - 891 * a - 261 * b) / 1403;
            const B_a = (460 * P_2 - 220 * a - 6300 * b) / 1403;
            return [R_a, G_a, B_a];
        };

        const opponentColorDimensionsInverse = (Pn: [number, number, number], hDeg: number) => {
            const [P_1, , P_3] = Pn;
            const hr = (hDeg * Math.PI) / 180;
            const sin_hr = Math.sin(hr);
            const cos_hr = Math.cos(hr);
            const P_4 = P_1 / sin_hr;
            const P_5 = P_1 / cos_hr;
            const n = Pn[1] * (2 + P_3) * (460 / 1403);

            if (Math.abs(sin_hr) >= Math.abs(cos_hr)) {
                const b = n / (P_4 + (2 + P_3) * (220 / 1403) * (cos_hr / sin_hr) - 27 / 1403 + P_3 * (6300 / 1403));
                const a = b * (cos_hr / sin_hr);
                return [a, b];
            } else {
                const a = n / (P_5 + (2 + P_3) * (220 / 1403) - (27 / 1403 - P_3 * (6300 / 1403)) * (sin_hr / cos_hr));
                const b = a * (sin_hr / cos_hr);
                return [a, b];
            }
        };

        const XYZ_to_CAM16 = (
            XYZ: number[],
            XYZ_w: number[] = [95.05, 100.0, 108.88],
            L_A = 318.31,
            Y_b = 20.0,
            surround = { F: 1.0, c: 0.69, N_c: 1.0 },
            discountIlluminant = false,
            computeH = false
        ) => {
            const RGB_w = multiplyMatrices(MATRIX_16, XYZ_w);
            const D = discountIlluminant ? 1.0 : Math.max(0, Math.min(1, degreeOfAdaptation(surround.F, L_A)));
            const { n, F_L, N_bb, N_cb, z } = viewingConditionsDependentParameters(Y_b, XYZ_w[1], L_A);

            const D_RGB = [
                (D * XYZ_w[1]) / (RGB_w[0] || 1e-12) + 1 - D,
                (D * XYZ_w[1]) / (RGB_w[1] || 1e-12) + 1 - D,
                (D * XYZ_w[1]) / (RGB_w[2] || 1e-12) + 1 - D,
            ];

            const RGB_wc = [D_RGB[0] * RGB_w[0], D_RGB[1] * RGB_w[1], D_RGB[2] * RGB_w[2]];

            const RGB_aw = postAdaptationNonLinearResponseCompressionForward(RGB_wc, F_L);
            const A_w = achromaticResponseForward(RGB_aw, N_bb);

            const RGB = multiplyMatrices(MATRIX_16, XYZ);
            const RGB_c = [D_RGB[0] * RGB[0], D_RGB[1] * RGB[1], D_RGB[2] * RGB[2]];
            const RGB_a = postAdaptationNonLinearResponseCompressionForward(RGB_c, F_L);

            const [a, b] = opponentColorDimensionsForward(RGB_a);
            const h = hueAngle(a, b);

            const e_t = eccentricityFactor(h);
            const H = computeH ? NaN : NaN;

            const A = achromaticResponseForward(RGB_a, N_bb);
            const J = lightnessCorrelate(A, A_w, surround.c, z);
            const Q = brightnessCorrelate(surround.c, J, A_w, F_L);

            const C = chromaCorrelate(J, n, surround.N_c, N_cb, e_t, a, b, RGB_a);
            const M = colorfulnessCorrelate(C, F_L);
            const s = saturationCorrelate(M, Q);

            return {
                J,
                C,
                h,
                s,
                Q,
                M,
                H,
            };
        };

        const CAM16_to_XYZ = (
            specification: { J?: number; C?: number; M?: number; h: number },
            XYZ_w: number[] = [95.05, 100.0, 108.88],
            L_A = 318.31,
            Y_b = 20.0,
            surround = { F: 1.0, c: 0.69, N_c: 1.0 },
            discountIlluminant = false
        ) => {
            const J = specification.J ?? NaN;
            let C = specification.C ?? NaN;
            const M = specification.M ?? NaN;
            const h = specification.h;

            const RGB_w = multiplyMatrices(MATRIX_16, XYZ_w);
            const D = discountIlluminant ? 1.0 : Math.max(0, Math.min(1, degreeOfAdaptation(surround.F, L_A)));
            const { n, F_L, N_bb, N_cb, z } = viewingConditionsDependentParameters(Y_b, XYZ_w[1], L_A);

            const D_RGB = [
                (D * XYZ_w[1]) / (RGB_w[0] || 1e-12) + 1 - D,
                (D * XYZ_w[1]) / (RGB_w[1] || 1e-12) + 1 - D,
                (D * XYZ_w[1]) / (RGB_w[2] || 1e-12) + 1 - D,
            ];

            const RGB_wc = [D_RGB[0] * RGB_w[0], D_RGB[1] * RGB_w[1], D_RGB[2] * RGB_w[2]];
            const RGB_aw = postAdaptationNonLinearResponseCompressionForward(RGB_wc, F_L);
            const A_w = achromaticResponseForward(RGB_aw, N_bb);

            if (Number.isNaN(C) && !Number.isNaN(M)) {
                C = M / Math.pow(F_L, 0.25);
            }

            if (Number.isNaN(C)) {
                throw new Error('Either "C" or "M" must be provided in specification.');
            }

            const t = temporaryMagnitudeQuantityInverse(C, J, n);
            const e_t = eccentricityFactor(h);
            const A = achromaticResponseInverse(A_w, J, surround.c, z);
            const Pn = P(surround.N_c, N_cb, e_t, t, A, N_bb);
            const [, P_2] = Pn;

            let [a, b] = opponentColorDimensionsInverse(Pn, h);
            if (t === 0) {
                a = 0;
                b = 0;
            }

            const RGB_a = postAdaptationNonLinearResponseCompressionMatrix(P_2, a, b);
            const RGB_c = postAdaptationNonLinearResponseCompressionInverse(RGB_a, F_L);
            const RGB = [RGB_c[0] / D_RGB[0], RGB_c[1] / D_RGB[1], RGB_c[2] / D_RGB[2]];
            const XYZ = multiplyMatrices(MATRIX_INVERSE_16, RGB);
            return XYZ;
        };

        /**
         * @see {@link https://colour.readthedocs.io/en/develop/_modules/colour/appearance/cam16.html|Colour Science CAM16-UCS documentation}
         */
        Color.register("fit-methods", [
            {
                name: "cam16-ucs",
                value: (data): number[] => {
                    const { model, coords } = data;
                    const { targetGamut } = colorModels[model] as ColorModelConverter;
                    if (targetGamut === null) return coords;

                    const color = { model, coords };
                    if (inGamut(color, targetGamut as ColorSpace)) return coords;

                    const XYZ = toArray({ model: "xyz-d65", coords: convert(color, "xyz-d65") });
                    const cam = XYZ_to_CAM16(XYZ);
                    const c1 = 0.007,
                        c2 = 0.0228;
                    const Jp = ((1 + 100 * c1) * cam.J) / (1 + c1 * cam.J);
                    const Mp = Math.log(1 + c2 * cam.M) / c2;
                    const ap = Mp * Math.cos((cam.h * Math.PI) / 180);
                    const bp = Mp * Math.sin((cam.h * Math.PI) / 180);

                    let scale = 1.0;
                    let clippedCoords: number[] = [];

                    while (scale > 0) {
                        const ap_s = ap * scale;
                        const bp_s = bp * scale;

                        const Mp_s = Math.sqrt(ap_s * ap_s + bp_s * bp_s);
                        const h_s = (Math.atan2(bp_s, ap_s) * 180) / Math.PI;
                        const M_s = (Math.exp(c2 * Mp_s) - 1) / c2;
                        const J_s = Jp / (1 - c1 * Jp);

                        const XYZ_s = CAM16_to_XYZ({ J: J_s, M: M_s, h: h_s });

                        const candidateCoords = toArray({
                            model: model,
                            coords: convert({ model: "xyz-d65", coords: XYZ_s }, model),
                        });
                        const candidate = { model, coords: candidateCoords };
                        if (inGamut(candidate, targetGamut as ColorSpace)) {
                            clippedCoords = toArray(candidate);
                            break;
                        }

                        scale -= 0.05;
                    }

                    if (!clippedCoords.length) {
                        clippedCoords = fit({ model, coords: toArray(color).slice(0, 3) });
                    }

                    return clippedCoords;
                },
            },
        ]);

        const coords = [1.2, -0.3, 0.5];
        const model = "srgb";
        const epsilon = 1e-5;

        const cam16Coords = new Color(model, coords).toArray({ fit: "cam16-ucs" as FitMethod });
        const chromaCoords = new Color(model, coords).toArray({ fit: "chroma-reduction" });
        const cssCoords = new Color(model, coords).toArray({ fit: "css-gamut-map" });

        expect(cam16Coords.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);
        expect(chromaCoords.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);
        expect(cssCoords.every((c) => c >= 0 - epsilon && c <= 1 + epsilon)).toBe(true);

        expect(chromaCoords).not.toEqual(cam16Coords);
        expect(cssCoords).not.toEqual(cam16Coords);

        const withinGamut = [0.5, 0.5, 0.5];
        const fitted = new Color(model, withinGamut).toArray({ fit: "cam16-ucs" as FitMethod });
        expect(fitted).toEqual([...withinGamut, 1]);
    });
});

describe("Color unregistration and replacement system", () => {
    it("should unregister and replace a <named-color>", () => {
        const oldColor = Color.from("rebeccapurple");
        expect(oldColor.coords).toEqual([102, 51, 153, 1]);
        Color.unregister("named-colors", ["rebeccapurple"]);
        Color.register("named-colors", [{ name: "rebeccapurple", value: [100, 50, 150] }]);
        const newColor = Color.from("rebeccapurple");
        expect(newColor.coords).toEqual([100, 50, 150, 1]);
    });

    it("should unregister and replace a formatter", () => {
        const color = Color.from("red");
        const oldFormat = color.to("rgb");
        expect(oldFormat).toBe("rgb(255 0 0)");
        Color.unregister("formatters", ["rgb"]);
        Color.register("formatters", [
            {
                name: "rgb",
                value: {
                    bridge: "srgb",
                    fromBridge: (coords: number[]) => coords.map((c) => c * 255),
                    format: (coords) => `bgr(${coords.slice(0, 3).reverse().join(" ")})`,
                },
            },
        ]);
        const newFormat = color.to("rgb");
        expect(newFormat).toBe("bgr(0 0 255)");
    });

    it("should unregister and replace a fit-method", () => {
        const outOfBounds = Color.from("color(srgb 1.2 0 1.2)");
        expect(outOfBounds.within("srgb", { method: "css-gamut-map" }).inGamut("srgb")).toBe(true);
        Color.unregister("fit-methods", ["css-gamut-map"]);
        Color.register("fit-methods", [
            {
                name: "css-gamut-map",
                value: (data): number[] => {
                    return fit(data, { fit: "clip" });
                },
            },
        ]);
        expect(outOfBounds.within("srgb", { method: "css-gamut-map" }).inGamut("srgb")).toBe(true);
    });

    it("should unregister and replace a color-space", () => {
        const color = Color.from("color(srgb 0.1 0.2 0.3)");
        expect(Object.keys(color.toObject())).toEqual(["r", "g", "b", "alpha"]);
        Color.unregister("color-spaces", ["srgb"]);
        Color.register("color-spaces", [
            {
                name: "srgb",
                value: {
                    components: ["x", "y", "z", "alpha"],
                    bridge: "xyz-d65",
                    toBridgeMatrix: [
                        [2, 0, 0],
                        [0, 2, 0],
                        [0, 0, 2],
                    ],
                    fromBridgeMatrix: [
                        [0.5, 0, 0],
                        [0, 0.5, 0],
                        [0, 0, 0.5],
                    ],
                },
            },
        ]);
        expect(Object.keys(color.toObject())).toEqual(["x", "y", "z", "alpha"]);
    });

    it("should unregister and replace a shortcut", () => {
        expect(Color.from("black").model).toBe("rgb");
        Color.unregister("shortcuts", ["<named-color>"]);
        Color.register("shortcuts", [
            {
                name: "<named-color>",
                value: {
                    appendTo: "<color>",
                    parse: () => ({ model: "srgb", coords: [0, 0, 0, 1] }),
                },
            },
        ]);
        expect(Color.from("black").model).toBe("srgb");
    });

    it("should unregister a shortcut and register it as parser", () => {
        const hex = "#663399";
        expect(Color.from(hex).coords).toEqual([102, 51, 153, 1]);
        Color.unregister("shortcuts", ["<hex-color>"]);
        Color.register("parsers", [
            {
                name: "<hex-color>",
                value: {
                    appendTo: "<color-base>",
                    rule: (str) => /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(str),
                    parse: (node) => {
                        let hex = node.value.slice(1) as string;
                        if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");

                        const num = parseInt(hex, 16);
                        const is8 = hex.length === 8;

                        return {
                            model: "rgb",
                            coords: is8
                                ? [(num >>> 24) & 255, (num >> 16) & 255, (num >> 8) & 255, (num & 255) / 255]
                                : [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1],
                        };
                    },
                },
            },
        ]);
    });
});
