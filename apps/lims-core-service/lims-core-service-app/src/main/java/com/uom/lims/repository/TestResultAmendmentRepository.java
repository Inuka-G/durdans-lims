package com.uom.lims.repository;

import com.uom.lims.entity.TestResultAmendmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TestResultAmendmentRepository extends JpaRepository<TestResultAmendmentEntity, UUID> {

    /** Amendment history for a result, newest version first. */
    List<TestResultAmendmentEntity> findByTestResultIdOrderByVersionNoDesc(UUID testResultId);
}
