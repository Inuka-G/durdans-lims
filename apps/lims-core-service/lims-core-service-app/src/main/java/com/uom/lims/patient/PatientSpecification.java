package com.uom.lims.patient;

import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;

public class PatientSpecification {

    public static Specification<PatientEntity> filterPatients(
            String fullName,
            String phone,
            String identityNumber,
            String email,
            String branchCode,
            Boolean phoneVerified,
            Boolean emailVerified) {

        return (root, query, criteriaBuilder) -> {

            List<Predicate> predicates = new ArrayList<>();

            if (fullName != null && !fullName.isBlank()) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("fullName")),
                        "%" + fullName.toLowerCase().trim() + "%"));
            }

            if (phone != null && !phone.isBlank()) {
                predicates.add(criteriaBuilder.like(
                        root.get("phone"),
                        "%" + phone.trim() + "%"));
            }

            if (identityNumber != null && !identityNumber.isBlank()) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("identityNumber")),
                        "%" + identityNumber.toLowerCase().trim() + "%"));
            }

            if (email != null && !email.isBlank()) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("email")),
                        "%" + email.toLowerCase().trim() + "%"));
            }

            if (branchCode != null && !branchCode.isBlank()) {
                predicates.add(criteriaBuilder.equal(
                        root.get("branchCode"),
                        branchCode.trim()));
            }

            if (phoneVerified != null) {
                predicates.add(criteriaBuilder.equal(
                        root.get("phoneVerified"),
                        phoneVerified));
            }

            if (emailVerified != null) {
                predicates.add(criteriaBuilder.equal(
                        root.get("emailVerified"),
                        emailVerified));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Keyword search (name, phone, patientCode, identityNumber, email) optionally restricted to a branch.
     *
     * @param branchScope branch to restrict to; {@code null} means no restriction
     *                    (enabling universal cross-branch patient search).
     */
    public static Specification<PatientEntity> keywordInBranch(String keyword, String branchScope) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase().trim() + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("fullName")),
                                pattern),
                        criteriaBuilder.like(
                                root.get("phone"),
                                "%" + keyword.trim() + "%"),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("patientCode")),
                                pattern),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("identityNumber")),
                                pattern),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("email")),
                                pattern)));
            }

            if (branchScope != null && !branchScope.isBlank()) {
                predicates.add(criteriaBuilder.equal(root.get("branchCode"), branchScope.trim()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
