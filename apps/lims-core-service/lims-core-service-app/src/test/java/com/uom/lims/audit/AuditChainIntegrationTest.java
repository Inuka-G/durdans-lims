package com.uom.lims.audit;

import com.uom.lims.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves the H3 tamper-evident audit log against a real Postgres:
 * <ul>
 *   <li>rows written through {@link AuditService} are sealed by the DB trigger and the
 *       chain verifies — which only holds if the Java {@link AuditChainVerifier} recipe
 *       agrees byte-for-byte with the PL/pgSQL seal trigger;</li>
 *   <li>UPDATE and DELETE on {@code audit_log} are rejected by the append-only trigger
 *       (the real immutability guarantee, since the app runs as the DB superuser).</li>
 * </ul>
 */
class AuditChainIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private AuditService auditService;

    @Autowired
    private AuditChainVerifier auditChainVerifier;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void writtenRowsAreSealedAndChainVerifies() {
        long before = auditChainVerifier.verifyChain().rowsChecked();

        auditService.writeStandalone("CHAIN_TEST", "AUDIT_TEST", UUID.randomUUID(),
                "P-CHAIN-1", "{\"step\":\"one\"}", "10.0.0.1");
        auditService.writeStandalone("CHAIN_TEST", "AUDIT_TEST", UUID.randomUUID(),
                "P-CHAIN-2", "{\"step\":\"two\"}", null);
        auditService.writeStandalone("CHAIN_TEST", "AUDIT_TEST", null,
                null, null, null);

        AuditChainVerificationResult result = auditChainVerifier.verifyChain();

        assertThat(result.valid())
                .as("the Java recipe must reproduce the DB-trigger hash for every sealed row: %s", result.message())
                .isTrue();
        assertThat(result.rowsChecked()).isGreaterThanOrEqualTo(before + 3);
    }

    @Test
    void updateOnAuditLogIsRejectedByTrigger() {
        auditService.writeStandalone("CHAIN_TEST", "AUDIT_TEST", UUID.randomUUID(),
                "P-IMMUT-1", "{\"v\":1}", null);
        Long seq = jdbcTemplate.queryForObject("SELECT max(seq) FROM audit_log", Long.class);

        assertThatThrownBy(() ->
                jdbcTemplate.update("UPDATE audit_log SET action = 'TAMPERED' WHERE seq = ?", seq))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void deleteOnAuditLogIsRejectedByTrigger() {
        auditService.writeStandalone("CHAIN_TEST", "AUDIT_TEST", UUID.randomUUID(),
                "P-IMMUT-2", "{\"v\":2}", null);
        Long seq = jdbcTemplate.queryForObject("SELECT max(seq) FROM audit_log", Long.class);

        assertThatThrownBy(() ->
                jdbcTemplate.update("DELETE FROM audit_log WHERE seq = ?", seq))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }
}
