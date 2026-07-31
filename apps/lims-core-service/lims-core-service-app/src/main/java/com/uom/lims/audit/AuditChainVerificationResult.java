package com.uom.lims.audit;

/**
 * Outcome of an audit-log hash-chain verification (H3).
 *
 * @param valid          true if every sealed row's hash recomputes and links to its predecessor
 * @param rowsChecked    number of sealed rows walked
 * @param firstBrokenSeq seq of the first row that failed (null when valid)
 * @param firstBrokenId  id (UUID string) of the first row that failed (null when valid)
 * @param message        human-readable summary
 */
public record AuditChainVerificationResult(
        boolean valid,
        long rowsChecked,
        Long firstBrokenSeq,
        String firstBrokenId,
        String message) {

    public static AuditChainVerificationResult ok(long rowsChecked) {
        return new AuditChainVerificationResult(
                true, rowsChecked, null, null,
                "Audit chain intact: " + rowsChecked + " sealed row(s) verified.");
    }

    public static AuditChainVerificationResult broken(long rowsChecked, Long seq, String id, String reason) {
        return new AuditChainVerificationResult(
                false, rowsChecked, seq, id,
                "Audit chain BROKEN at seq=" + seq + " (id=" + id + "): " + reason);
    }
}
