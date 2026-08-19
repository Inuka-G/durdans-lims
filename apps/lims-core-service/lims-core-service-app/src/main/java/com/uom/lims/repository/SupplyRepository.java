package com.uom.lims.repository;

import com.uom.lims.api.enums.TubeType;
import com.uom.lims.entity.SupplyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplyRepository extends JpaRepository<SupplyEntity, UUID> {

    List<SupplyEntity> findAllByDeletedFalseOrderByItemNoAsc();

    Optional<SupplyEntity> findByIdAndDeletedFalse(UUID id);

    boolean existsByItemNoIgnoreCaseAndDeletedFalse(String itemNo);

    boolean existsByNameIgnoreCaseAndDeletedFalse(String name);

    boolean existsByIdAndDeletedFalse(UUID id);

    Optional<SupplyEntity> findByTubeTypeAndDeletedFalse(TubeType tubeType);

    boolean existsByTubeTypeAndDeletedFalse(TubeType tubeType);

    /**
     * WHY: Two phlebotomists collecting at the same instant must not both pass a
     * read-then-write stock check. The stock guard lives in the WHERE clause so the
     * database decides, and the version is bumped by hand because a bulk update
     * bypasses the optimistic-locking increment.
     *
     * @return 1 when a tube was deducted, 0 when the tube is out of stock or unknown
     */
    @Modifying
    @Query("update SupplyEntity s set s.currentStock = s.currentStock - 1, s.version = s.version + 1 "
            + "where s.tubeType = :tubeType and s.deleted = false and s.currentStock > 0")
    int decrementStockByOne(@Param("tubeType") TubeType tubeType);

    /**
     * WHY: A restock has to add to the count on the shelf right now, not to the count the
     * browser rendered before the morning's collections deducted from it, so the addition
     * happens inside the statement. The floor guard sits in the WHERE clause for the same
     * reason, and the version is bumped by hand because a bulk update bypasses the
     * optimistic-locking increment.
     *
     * @return 1 when the adjustment was applied, 0 when the row is gone or the delta would
     *         drive stock below zero
     */
    @Modifying
    @Query("update SupplyEntity s set s.currentStock = s.currentStock + :delta, s.version = s.version + 1 "
            + "where s.id = :id and s.deleted = false and s.currentStock + :delta >= 0")
    int adjustStockBy(@Param("id") UUID id, @Param("delta") int delta);
}
