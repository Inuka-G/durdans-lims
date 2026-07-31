package com.uom.lims.api.patient.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.uom.lims.api.common.enums.BloodGroup;
import com.uom.lims.api.common.enums.Gender;
import com.uom.lims.api.common.enums.IdentityType;
import com.uom.lims.api.common.enums.MaritalStatus;
import com.uom.lims.api.common.enums.Title;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Patient details response")
public class PatientResponse {

    @Schema(description = "Unique code for the patient", example = "PAT-123456")
    private String patientCode;

    @Schema(description = "Honorific title", example = "MR")
    private Title title;

    @Schema(description = "Full name of the patient", example = "John Doe")
    private String fullName;

    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "Date of birth of the patient", example = "1990-01-01")
    private LocalDate dob;

    @Schema(description = "Gender of the patient")
    private Gender gender;

    @Schema(description = "Marital status of the patient")
    private MaritalStatus maritalStatus;

    @Schema(description = "Nationality of the patient", example = "Sri Lankan")
    private String nationality;

    @Schema(description = "Blood group of the patient", example = "O_POSITIVE")
    private BloodGroup bloodGroup;

    @Schema(description = "Identity type (e.g., NIC, PASSPORT)", example = "NIC")
    private IdentityType identityType;

    @Schema(description = "Identity number", example = "123456789V")
    private String identityNumber;

    @Schema(description = "Contact phone number", example = "+94771234567")
    private String phone;

    @Schema(description = "Email address", example = "john.doe@example.com")
    private String email;

    @Schema(description = "Residential address", example = "123, Main Street, Colombo")
    private String address;

    @Schema(description = "Landline number", example = "0112345678")
    private String homeNumber;

    @Schema(description = "Code of the branch where the patient is registered", example = "BR001")
    private String branchCode;

    @Schema(description = "Contact person name", example = "Jane Doe")
    private String contactPersonName;

    @Schema(description = "Contact person phone number", example = "+94771234568")
    private String contactPersonPhone;

    @Schema(description = "URL to the patient's profile photo", example = "https://s3.amazonaws.com/...")
    private String profilePhotoUrl;

    @Schema(description = "Whether the email is verified", example = "true")
    private boolean emailVerified;

    @Schema(description = "Whether the phone number is verified", example = "true")
    private boolean phoneVerified;

    @Schema(description = "Record creation timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record last update timestamp")
    private LocalDateTime updatedAt;
}
