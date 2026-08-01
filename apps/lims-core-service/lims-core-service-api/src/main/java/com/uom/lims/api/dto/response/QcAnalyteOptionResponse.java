package com.uom.lims.api.dto.response;

/**
 * An analyte that can be controlled — the coded identity the QC release gate
 * joins on, paired with the name a user recognises.
 *
 * <p>The QC form needs this because {@code loincCode} is the join key and typing
 * a LOINC from memory is how a control ends up governing nothing.
 */
public record QcAnalyteOptionResponse(String loincCode, String name) {
}
