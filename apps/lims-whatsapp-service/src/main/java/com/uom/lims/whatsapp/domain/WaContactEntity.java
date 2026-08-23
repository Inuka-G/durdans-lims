package com.uom.lims.whatsapp.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * A WhatsApp user we have exchanged messages with, keyed by the {@code wa_id} Meta
 * gives us.
 *
 * <p>{@link #patientCode} is set only after an OTP binding succeeds, and it is a
 * reference to a record in the core service, not a foreign key — this database holds
 * no clinical data. Until it is set, the agent may answer catalogue questions and
 * nothing else: a WhatsApp number identifies a handset, not a person.
 */
@Entity
@Table(name = "wa_contact")
@Getter
@Setter
public class WaContactEntity extends WaBaseEntity {

    @Column(name = "wa_id", nullable = false, unique = true, length = 32)
    private String waId;

    @Column(name = "display_name")
    private String displayName;

    /** si | ta | en. Detected on first contact, overridable by the patient. */
    @Column(name = "locale", nullable = false, length = 8)
    private String locale = "en";

    @Column(name = "patient_code", length = 64)
    private String patientCode;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "blocked", nullable = false)
    private boolean blocked = false;

    /**
     * What their last voice call was about — a topic line derived from the tools that
     * ran ("report status", "test prices (FBC)"), never from anything the caller said.
     * It exists so the next call can open like a second conversation instead of a first
     * one; it is not a transcript and must never become one.
     */
    @Column(name = "last_call_summary", length = 255)
    private String lastCallSummary;

    @Column(name = "last_call_at")
    private Instant lastCallAt;

    public boolean isIdentityVerified() {
        return patientCode != null && !patientCode.isBlank() && verifiedAt != null;
    }
}
