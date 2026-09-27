import { config, RenderingIntent } from "./config.js";
import { ColorData } from "./syntax.js";

/**
 * Resolves a `device-cmyk()` color to its computed value.
 *
 * Resolution order, per the CSS Color 5 `device-cmyk()` and `@color-profile` specs:
 * 1. If a color profile has been registered under the reserved name `"device-cmyk"`
 *    (via `configure({ colorProfiles: { "device-cmyk": ... } })`), the CMYK color is
 *    converted through that profile's device-independent Lab transform, using the
 *    profile's declared (or default) rendering intent.
 * 2. Otherwise, the "naive" CMYK → sRGB conversion is used as the guaranteed fallback.
 *
 * @param cmyka - The CMYK color to resolve, as `[C, M, Y, K, A?]` where each component is in `[0, 1]`.
 * @returns A color in the `"lab"` model when a profile is registered, otherwise `"srgb"`.
 */
export function resolveDeviceCmyk(cmyka: number[]): ColorData {
    const [c, m, y, k, alpha = 1] = cmyka;
    const profile = config.colorProfiles["device-cmyk"];

    if (profile) {
        const intent: RenderingIntent = profile.renderingIntent ?? "relative-colorimetric";
        const [L, a, b] = profile.toLab([c, m, y, k], intent);
        return { model: "lab", coords: [L, a, b, alpha] };
    }

    return {
        model: "srgb",
        coords: [1 - (c * (1 - k) + k), 1 - (m * (1 - k) + k), 1 - (y * (1 - k) + k), alpha],
    };
}
