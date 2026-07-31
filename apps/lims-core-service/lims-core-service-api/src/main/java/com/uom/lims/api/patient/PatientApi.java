package com.uom.lims.api.patient;

import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.patient.dto.request.PatientCreateRequest;
import com.uom.lims.api.patient.dto.request.PatientUpdateRequest;
import com.uom.lims.api.patient.dto.response.PatientResponse;
import com.uom.lims.api.patient.dto.response.DashboardStatisticsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;

@RequestMapping("/api/v1/patients")
@Tag(name = "Patient Management", description = "Operations related to patient management")
public interface PatientApi {

        @Operation(summary = "Register a new patient", description = "Creates a new patient record in the system")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "201", description = "Patient created successfully", content = @Content(mediaType = "application/json", schema = @Schema(implementation = PatientResponse.class))),
                        @ApiResponse(responseCode = "400", description = "Invalid input data", content = @Content),
                        @ApiResponse(responseCode = "409", description = "Patient already exists", content = @Content)
        })
        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        PatientResponse registerPatient(
                        @Parameter(description = "Patient creation request", required = true) @Valid @RequestBody PatientCreateRequest request);

        @Operation(summary = "Get patient by code", description = "Retrieves patient details using the unique patient code")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Patient found", content = @Content(mediaType = "application/json", schema = @Schema(implementation = PatientResponse.class))),
                        @ApiResponse(responseCode = "404", description = "Patient not found", content = @Content)
        })
        @GetMapping("/{patientCode}")
        @ResponseStatus(HttpStatus.OK)
        PatientResponse getPatientByCode(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode);

        @Operation(summary = "Search patients", description = "Search for patients with pagination, sorting, and advanced filters")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "List of patients retrieved", content = @Content(mediaType = "application/json", schema = @Schema(implementation = PageResponse.class)))
        })
        @GetMapping
        @ResponseStatus(HttpStatus.OK)
        PageResponse<PatientResponse> searchPatients(
                        @Parameter(description = "Search keyword for name or identifier") @RequestParam(name = "keyword", required = false) String keyword,

                        @Parameter(description = "Full name filter") @RequestParam(name = "fullName", required = false) String fullName,
                        @Parameter(description = "Phone number filter") @RequestParam(name = "phone", required = false) String phone,
                        @Parameter(description = "Identity number filter") @RequestParam(name = "identityNumber", required = false) String identityNumber,
                        @Parameter(description = "Email filter") @RequestParam(name = "email", required = false) String email,
                        @Parameter(description = "Branch code filter") @RequestParam(name = "branchCode", required = false) String branchCode,
                        @Parameter(description = "Phone verification status") @RequestParam(name = "phoneVerified", required = false) Boolean phoneVerified,
                        @Parameter(description = "Email verification status") @RequestParam(name = "emailVerified", required = false) Boolean emailVerified,

                        @Parameter(description = "Page number (0-indexed)") @RequestParam(name = "page", defaultValue = "0") int page,

                        @Parameter(description = "Number of items per page") @RequestParam(name = "size", defaultValue = "10") int size,

                        @Parameter(description = "Sort criteria (field,asc|desc)") @RequestParam(name = "sort", defaultValue = "createdAt,desc") String sort);

        @Operation(summary = "Update patient details", description = "Updates existing patient information")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Patient updated successfully", content = @Content(mediaType = "application/json", schema = @Schema(implementation = PatientResponse.class))),
                        @ApiResponse(responseCode = "400", description = "Invalid input data", content = @Content),
                        @ApiResponse(responseCode = "404", description = "Patient not found", content = @Content)
        })
        @PutMapping("/{patientCode}")
        @ResponseStatus(HttpStatus.OK)
        PatientResponse updatePatient(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Patient update request", required = true) @Valid @RequestBody PatientUpdateRequest request);

        @Operation(summary = "Upload profile photo", description = "Uploads a profile photo for the patient")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Photo uploaded successfully", content = @Content(mediaType = "text/plain", schema = @Schema(type = "string", example = "/path/to/photo.jpg"))),
                        @ApiResponse(responseCode = "404", description = "Patient not found", content = @Content)
        })
        @PostMapping(value = "/{patientCode}/profile-photo", consumes = "multipart/form-data")
        @ResponseStatus(HttpStatus.OK)
        ResponseEntity<String> uploadProfilePhoto(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Image file", required = true) @RequestParam("file") MultipartFile file);

        @Operation(summary = "Get profile photo URL", description = "Retrieves the URL of the patient's profile photo")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "URL retrieved", content = @Content(mediaType = "application/json", schema = @Schema(example = "{\"url\": \"...\"}")))
        })
        @GetMapping("/{patientCode}/profile-photo")
        @ResponseStatus(HttpStatus.OK)
        ResponseEntity<java.util.Map<String, String>> getProfilePhoto(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode);

        @Operation(summary = "Verify email", description = "Verifies patient email using a token")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "302", description = "Redirects to success or error page")
        })
        @GetMapping("/verify-email")
        ResponseEntity<Void> verifyEmail(
                        @Parameter(description = "Verification token", required = true) @RequestParam("token") String token);

        @Operation(summary = "Resend email verification", description = "Resends the email verification link")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Verification email sent")
        })
        @PostMapping("/{patientCode}/resend-verification")
        @ResponseStatus(HttpStatus.OK)
        ResponseEntity<java.util.Map<String, String>> resendEmailVerification(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode);

        @Operation(summary = "Send phone OTP", description = "Sends an OTP to the patient's phone number")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "OTP sent successfully")
        })
        @PostMapping("/{patientCode}/send-phone-otp")
        @ResponseStatus(HttpStatus.OK)
        ResponseEntity<java.util.Map<String, String>> sendPhoneOtp(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode);

        @Operation(summary = "Verify phone OTP", description = "Verifies the OTP sent to the patient's phone")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Phone verified successfully"),
                        @ApiResponse(responseCode = "400", description = "Invalid OTP")
        })
        @PostMapping("/{patientCode}/verify-phone-otp")
        @ResponseStatus(HttpStatus.OK)
        ResponseEntity<java.util.Map<String, String>> verifyPhoneOtp(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "OTP code", required = true) @RequestParam("otp") String otp);

        @Operation(summary = "Get dashboard statistics", description = "Retrieves patient-related statistics for the dashboard")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Statistics retrieved successfully", content = @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardStatisticsResponse.class)))
        })
        @GetMapping("/statistics")
        @ResponseStatus(HttpStatus.OK)
        DashboardStatisticsResponse getDashboardStatistics(
                        @Parameter(description = "Branch code to filter statistics") @RequestParam(name = "branchCode", required = false) String branchCode);
}
