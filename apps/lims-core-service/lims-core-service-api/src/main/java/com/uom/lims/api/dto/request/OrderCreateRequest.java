package com.uom.lims.api.dto.request;

import com.uom.lims.api.enums.Priority;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * WHY: Encapsulates the clinical and administrative inputs required to initiate a testing session.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreateRequest {
    @NotNull(message = "Patient ID is required")
    private String patientId;

    @NotEmpty(message = "At least one test ID is required")
    @Size(max = 20, message = "Maximum 20 tests allowed per order")
    private List<String> testIds;

    @NotNull(message = "Priority must be specified")
    private Priority priority;

    private Map<String, Priority> testPriorities;

    @Size(max = 255, message = "Referring doctor name too long")
    private String referringDoctor;

    @Size(max = 255, message = "Referring department name too long")
    private String referringDepartment;

    @Size(max = 500, message = "Remarks too long")
    private String remarks;
}
