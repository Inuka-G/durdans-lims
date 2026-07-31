package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * WHY: Extracts minimal patient context necessary for the phlebotomy worklist to maintain interface layout constraints.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SamplePatientInfo {
    private String name;
    private String pid;
    private Integer age;
    private String gender;
    private String wardRoom;
}
