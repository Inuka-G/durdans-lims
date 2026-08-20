package com.uom.lims.api.catalog.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Creates or replaces a package definition.
 *
 * <p>{@code items} is required and non-empty: a package with no tests would be a price
 * with nothing behind it, and it would be quotable to a patient.
 */
public record TestPackageUpsertRequest(

        @NotBlank @Size(max = 64) String packageCode,

        @NotBlank @Size(max = 255) String packageName,

        @Size(max = 128) String category,

        String description,

        /* Zero is allowed so a package can be defined before it is priced — but it may
           not be activated at zero; see TestPackageService. */
        @NotNull @DecimalMin("0.00") BigDecimal price,

        /* Defaults to false when omitted. Activation is always a deliberate act, because
           it is the moment the package becomes quotable. */
        Boolean active,

        @NotEmpty @Valid List<Item> items) {

    public record Item(
            @NotBlank String testCode,
            Integer displayOrder) {
    }

    public boolean activeOrFalse() {
        return Boolean.TRUE.equals(active);
    }
}
