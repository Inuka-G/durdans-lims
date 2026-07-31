package com.uom.lims.entity;

import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.Priority;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * WHY: Serves as the aggregate root for a clinical encounter mapping patient
 * tests and tracking fulfillment status.
 */
@Entity
@Table(name = "orders")
@Getter
@Setter
public class OrderEntity extends BaseEntity {

    @Column(name = "order_no", unique = true, nullable = false)
    private String orderNo;

    @Column(name = "patient_id", nullable = false)
    private String patientId;

    /** Owning branch, denormalised from the patient at creation, for tenant isolation. */
    @Column(name = "branch_code")
    private String branchCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    private Priority priority = Priority.NORMAL;

    @Column(name = "referring_doctor")
    private String referringDoctor;

    @Column(name = "referring_department")
    private String referringDepartment;

    @Column(name = "remarks")
    private String remarks;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<OrderItemEntity> items = new ArrayList<>();

    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private BillEntity bill;
}
