package com.uom.lims.patient;

import com.uom.lims.api.patient.PatientApi;
import com.uom.lims.api.patient.dto.request.PatientCreateRequest;
import com.uom.lims.api.patient.dto.request.PatientUpdateRequest;
import com.uom.lims.api.patient.dto.response.DashboardStatisticsResponse;
import com.uom.lims.api.patient.dto.response.PatientResponse;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/patients")
public class PatientController implements PatientApi {

        private final PatientService patientService;

        @PreAuthorize("hasRole('FRONT_DESK')")
        @Override
        public PatientResponse registerPatient(
                        @Valid @RequestBody PatientCreateRequest request) {

                String ipAddress = "0.0.0.0"; // Placeholder or fetch from context
                return patientService.registerPatient(request, ipAddress);
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','MLT','PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','PATHOLOGIST')")
        @Override
        public PatientResponse getPatientByCode(
                        @PathVariable String patientCode) {

                return patientService.getPatientByCode(patientCode);
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','MLT','PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public PageResponse<PatientResponse> searchPatients(
                        @RequestParam(defaultValue = "") String keyword,
                        @RequestParam(required = false) String fullName,
                        @RequestParam(required = false) String phone,
                        @RequestParam(required = false) String identityNumber,
                        @RequestParam(required = false) String email,
                        @RequestParam(required = false) String branchCode,
                        @RequestParam(required = false) Boolean phoneVerified,
                        @RequestParam(required = false) Boolean emailVerified,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestParam(defaultValue = "createdAt,desc") String sort) {

                // Parse sort string "field,direction"
                String[] sortParts = sort.split(",");
                String sortBy = sortParts[0];
                String direction = sortParts.length > 1 ? sortParts[1] : "desc";

                // If advanced filters are present, delegate to advanced search
                if (fullName != null || phone != null || identityNumber != null || email != null || branchCode != null
                                || phoneVerified != null || emailVerified != null) {
                        Page<PatientResponse> pageResult = patientService.advancedSearchPatients(
                                        fullName,
                                        phone,
                                        identityNumber,
                                        email,
                                        branchCode,
                                        phoneVerified,
                                        emailVerified,
                                        page,
                                        size,
                                        sortBy,
                                        direction);
                        return new PageResponse<>(
                                        pageResult.getContent(),
                                        pageResult.getNumber(),
                                        pageResult.getSize(),
                                        pageResult.getTotalElements(),
                                        pageResult.getTotalPages(),
                                        pageResult.isLast());
                }

                Page<PatientResponse> pageResult = patientService.searchPatients(keyword, page, size, sortBy,
                                direction);

                return new PageResponse<>(
                                pageResult.getContent(),
                                pageResult.getNumber(),
                                pageResult.getSize(),
                                pageResult.getTotalElements(),
                                pageResult.getTotalPages(),
                                pageResult.isLast());
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public ResponseEntity<String> uploadProfilePhoto(
                        @PathVariable String patientCode,
                        @RequestParam("file") MultipartFile file) {

                try {
                        String ipAddress = "0.0.0.0";
                        String photoPath = patientService.updateProfilePhoto(patientCode, file, ipAddress);
                        return ResponseEntity.ok(photoPath);
                } catch (java.io.IOException e) {
                        throw new RuntimeException("Failed to upload photo", e);
                }
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public ResponseEntity<Map<String, String>> getProfilePhoto(
                        @PathVariable String patientCode) {

                String url = patientService.getProfilePhotoUrl(patientCode);

                return ResponseEntity.ok(Map.of("url", url));
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public PatientResponse updatePatient(
                        @PathVariable String patientCode,
                        @Valid @RequestBody PatientUpdateRequest request) {

                String ipAddress = "0.0.0.0";
                return patientService.updatePatientProfile(patientCode, request, ipAddress);
        }

        @Override
        @GetMapping("/verify-email")
        public ResponseEntity<Void> verifyEmail(
                        @RequestParam("token") String token) {

                String ipAddress = "0.0.0.0";
                boolean success = patientService.verifyEmail(token, ipAddress);

                if (success) {
                        return ResponseEntity
                                        .status(HttpStatus.FOUND)
                                        .header(HttpHeaders.LOCATION, "/email-verification-success.html")
                                        .build();
                } else {
                        return ResponseEntity
                                        .status(HttpStatus.FOUND)
                                        .header(HttpHeaders.LOCATION, "/email-verification-error.html")
                                        .build();
                }
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public ResponseEntity<java.util.Map<String, String>> resendEmailVerification(
                        @PathVariable String patientCode) {

                String ipAddress = "0.0.0.0";
                patientService.resendEmailVerification(patientCode, ipAddress);

                return ResponseEntity.ok(
                                Map.of("message", "Verification email sent successfully"));
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public ResponseEntity<java.util.Map<String, String>> sendPhoneOtp(
                        @PathVariable String patientCode) {

                String ipAddress = "0.0.0.0";
                patientService.sendPhoneOtp(patientCode, ipAddress);
                return ResponseEntity.ok(Map.of("message", "OTP sent"));
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public ResponseEntity<java.util.Map<String, String>> verifyPhoneOtp(
                        @PathVariable String patientCode,
                        @RequestParam("otp") String otp) {

                String ipAddress = "0.0.0.0";
                patientService.verifyPhoneOtp(patientCode, otp, ipAddress);
                return ResponseEntity.ok(Map.of("message", "Phone verified"));
        }

        @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
        @Override
        public DashboardStatisticsResponse getDashboardStatistics(
                        @RequestParam(name = "branchCode", required = false) String branchCode) {

                // Tenant isolation: a SUPER_ADMIN may scope to any branch (or all
                // when blank); every other user is pinned to their own branch.
                String effectiveBranchCode = SecurityUtils.isSuperAdmin()
                                ? ((branchCode == null || branchCode.isBlank()) ? null : branchCode)
                                : SecurityUtils.getCurrentBranchId();

                return patientService.getDashboardStatistics(effectiveBranchCode);
        }

}
