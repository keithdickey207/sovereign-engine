import { latLonToScreen } from "./earthGeo";

/** Smooth camera fly-to with eased pan + zoom */
export function animateFlyTo({
  camRef, sizeRef, fromZoom, toZoom, lat, lon, setZoom, duration = 700,
}) {
  const { w: W, h: H } = sizeRef.current;
  const startX = camRef.current.x;
  const startY = camRef.current.y;
  const startZoom = fromZoom;

  const endScreen = latLonToScreen(lat, lon, 0, 0, toZoom, W, H);
  const endX = W / 2 - endScreen.x;
  const endY = H / 2 - endScreen.y;

  const t0 = performance.now();

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

  return new Promise((resolve) => {
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = ease(p);
      const z = startZoom + (toZoom - startZoom) * e;

      const midScreen = latLonToScreen(lat, lon, 0, 0, z, W, H);
      const midEndX = W / 2 - midScreen.x;
      const midEndY = H / 2 - midScreen.y;

      camRef.current.x = startX + (midEndX - startX) * e;
      camRef.current.y = startY + (midEndY - startY) * e;

      if (p < 1) {
        setZoom(z);
        requestAnimationFrame(step);
      } else {
        camRef.current.x = endX;
        camRef.current.y = endY;
        setZoom(toZoom);
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}