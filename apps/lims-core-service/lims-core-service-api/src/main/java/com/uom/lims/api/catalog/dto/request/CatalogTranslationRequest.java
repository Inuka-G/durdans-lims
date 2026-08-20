package com.uom.lims.api.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A translation of one catalogue entry into one language.
 *
 * <p>Saving a translation does not publish it. Review is a separate call, because the
 * person who types the Sinhala and the clinician who confirms it is the right term for
 * the assay are usually not the same person — and until someone confirms it, the agent
 * serves English rather than a guess.
 */
public record CatalogTranslationRequest(

        @NotBlank @Pattern(regexp = "si|ta|en", message = "locale must be si, ta or en") String locale,

        @NotBlank @Size(max = 255) String name,

        /* What patients actually call it. Optional, and the single most useful field for
           voice recognition: it is what a caller says, not what the report prints. */
        @Size(max = 255) String colloquialName,

        /* Tests only: what the patient must do before the sample is taken. */
        String prepInstruction,

        /* Packages only: what the bundle covers, in the patient's language. */
        String description) {
}
