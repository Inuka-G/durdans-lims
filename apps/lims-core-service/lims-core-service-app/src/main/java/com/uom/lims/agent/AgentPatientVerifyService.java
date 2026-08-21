package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.dto.response.AgentPatientVerifyResponse;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import com.uom.lims.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * WHY: lets a patient ask "is my report ready" without hunting for an order number.
 * The channel proves possession of the phone; the patient proves knowledge of the name
 * and identity number on the record. Both hold, or nothing is said.
 *
 * <p>The matching is deliberately forgiving on the things people get slightly wrong
 * (a NIC typed without its trailing V, a name given as "Nimal Perera" against a record
 * of "M. Nimal Perera") and strict on the thing that matters: the identity number is
 * compared whole after normalisation, never by a trailing fragment. Every failure mode
 * returns the same empty answer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentPatientVerifyService {

    static final int RECENT_ORDERS = 5;

    private final PatientRepository patientRepository;
    private final OrderRepository orderRepository;
    private final AgentOrderStatusService orderStatusService;

    @Transactional(readOnly = true)
    public AgentPatientVerifyResponse verify(String requesterPhone, String identityNumber, String fullName) {
        if (isBlank(requesterPhone) || isBlank(identityNumber) || isBlank(fullName)) {
            return AgentPatientVerifyResponse.notVerified();
        }
        String tail = phoneTail(requesterPhone);
        if (tail == null) {
            return AgentPatientVerifyResponse.notVerified();
        }

        PatientEntity patient = patientRepository.findByPhoneEndingWith(tail).stream()
                .filter(candidate -> AgentOrderStatusService.phoneMatches(candidate.getPhone(), requesterPhone))
                .findFirst()
                .orElse(null);
        if (patient == null) {
            log.info("Agent patient verify: no patient on phone {}", PiiMasker.maskPhone(requesterPhone));
            return AgentPatientVerifyResponse.notVerified();
        }
        if (!identityMatches(patient.getIdentityNumber(), identityNumber)
                || !nameMatches(patient.getFullName(), fullName)) {
            // Same response as "no such phone" so a holder of the phone cannot tell
            // which factor failed. The log line is the audit trail.
            log.warn("Agent patient verify: knowledge check failed for patient {} (requester {})",
                    patient.getPatientCode(), PiiMasker.maskPhone(requesterPhone));
            return AgentPatientVerifyResponse.notVerified();
        }

        List<AgentOrderStatusResponse> recent = orderRepository
                .findAllByPatientIdAndDeletedFalse(patient.getPatientCode(),
                        PageRequest.of(0, RECENT_ORDERS, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(orderStatusService::describe)
                .toList();

        log.info("Agent patient verify: verified patient {} with {} recent order(s)",
                patient.getPatientCode(), recent.size());
        return new AgentPatientVerifyResponse(true, firstNameOf(patient.getFullName()), recent);
    }

    /**
     * Whole-value compare after normalisation. Old-format NICs are nine digits plus a
     * letter (V/X) that people routinely omit when saying it aloud; the letter is
     * dropped from both sides before comparing so "912345678" matches "912345678V",
     * while "12345678" does not match anything.
     */
    static boolean identityMatches(String onRecord, String stated) {
        String a = normaliseIdentity(onRecord);
        String b = normaliseIdentity(stated);
        return a != null && b != null && a.equals(b);
    }

    private static String normaliseIdentity(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (cleaned.length() == 10 && (cleaned.endsWith("V") || cleaned.endsWith("X"))) {
            cleaned = cleaned.substring(0, 9);
        }
        return cleaned.length() < 9 ? null : cleaned;
    }

    /**
     * At least one real name token (three letters or more) the patient said appears in
     * the record. Lenient on purpose — initials, honorifics and spelling vary — because
     * the identity number is the hard factor; the name guards against a typo'd NIC that
     * happens to be someone else's.
     */
    static boolean nameMatches(String onRecord, String stated) {
        if (onRecord == null || stated == null) {
            return false;
        }
        Set<String> recordTokens = tokens(onRecord);
        return tokens(stated).stream().anyMatch(recordTokens::contains);
    }

    private static Set<String> tokens(String name) {
        return Arrays.stream(name.toLowerCase(Locale.ROOT).split("[^\\p{L}]+"))
                .filter(token -> token.length() >= 3)
                .collect(Collectors.toSet());
    }

    static String firstNameOf(String fullName) {
        if (fullName == null) {
            return null;
        }
        for (String token : fullName.trim().split("\\s+")) {
            // Skip initials ("M.", "K") so the agent says "Nimal", not "M".
            String bare = token.replace(".", "");
            if (bare.length() >= 3) {
                return bare;
            }
        }
        return fullName.trim();
    }

    private static String phoneTail(String phone) {
        String digits = phone.replaceAll("\\D", "");
        return digits.length() < 9 ? null : digits.substring(digits.length() - 9);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
