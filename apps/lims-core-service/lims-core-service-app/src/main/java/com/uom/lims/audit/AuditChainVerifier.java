package com.uom.lims.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Verifies the tamper-evident audit-log hash chain (H3).
 *
 * <p>Each {@link AuditLog} row is sealed on INSERT by the {@code trg_audit_log_seal}
 * Postgres trigger, which stamps a monotonic {@code seq}, links {@code prev_hash} to
 * the previous row's {@code row_hash}, and computes {@code row_hash} over the row's
 * content. This verifier walks the sealed rows in {@code seq} order and, for each:
 * <ol>
 *   <li>checks {@code prev_hash} equals the predecessor's {@code row_hash}
 *       (genesis = 64 zeros) — detects deletion / re-ordering;</li>
 *   <li>recomputes {@code row_hash} from the stored content and checks it equals the
 *       stored value — detects in-place content edits.</li>
 * </ol>
 *
 * <p>The hash recipe below MUST stay byte-for-byte identical to the PL/pgSQL trigger
 * in {@code 20260619120000_tamper_evident_audit_log.xml}. The
 * {@link AuditChainVerifierTest} unit test guards the comparison logic; the
 * {@code AuditChainIntegrationTest} proves Java and SQL agree against a real DB.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditChainVerifier {

    /** prev_hash of the first (genesis) row. */
    public static final String GENESIS = "0".repeat(64);

    /** Mirrors Postgres {@code to_char(ts,'YYYY-MM-DD"T"HH24:MI:SS.US')}. */
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS");

    private final AuditLogRepository repository;

    /** Loads every sealed row in chain order and verifies the chain. */
    @Transactional(readOnly = true)
    public AuditChainVerificationResult verifyChain() {
        return verify(repository.findByRowHashIsNotNullOrderBySeqAsc());
    }

    /**
     * Pure verification over an already-ordered list of sealed rows. Exposed for unit
     * testing without a database.
     */
    public static AuditChainVerificationResult verify(List<AuditLog> orderedBySeq) {
        String expectedPrev = GENESIS;
        long checked = 0;
        for (AuditLog row : orderedBySeq) {
            checked++;
            String id = row.getId() == null ? null : row.getId().toString();

            if (!equalsSafe(row.getPrevHash(), expectedPrev)) {
                return AuditChainVerificationResult.broken(checked, row.getSeq(), id,
                        "prev_hash does not link to the preceding row (deletion or re-ordering)");
            }

            String recomputed = computeHash(row);
            if (!equalsSafe(recomputed, row.getRowHash())) {
                return AuditChainVerificationResult.broken(checked, row.getSeq(), id,
                        "row content does not match its stored hash (in-place edit)");
            }

            expectedPrev = row.getRowHash();
        }
        return AuditChainVerificationResult.ok(checked);
    }

    /** Recomputes a row's SHA-256 using the exact recipe the seal trigger applies. */
    public static String computeHash(AuditLog row) {
        String input = nz(row.getSeq()) + "|" + nz(row.getPrevHash()) + "|"
                + nz(row.getAction()) + "|"
                + nz(row.getEntityType()) + "|"
                + nz(row.getEntityId()) + "|"
                + nz(row.getPatientCode()) + "|"
                + nz(row.getPerformedBy()) + "|"
                + nz(row.getBranchCode()) + "|"
                + nz(row.getIpAddress()) + "|"
                + (row.getTimestamp() == null ? "" : TS.format(row.getTimestamp())) + "|"
                + nz(row.getDetails());
        return sha256Hex(input);
    }

    private static String nz(Object value) {
        return value == null ? "" : value.toString();
    }

    private static boolean equalsSafe(String a, String b) {
        return a != null && a.equals(b);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
