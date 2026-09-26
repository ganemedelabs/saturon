import { Color } from "../Color.js";

describe("W3C Color Level 5 - color-mix() Specification", () => {
    const expectCoordsToBeCloseTo = (color: Color, expected: Color, precision = 3) => {
        const coords = color.toArray({ fit: "none", precision });
        const expectedCoords = expected.toArray({ fit: "none", precision });
        expectedCoords.forEach((val, i) => {
            expect(coords[i]).toBeCloseTo(val, precision);
        });
    };

    describe("3.1 & 3.2 Percentage Normalization", () => {
        it("should treat equivalent percentage syntaxes as a 50-50 mix", () => {
            const expected = Color.from("lch(51.51% 52.21 325.8)");

            const syntaxes = [
                "color-mix(in lch, purple 50%, plum 50%)",
                "color-mix(in lch, purple 50%, plum)",
                "color-mix(in lch, purple, plum 50%)",
                "color-mix(in lch, purple, plum)",
                "color-mix(in lch, plum, purple)",
                "color-mix(in lch, purple 80%, plum 80%)",
            ];

            syntaxes.forEach((syntax) => {
                const color = Color.from(syntax).in("lch");
                expectCoordsToBeCloseTo(color, expected, 1);
            });
        });

        it("should apply an alpha multiplier if percentages sum to less than 100%", () => {
            const color = Color.from("color-mix(in lch, purple 30%, plum 30%)");
            const expected = Color.from("lch(51.51% 52.21 325.8 / 0.6)");
            expectCoordsToBeCloseTo(color, expected, 1);
        });
    });

    describe("3.3 Calculating the Result of color-mix", () => {
        it("should calculate exact W3C math for LCH mixes (peru / palegoldenrod)", () => {
            const color = Color.from("color-mix(in lch, peru 40%, palegoldenrod)");
            const expected = Color.from("lch(79.7256% 40.448 84.771)");
            expectCoordsToBeCloseTo(color, expected, 0);
        });

        it("should calculate exact W3C math for sRGB mixes (peru / palegoldenrod)", () => {
            const color = Color.from("color-mix(in srgb, peru 40%, palegoldenrod)");
            const expected = Color.from("color(srgb 0.8816 0.7545 0.4988)");
            expectCoordsToBeCloseTo(color, expected, 3);
        });

        it("should calculate exact W3C math for LCH mixes (teal / olive)", () => {
            const color = Color.from("color-mix(in lch, teal 65%, olive)");
            const expected = Color.from("lch(49.4429% 40.4830 162.5452)");
            expectCoordsToBeCloseTo(color, expected, 2);
        });

        it("should produce transparent black when mixing 0% and 0%", () => {
            const color = Color.from("color-mix(in oklch, teal 0%, olive 0%)");
            const expected = Color.from("oklch(0% 0 none / 0)");
            expectCoordsToBeCloseTo(color, expected, 1);
        });

        it("should handle three colors by dividing percentages evenly (1/3 each)", () => {
            const color = Color.from("color-mix(in oklab, teal, olive, blue)");
            const expected = Color.from("oklab(52.53% -0.0550 -0.0720)");
            expectCoordsToBeCloseTo(color, expected, 3);
        });
    });

    describe("3.4 Effect of Mixing Color Space on color-mix", () => {
        it("should yield completely different Lightness (L) outputs depending on the color space", () => {
            const lchMix = Color.from("color-mix(in lch, white, black)");
            const expectedLch = Color.from("lch(50% 0 0)");
            expectCoordsToBeCloseTo(lchMix, expectedLch, 1);

            const xyzMix = Color.from("color-mix(in xyz, white, black)").in("lch");
            const expectedXyz = Color.from("lch(76% 0 0)");
            expectCoordsToBeCloseTo(xyzMix, expectedXyz, 0);

            const srgbMix = Color.from("color-mix(in srgb, white, black)").in("lch");
            const expectedSrgb = Color.from("lch(53.4% 0 0)");
            expectCoordsToBeCloseTo(srgbMix, expectedSrgb, 1);
        });

        it("should mix colors in XYZ properly and match expected coordinate results", () => {
            const color = Color.from(
                "color-mix(in xyz, rgb(82.02% 30.21% 35.02%) 75.23%, rgb(5.64% 55.94% 85.31%))"
            ).in("lch");
            const expected = Color.from("lch(53.0304% 38.9346 352.8138)");
            expectCoordsToBeCloseTo(color, expected, 1);
        });

        it("should handle out-of-gamut intermediate conversions (Display P3 to HSL)", () => {
            const color = Color.from("color-mix(in hsl, color(display-p3 0 1 0) 80%, yellow)");
            const expected = Color.from("hsl(114.3032 261.5568 30.2672)");
            expectCoordsToBeCloseTo(color, expected, 2);
        });
    });

    describe("3.5 Effect of Non-Unity Alpha on color-mix", () => {
        it("should accurately premultiply and unpremultiply alpha when interpolating transparent colors", () => {
            const color = Color.from("color-mix(in srgb, rgb(100% 0% 0% / 0.7) 25%, rgb(0% 100% 0% / 0.2))");
            const expected = Color.from("color(srgb 0.53846 0.46154 0 / 0.325)");
            expectCoordsToBeCloseTo(color, expected, 4);
        });

        it("should correctly combine an alpha multiplier on top of premultiplied non-unity sums", () => {
            const color = Color.from("color-mix(in srgb, rgb(100% 0% 0% / 0.7) 20%, rgb(0% 100% 0% / 0.2) 60%)");
            const expected = Color.from("color(srgb 0.53846 0.46154 0 / 0.26)");
            expectCoordsToBeCloseTo(color, expected, 4);
        });
    });
});
