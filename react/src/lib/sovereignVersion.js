/**
 * Single source of truth for UI version display.
 * Never trust raw msg.version from mixed payloads (earth_meta used to send 4.1).
 * Keep in lockstep with sovereign-earth/config/sovereign_version.py
 */
export const SOVEREIGN_VERSION = "7.2";
export const UI_VERSION = "7.2";
export const GRAPHICS_VERSION = "7.2";
export const BRIDGE_VERSION = "7.2-mesh";
export const BLUEPRINT_VERSION = "5.0";
export const ENGINE_LABEL = `Sovereign Earth Engine v${SOVEREIGN_VERSION}`;

/** Merge extras then force-pin version fields so WS cannot flip the header. */
export function pinnedVersionFields(extra = {}) {
  const { version: _v, ui_version: _u, graphics_version: _g, bridge_version: _b, ...rest } = extra || {};
  return {
    ...rest,
    version: SOVEREIGN_VERSION,
    ui_version: UI_VERSION,
    graphics_version: GRAPHICS_VERSION,
    bridge_version: BRIDGE_VERSION,
    blueprint_version: BLUEPRINT_VERSION,
    engine: ENGINE_LABEL,
  };
}

export function headerVersionLabel() {
  return `v${UI_VERSION} · graphics ${GRAPHICS_VERSION}`;
}
