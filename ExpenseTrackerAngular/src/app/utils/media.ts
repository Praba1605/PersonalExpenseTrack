/**
 * Camera request used by every call surface.
 *
 * A phone held upright hands back a portrait frame by default (e.g. 480x640),
 * which then sits letterboxed inside a landscape tile with black bars either
 * side. Asking for a landscape size and aspect ratio makes the browser pick a
 * landscape capture mode where the device has one.
 *
 * These are "ideal", not "exact", on purpose: a device that genuinely cannot
 * produce 16:9 still returns its best match rather than failing outright.
 */
export const CALL_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16 / 9 },
  },
  audio: true,
};
