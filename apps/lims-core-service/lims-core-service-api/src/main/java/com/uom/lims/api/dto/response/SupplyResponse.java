package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplyResponse {
    private UUID id;
    private String itemNo;
    private String name;
    private String category;
    private String tubeColor;
    private int currentStock;
    private int minStock;
    private int maxStock;
    private String unit;
    private LocalDate lastRestocked;
}
