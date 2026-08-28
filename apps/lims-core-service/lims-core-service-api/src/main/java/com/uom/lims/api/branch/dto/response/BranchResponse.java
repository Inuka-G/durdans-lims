package com.uom.lims.api.branch.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BranchResponse {
    private UUID id;
    private String code;
    private String name;
    private String location;
    private String contactEmail;
    private String contactPhone;
    private String status;
}
