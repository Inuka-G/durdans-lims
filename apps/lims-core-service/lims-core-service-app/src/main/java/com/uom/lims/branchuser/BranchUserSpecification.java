package com.uom.lims.branchuser;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;

public class BranchUserSpecification {

    public static Specification<BranchUserEntity> search(String branchId, String keyword, Boolean isActive) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(branchId)) {
                predicates.add(cb.equal(root.get("branchId"), branchId));
            }

            if (StringUtils.hasText(keyword)) {
                String searchKey = "%" + keyword.toLowerCase() + "%";
                Predicate namePredicate = cb.like(cb.lower(root.get("fullName")), searchKey);
                Predicate emailPredicate = cb.like(cb.lower(root.get("email")), searchKey);
                Predicate phonePredicate = cb.like(cb.lower(root.get("phone")), searchKey);
                predicates.add(cb.or(namePredicate, emailPredicate, phonePredicate));
            }

            if (isActive != null) {
                predicates.add(cb.equal(root.get("isActive"), isActive));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
