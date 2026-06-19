"use client";

import { useId } from "react";

// Brand glyphs from Simple Icons (https://simpleicons.org) — the SVG path data is
// CC0 1.0 (public domain). Rendered monochrome via `currentColor` and used purely to
// identify which platform an account lives on (nominative use); the adjacent text label
// carries the accessible name, so the glyph itself is decorative (aria-hidden).
const PATHS: Record<string, string> = {
  threads:
    "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z",
  instagram:
    "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
};

// Per-platform BRAND treatment so platforms are distinguishable at a glance. A colorful symbol
// renders in its brand color/gradient; a monochrome brand (Threads) has no entry and inherits
// `currentColor`. WHEN ADDING A PLATFORM: register its glyph in PATHS above, and — if its symbol is
// colorful — its treatment here; OR, if the brand is a colorful *wordmark* with no square symbol
// (e.g. miin), add a TILE entry below instead. (Doc: docs/product-decisions.md "Platform icon brand
// identity".)
type Brand = { gradient?: [number, string][]; color?: string };
const BRAND: Record<string, Brand> = {
  instagram: {
    // IG's diagonal brand gradient (bottom-left → top-right).
    gradient: [
      [0, "#ffd521"],
      [0.25, "#f50000"],
      [0.5, "#b900b4"],
      [0.75, "#7e00ce"],
      [1, "#4f5bd5"],
    ],
  },
  // threads: monochrome brand → no entry → currentColor.
  // miin: a colorful *wordmark* brand → rendered via the TILE registry below, not PATHS/BRAND.
};

// miin's official "Miin" wordmark (their site SVG, native viewBox 0 0 102 34). Unlike the
// transparent Simple-Icons silhouettes, miin's brand mark is a light-on-dark rainbow wordmark, so it
// can't render as a bare `currentColor`/gradient path — it needs its own dark backdrop to read.
const MIIN_WORDMARK =
  "M74.947 10.548c-2.42 7.048-5.313 9.606-6.53 8.951-1.064-.475-.497-2.043.709-5.373.416-1.15.909-2.512 1.437-4.111.423-1.388.765-2.602 1.06-3.653 1.003-3.56 1.478-5.246 2.807-5.482 1.491-.334 2.648 2.482.517 9.668m-12.636 5.221c1.264.594 3.593-1.4 5.329-6.942 1.522-5.633.365-7.764-1.172-7.398-1.439.341-1.945 2.202-3.026 6.18l-.232.853c-.264.963-.519 1.818-.744 2.574-.844 2.83-1.272 4.265-.155 4.733m-6.348-3.897c1.355.518 3.12-.929 4.11-4.902s-.304-5.435-1.842-4.978c-1.537.457-2.024 1.903-2.664 4.948l-.101.48c-.574 2.712-.842 3.977.497 4.452M12.393 23.96a618 618 0 0 1-1.736 4.856c-.529 1.303-1.027 2.655-1.544 4.057l-.374 1.013H0q.435-1.142.875-2.284.441-1.141.876-2.283l2.01-5.374a843 843 0 0 0 3.958-10.748 288 288 0 0 0 1.948-5.511 373 373 0 0 1 1.858-5.268h8.982q.168 1.078.338 2.102v.001c.133.807.262 1.591.377 2.358.213 1.415.442 2.8.67 4.186q.64 3.944 1.31 7.901c.036.197.21.339.41.335a.43.43 0 0 0 .35-.198c.69-1.227 1.361-2.45 2.032-3.674.795-1.449 1.589-2.896 2.414-4.348.41-.786.838-1.562 1.265-2.333.334-.605.667-1.207.988-1.808l2.405-4.446h8.937q-.054 1.248-.1 2.483v.001h-.001q-.053 1.388-.112 2.753l-.078 1.773v.019l-.001.013v.018l-.001.004v.002q-.075 1.77-.164 3.698a2541 2541 0 0 1-.62 13.488q-.068 1.36-.126 2.603l-.228 4.567H31.59c.137-1.766.243-3.273.365-5.039s.228-3.288.35-4.81l.411-5.755a.35.35 0 0 0-.365-.38.32.32 0 0 0-.305.182 647 647 0 0 1-3.334 6.424c-.365.73-.752 1.482-1.133 2.222a138 138 0 0 0-1.424 2.817 86 86 0 0 1-1.47 2.852l-.001.001v.002h-.001q-.402.753-.782 1.484h-6.47l-.163-1.183c-.065-.479-.135-.985-.217-1.572-.084-.596-.163-1.206-.243-1.82v-.001q-.097-.75-.199-1.498c-.152-1.111-.304-2.223-.472-3.304l-.867-6.09a.396.396 0 0 0-.746-.075c-.7 1.857-1.416 3.73-2.132 5.587m38.683-6.455c2.466.046 4.948 0 7.43-.107a300 300 0 0 1-3.182 16.473h-8.526a283 283 0 0 0 4.278-16.366m1.797-12.088c-.35 2.436-1.523 3.38-3.045 3.045-1.492-.35-1.766-1.111-1.553-2.558a3.045 3.045 0 0 1 2.162-3.044c1.537-.64 2.786.121 2.436 2.557m19.425 17.797c-2.481.107-4.963.137-7.444.076a268 268 0 0 1-2.771 10.657h8.236c.73-3.624 1.4-7.216 1.98-10.733m19.304-7.018a4.43 4.43 0 0 0-3.76 3.425 1550 1550 0 0 0-.848 3.81c-.772 3.479-1.543 6.956-2.38 10.424h-7.612c1.142-4.567 2.238-9.134 3.32-13.701.852-3.608 1.659-7.17 2.45-10.733 1.218 1.431 2.436 2.862 3.684 4.293l.168-.167a13.4 13.4 0 0 1 3.593-2.512 13.7 13.7 0 0 1 6.653-1.37c3.288 0 4.902 2.45 4.186 6.409a861 861 0 0 1-3.41 17.812h-7.612a1413 1413 0 0 0 3.136-15.01c.38-1.92-.213-2.68-1.355-2.68z";

// A "tiled" glyph: a colorful-wordmark brand reproduced as a mini app-icon — a dark rounded square
// behind the wordmark, which is masked over a gradient so the brand colors show. Values below were
// measured from miin's app-icon PNG (tilt, bg) and tuned to match it (gradient lean/spread/stops).
// The gradient lives in *tile* coordinates (0–100), decoupled from the −7° letter tilt, so the color
// bands stay ~horizontal while the letters lean — that keeps warm in the bottom-left corner like the
// real icon.
type Tile = {
  bg: string;
  mark: string;
  /** Group transform centering/tilting/scaling the mark within the 100×100 tile. */
  transform: string;
  /** Linear-gradient endpoints in tile space: [warm x1,y1, cool x2,y2]. */
  gradient: { x1: number; y1: number; x2: number; y2: number; stops: [number, string][] };
};
const TILE: Record<string, Tile> = {
  miin: {
    bg: "#030037",
    mark: MIIN_WORDMARK,
    transform: "translate(50 50.5) rotate(-7) scale(0.9) translate(-51 -17)",
    gradient: {
      x1: 48.26,
      y1: 70.42,
      x2: 51.74,
      y2: 30.58,
      stops: [
        [0, "#f15b47"],
        [0.05, "#f7943a"],
        [0.13, "#ffd21e"],
        [0.25, "#b9e72f"],
        [0.41, "#4bf667"],
        [0.56, "#26dac8"],
        [0.72, "#3495ea"],
        [0.81, "#5362e6"],
        [1, "#6b3dde"],
      ],
    },
  },
};

/**
 * Brand-colored platform glyph; renders nothing for a platform we have no icon for.
 * Decorative (`aria-hidden`) — the adjacent text label carries the accessible name.
 */
export function PlatformIcon({
  platform,
  size = 13,
  className = "acct-platicon",
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  // useId() contains colons, which are invalid inside a CSS `url(#…)` reference — strip them.
  const uid = useId().replace(/:/g, "");

  // Tiled glyph (colorful-wordmark brands, e.g. miin): a dark rounded square + the wordmark masked
  // over a gradient. Square footprint like the other glyphs, so `size` works unchanged.
  const tile = TILE[platform];
  if (tile) {
    const maskId = `platile-${uid}`;
    const gId = `platile-grad-${uid}`;
    return (
      <svg
        className={className}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden
      >
        <defs>
          <linearGradient
            id={gId}
            gradientUnits="userSpaceOnUse"
            x1={tile.gradient.x1}
            y1={tile.gradient.y1}
            x2={tile.gradient.x2}
            y2={tile.gradient.y2}
          >
            {tile.gradient.stops.map(([offset, color]) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
          <mask id={maskId}>
            <g transform={tile.transform}>
              <path d={tile.mark} fill="#fff" fillRule="evenodd" clipRule="evenodd" />
            </g>
          </mask>
        </defs>
        <rect width="100" height="100" rx="23" fill={tile.bg} />
        <rect width="100" height="100" fill={`url(#${gId})`} mask={`url(#${maskId})`} />
      </svg>
    );
  }

  const gradId = `platicon-${uid}`;
  const d = PATHS[platform];
  if (!d) return null;
  const brand = BRAND[platform];
  const fill = brand?.gradient ? `url(#${gradId})` : brand?.color ?? "currentColor";
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      aria-hidden
    >
      {brand?.gradient && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
            {brand.gradient.map(([offset, color]) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
      )}
      <path d={d} />
    </svg>
  );
}
