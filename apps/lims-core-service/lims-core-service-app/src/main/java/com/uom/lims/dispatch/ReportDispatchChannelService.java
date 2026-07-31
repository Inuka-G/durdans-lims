package com.uom.lims.dispatch;

import com.uom.lims.api.dispatch.dto.request.DispatchReportRequest;
import com.uom.lims.api.dispatch.enums.DeliveryAttemptStatus;
import com.uom.lims.notification.EmailService;
import com.uom.lims.notification.SmsService;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReportDispatchChannelService {

    private static final String POST_TRACKING_BASE_URL = "https://track.durdans.lk/post/";

    private final EmailService emailService;
    private final SmsService smsService;
    private final PatientRepository patientRepository;

    public void executeChannel(
            ReportDispatchItemEntity item,
            ReportDeliveryAttemptEntity attempt,
            DispatchReportRequest request) {

        LocalDateTime now = LocalDateTime.now();
        attempt.setDispatchedAt(now);

        switch (attempt.getMethod()) {
            case PRINT -> {
                attempt.setStatus(DeliveryAttemptStatus.DELIVERED);
                attempt.setDeliveredAt(now);
                attempt.setFailureReason(null);
            }
            case EMAIL -> {
                String email = firstNonBlank(request.getOverrideEmail(),
                        resolvePatientEmail(item.getPatientCode()));
                if (email == null) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("NO_EMAIL: Patient has no email and no override was provided");
                    return;
                }
                attempt.setRecipientContact(email);
                try {
                    emailService.sendLabReportEmail(
                            email,
                            item.getPatientDisplayName(),
                            item.getReportReference(),
                            item.getTestPanelLabel(),
                            item.getArtifactUri());
                    attempt.setStatus(DeliveryAttemptStatus.DELIVERED);
                    attempt.setDeliveredAt(LocalDateTime.now());
                    attempt.setFailureReason(null);
                } catch (RuntimeException ex) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("EMAIL_SEND_FAILED: " + truncate(ex.getMessage(), 900));
                }
            }
            case SMS -> {
                String phone = firstNonBlank(request.getOverridePhone(),
                        resolvePatientPhone(item.getPatientCode()));
                if (phone == null) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("NO_PHONE: Patient has no phone and no override was provided");
                    return;
                }
                attempt.setRecipientContact(phone);
                try {
                    String msg = "Durdans Lab: Report " + item.getReportReference() + " is ready. "
                            + (item.getArtifactUri() != null && !item.getArtifactUri().isBlank()
                                    ? "Link: " + item.getArtifactUri()
                                    : "Collect from laboratory.");
                    smsService.sendSms(phone, msg);
                    attempt.setStatus(DeliveryAttemptStatus.DELIVERED);
                    attempt.setDeliveredAt(LocalDateTime.now());
                    attempt.setFailureReason(null);
                } catch (RuntimeException ex) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("SMS_SEND_FAILED: " + truncate(ex.getMessage(), 900));
                }
            }
            case WHATSAPP -> {
                String phone = firstNonBlank(request.getOverrideWhatsappPhone(),
                        firstNonBlank(request.getOverridePhone(), resolvePatientPhone(item.getPatientCode())));
                if (phone == null) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("NO_WHATSAPP_PHONE: Patient has no phone and no override was provided");
                    return;
                }
                attempt.setRecipientContact(phone);
                try {
                    String msg = "Durdans Lab WhatsApp: Report " + item.getReportReference()
                            + " (" + item.getTestPanelLabel() + ") is ready. "
                            + (item.getArtifactUri() != null && !item.getArtifactUri().isBlank()
                                    ? "Document: " + item.getArtifactUri()
                                    : "Please collect the printed report from laboratory reception.");
                    smsService.sendSms(phone, msg);
                    attempt.setStatus(DeliveryAttemptStatus.DELIVERED);
                    attempt.setDeliveredAt(LocalDateTime.now());
                    attempt.setFailureReason(null);
                } catch (RuntimeException ex) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("WHATSAPP_SEND_FAILED: " + truncate(ex.getMessage(), 900));
                }
            }
            case POST -> {
                String address = firstNonBlank(request.getPostalAddress(), resolvePatientAddress(item.getPatientCode()));
                if (address == null) {
                    attempt.setStatus(DeliveryAttemptStatus.FAILED);
                    attempt.setFailureReason("NO_POSTAL_ADDRESS: Patient has no address and no override was provided");
                    return;
                }
                String trackingNumber = firstNonBlank(request.getTrackingNumber(), generateTrackingNumber(item));
                attempt.setRecipientContact(address);
                attempt.setTrackingNumber(trackingNumber);
                attempt.setTrackingUrl(POST_TRACKING_BASE_URL + trackingNumber);
                attempt.setStatus(DeliveryAttemptStatus.SENT);
                attempt.setFailureReason(null);
            }
            case PORTAL -> {
                attempt.setStatus(DeliveryAttemptStatus.DELIVERED);
                attempt.setDeliveredAt(now);
                attempt.setFailureReason(null);
            }
        }
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a.trim();
        }
        if (b != null && !b.isBlank()) {
            return b.trim();
        }
        return null;
    }

    private String resolvePatientEmail(String patientCode) {
        if (patientCode == null || patientCode.isBlank()) {
            return null;
        }
        Optional<PatientEntity> p = patientRepository.findByPatientCode(patientCode.trim());
        return p.map(PatientEntity::getEmail).filter(e -> e != null && !e.isBlank()).orElse(null);
    }

    private String resolvePatientPhone(String patientCode) {
        if (patientCode == null || patientCode.isBlank()) {
            return null;
        }
        Optional<PatientEntity> p = patientRepository.findByPatientCode(patientCode.trim());
        if (p.isEmpty()) {
            return null;
        }
        PatientEntity pe = p.get();
        if (pe.getPhone() != null && !pe.getPhone().isBlank()) {
            return pe.getPhone().trim();
        }
        return null;
    }

    private String resolvePatientAddress(String patientCode) {
        if (patientCode == null || patientCode.isBlank()) {
            return null;
        }
        Optional<PatientEntity> p = patientRepository.findByPatientCode(patientCode.trim());
        return p.map(PatientEntity::getAddress).filter(a -> a != null && !a.isBlank()).orElse(null);
    }

    private static String generateTrackingNumber(ReportDispatchItemEntity item) {
        String branch = item.getBranchCode() == null ? "BR" : item.getBranchCode().replaceAll("[^A-Za-z0-9]", "");
        String suffix = item.getReportReference() == null
                ? Long.toHexString(System.nanoTime()).toUpperCase()
                : Integer.toHexString(item.getReportReference().hashCode()).replace("-", "").toUpperCase();
        return "DUR-" + branch + "-" + suffix;
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
