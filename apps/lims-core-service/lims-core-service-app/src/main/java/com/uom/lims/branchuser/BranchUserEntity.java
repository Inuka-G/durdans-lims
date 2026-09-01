package com.uom.lims.branchuser;

import com.uom.lims.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "branch_user")
public class BranchUserEntity extends BaseEntity {

    @Column(name = "branch_id", nullable = false)
    private String branchId;

    @Column(name = "keycloak_id")
    private String keycloakId;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "username")
    private String username;

    @jakarta.persistence.Transient
    private String firstName;

    @jakarta.persistence.Transient
    private String lastName;
}
