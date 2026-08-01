package com.uom.lims.api.dto.response;

/**
 * An instrument as an option a user can pick — the QC form and manual result
 * entry both need the canonical code, not the display name.
 *
 * <p>Distinct from {@code InstrumentStatusResponse}, which is the read-only
 * connectivity view served from static reference data. This one comes from the
 * registry table the QC release gate joins on, so what a user selects here is
 * exactly what the gate will look for.
 *
 * @param qcRequired false for bench methods, where the UI should say analyser QC
 *                   does not apply rather than leaving the user to wonder why no
 *                   control can be recorded
 */
public record InstrumentOptionResponse(
        String code,
        String name,
        String instrumentType,
        boolean qcRequired) {
}
