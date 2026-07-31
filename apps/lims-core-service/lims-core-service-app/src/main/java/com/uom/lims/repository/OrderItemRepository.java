package com.uom.lims.repository;

import com.uom.lims.entity.OrderItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * WHY: Exposes persistent operations for isolated test line items related to clinical tracking and sampling.
 */
@Repository
public interface OrderItemRepository extends JpaRepository<OrderItemEntity, UUID> {
    List<OrderItemEntity> findAllByOrderIdAndDeletedFalse(UUID orderId);
}
