package com.uom.lims.api.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupplyCreateRequest {

    @NotBlank
    private String itemNo;

    @NotBlank
    private String name;

    @NotBlank
    private String category;

    private String tubeColor;

    @NotNull
    @Min(0)
    private Integer currentStock;

    @NotNull
    @Min(0)
    private Integer minStock;

    @NotNull
    @Min(0)
    private Integer maxStock;

    @NotBlank
    private String unit;

    private String lastRestocked;
}
