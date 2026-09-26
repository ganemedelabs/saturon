/** Represents a `<system-color>` identifier. */
export type SystemColor = keyof typeof systemColors;

/**
 * System color estimates used by the engine for light/dark themes.
 *
 * @remarks
 * These RGB values are approximate and may differ from browser implementations.
 * They are not derived from any single official browser palette or color specification.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#css-system-colors|W3C Color 4 — System Colors}
 */
export const systemColors = {
    AccentColor: [
        [0, 120, 215],
        [10, 132, 255],
    ],
    AccentColorText: [
        [255, 255, 255],
        [255, 255, 255],
    ],
    ActiveText: [
        [255, 0, 0],
        [255, 100, 100],
    ],
    ButtonBorder: [
        [169, 169, 169],
        [90, 90, 90],
    ],
    ButtonFace: [
        [240, 240, 240],
        [60, 60, 60],
    ],
    ButtonText: [
        [0, 0, 0],
        [255, 255, 255],
    ],
    Canvas: [
        [255, 255, 255],
        [30, 30, 30],
    ],
    CanvasText: [
        [0, 0, 0],
        [255, 255, 255],
    ],
    Field: [
        [255, 255, 255],
        [45, 45, 45],
    ],
    FieldText: [
        [0, 0, 0],
        [255, 255, 255],
    ],
    GrayText: [
        [128, 128, 128],
        [169, 169, 169],
    ],
    Highlight: [
        [0, 120, 215],
        [80, 80, 80],
    ],
    HighlightText: [
        [255, 255, 255],
        [0, 0, 0],
    ],
    LinkText: [
        [0, 0, 255],
        [0, 128, 255],
    ],
    Mark: [
        [255, 255, 0],
        [255, 200, 0],
    ],
    MarkText: [
        [0, 0, 0],
        [0, 0, 0],
    ],
    SelectedItem: [
        [0, 120, 215],
        [0, 120, 215],
    ],
    SelectedItemText: [
        [255, 255, 255],
        [255, 255, 255],
    ],
    VisitedText: [
        [128, 0, 128],
        [200, 120, 255],
    ],
};
