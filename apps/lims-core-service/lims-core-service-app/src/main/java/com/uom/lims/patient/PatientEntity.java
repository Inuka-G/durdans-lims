package com.uom.lims.patient;

import com.uom.lims.entity.BaseEntity;
import com.uom.lims.api.common.enums.BloodGroup;
import com.uom.lims.api.common.enums.Gender;
import com.uom.lims.api.common.enums.IdentityType;
import com.uom.lims.api.common.enums.MaritalStatus;
import com.uom.lims.api.common.enums.Title;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "patient")

public class PatientEntity extends BaseEntity {
    @Column(name = "patient_code", nullable = false, unique = true)
    private String patientCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "title")
    private Title title;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "dob", nullable = false)
    private LocalDate dob;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "identity_type")
    private IdentityType identityType;

    @Enumerated(EnumType.STRING)
    @Column(name = "marital_status")
    private MaritalStatus maritalStatus;

    @Column(name = "nationality")
    private String nationality;

    @Enumerated(EnumType.STRING)
    @Column(name = "blood_group")
    private BloodGroup bloodGroup;

    @Column(name = "identity_number", unique = true)
    private String identityNumber;

    @Column(name = "phone", nullable = false, unique = true)
    private String phone;

    @Column(name = "phone_verified", nullable = false)
    private boolean phoneVerified = false;

    @Column(name = "phone_otp_hash")
    private String phoneOtpHash;

    @Column(name = "phone_otp_expiry")
    private LocalDateTime phoneOtpExpiry;

    @Column(name = "phone_otp_attempts")
    private Integer phoneOtpAttempts;

    @Column(name = "last_otp_sent_at")
    private LocalDateTime lastOtpSentAt;

    @Column(name = "phone_resend_count")
    private Integer phoneResendCount = 0;

    @Column(name = "phone_resend_date")
    private LocalDate phoneResendDate;

    @Column(name = "email", unique = true)
    private String email;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "email_verification_token_hash")
    private String emailVerificationTokenHash;

    @Column(name = "email_verification_expiry")
    private LocalDateTime emailVerificationExpiry;

    @Column(name = "last_verification_sent_at")
    private LocalDateTime lastVerificationSentAt;

    @Column(name = "verification_resend_count")
    private Integer verificationResendCount = 0;

    @Column(name = "verification_resend_date")
    private LocalDate verificationResendDate;

    @Column(name = "home_number")
    private String homeNumber;

    @Column(name = "address", nullable = false)
    private String address;

    @Column(name = "contact_person_name")
    private String contactPersonName;

    @Column(name = "contact_person_phone")
    private String contactPersonPhone;

    @Column(name = "profile_photo_path", length = 500)
    private String profilePhotoPath;

    @Column(name = "branch_code")
    private String branchCode;

    // --- PDPA (Sri Lanka) ---
    /** Consent to process the patient's (special-category) health data. */
    @Column(name = "consent_given", nullable = false)
    private boolean consentGiven = false;

    @Column(name = "consent_at")
    private LocalDateTime consentAt;

    @Column(name = "consent_version", length = 32)
    private String consentVersion;

    /** Set true after a right-to-erasure request anonymises this record. */
    @Column(name = "anonymized", nullable = false)
    private boolean anonymized = false;
}