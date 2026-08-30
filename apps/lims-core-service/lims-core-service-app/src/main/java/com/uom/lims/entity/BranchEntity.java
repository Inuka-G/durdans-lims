package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "branch")
public class BranchEntity extends BaseEntity {

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "location")
    private String location;

    @Column(name = "address")
    private String address;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    /** ACTIVE or INACTIVE. Not an enum column type — kept a plain string so a
     *  new status doesn't need a migration, matching how status is stored
     *  elsewhere in this codebase (e.g. order/sample status columns). */
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "established_date")
    private LocalDate establishedDate;

    @Column(name = "legal_entity_name")
    private String legalEntityName;

    /** Keycloak subject of the assigned branch admin, or null if unassigned. */
    @Column(name = "admin_user_id")
    private String adminUserId;

    /** Denormalized so the branch list/detail views don't need a Keycloak
     *  round-trip per row; kept in sync by BranchService.assignAdmin(). */
    @Column(name = "admin_name")
    private String adminName;

    @Column(name = "admin_email")
    private String adminEmail;
}
