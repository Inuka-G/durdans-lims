package com.uom.lims.api.patient.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.uom.lims.api.common.enums.BloodGroup;
import com.uom.lims.api.common.enums.Gender;
import com.uom.lims.api.common.enums.IdentityType;
import com.uom.lims.api.common.enums.MaritalStatus;
import com.uom.lims.api.common.enums.Title;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "PatientUpdateRequest", description = "Payload used to update an existing patient in the LIMS system")
public class PatientUpdateRequest {

    @Schema(description = "Honorific title", example = "MR")
    private Title title;

    @Size(min = 1, max = 150, message = "Full name must be between 1 and 150 characters")
    @Schema(description = "Full name of the patient", example = "John Doe")
    private String fullName;

    @Past(message = "Date of birth must be in the past")
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

    @Size(min = 1, max = 50, message = "Identity number must be between 1 and 50 characters")
    @Schema(description = "Identity number", example = "123456789V")
    private String identityNumber;

    @Pattern(regexp = "^\\+?[0-9]{9,15}$", message = "Invalid phone number format")
    @Schema(description = "Contact phone number", example = "+94771234567")
    private String phone;

    @Email(message = "Invalid email format")
    @Schema(description = "Email address", example = "john.doe@example.com")
    private String email;

    @Size(min = 1, max = 20, message = "Home number must be between 1 and 20 characters")
    @Schema(description = "Landline number", example = "0112345678")
    private String homeNumber;

    @Size(max = 500, message = "Address cannot exceed 500 characters")
    @Schema(description = "Residential address", example = "123, Main Street, Colombo")
    private String address;

    @Schema(description = "Code of the branch", example = "BR001")
    private String branchCode;

    @Schema(description = "Contact person name", example = "Jane Doe")
    private String contactPersonName;

    @Schema(description = "Contact person phone number", example = "+94771234568")
    private String contactPersonPhone;
}
