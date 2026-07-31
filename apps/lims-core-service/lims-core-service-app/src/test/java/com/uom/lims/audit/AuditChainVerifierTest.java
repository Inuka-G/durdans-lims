package com.uom.lims.audit;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure (no Spring / no DB) coverage of the H3 chain-verification logic: that a
 * correctly-sealed chain verifies, an in-place content edit is detected, and a
 * deletion / re-ordering (broken linkage) is detected. The byte-for-byte agreement
 * between this Java recipe and the PL/pgSQL seal trigger is proven separately by
 * AuditChainIntegrationTest against a real Postgres.
 */
class AuditChainVerifierTest {

    private AuditLog sealedRow(long seq, String prevHash, String action) {
        AuditLog row = new AuditLog();
        row.setId(UUID.randomUUID());
        row.setAction(action);
        row.setEntityType("TEST");
        row.setEntityId(UUID.randomUUID());
        row.setPerformedBy("tester");
        row.setBranchCode("B001");
        row.setTimestamp(LocalDateTime.now().truncatedTo(ChronoUnit.MICROS));
        row.setDetails("{\"k\": \"v\"}");
        row.setSeq(seq);
        row.setPrevHash(prevHash);
        // Seal it the way the trigger would (over the now-complete content).
        row.setRowHash(AuditChainVerifier.computeHash(row));
        return row;
    }

    @Test
    void intactChainVerifies() {
        AuditLog r1 = sealedRow(1, AuditChainVerifier.GENESIS, "CREATE");
        AuditLog r2 = sealedRow(2, r1.getRowHash(), "UPDATE");
        AuditLog r3 = sealedRow(3, r2.getRowHash(), "DELETE");

        AuditChainVerificationResult result = AuditChainVerifier.verify(List.of(r1, r2, r3));

        assertThat(result.valid()).isTrue();
        assertThat(result.rowsChecked()).isEqualTo(3);
    }

    @Test
    void inPlaceContentEditIsDetected() {
        AuditLog r1 = sealedRow(1, AuditChainVerifier.GENESIS, "CREATE");
        AuditLog r2 = sealedRow(2, r1.getRowHash(), "UPDATE");
        // Tamper a field WITHOUT recomputing the hash — exactly what a forger would do.
        r2.setAction("ESCALATE_PRIVILEGE");

        AuditChainVerificationResult result = AuditChainVerifier.verify(List.of(r1, r2));

        assertThat(result.valid()).isFalse();
        assertThat(result.firstBrokenSeq()).isEqualTo(2);
        assertThat(result.message()).contains("does not match its stored hash");
    }

    @Test
    void deletedOrReorderedRowBreaksLinkage() {
        AuditLog r1 = sealedRow(1, AuditChainVerifier.GENESIS, "CREATE");
        AuditLog r2 = sealedRow(2, r1.getRowHash(), "UPDATE");
        AuditLog r3 = sealedRow(3, r2.getRowHash(), "DELETE");

        // Drop r2: r3 still points at r2's hash, which no longer precedes it.
        AuditChainVerificationResult result = AuditChainVerifier.verify(List.of(r1, r3));

        assertThat(result.valid()).isFalse();
        assertThat(result.firstBrokenSeq()).isEqualTo(3);
        assertThat(result.message()).contains("does not link to the preceding row");
    }
}
