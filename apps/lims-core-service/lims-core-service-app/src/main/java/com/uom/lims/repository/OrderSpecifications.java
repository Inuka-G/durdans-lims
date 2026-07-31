package com.uom.lims.repository;

import com.uom.lims.entity.OrderEntity;
import org.springframework.data.jpa.domain.Specification;

/**
 * Composable predicates for order queries. The branch predicate is the tenant
 * isolation control: callers pass {@code SecurityUtils.resolveBranchScope()},
 * where {@code null} (SUPER_ADMIN only) means "all branches".
 */
public final class OrderSpecifications {

    private OrderSpecifications() {
    }

    public static Specification<OrderEntity> notDeleted() {
        return (root, query, cb) -> cb.isFalse(root.get("deleted"));
    }

    public static Specification<OrderEntity> forPatient(String patientId) {
        return (root, query, cb) -> (patientId == null || patientId.isBlank())
                ? cb.conjunction()
                : cb.equal(root.get("patientId"), patientId);
    }

    public static Specification<OrderEntity> inBranch(String branchScope) {
        return (root, query, cb) -> (branchScope == null)
                ? cb.conjunction()
                : cb.equal(root.get("branchCode"), branchScope);
    }
}
