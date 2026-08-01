package com.uom.lims.repository;

import com.uom.lims.entity.TestParameterEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TestParameterRepository extends JpaRepository<TestParameterEntity, UUID> {

    List<TestParameterEntity> findByTestIdOrderByDisplayOrderAsc(UUID testId);

    List<TestParameterEntity> findByLoincCode(String loincCode);

    List<TestParameterEntity> findByTestIdAndLoincCode(UUID testId, String loincCode);

    /** Used by the QC gate to reject a control coded against an analyte nothing measures. */
    boolean existsByLoincCode(String loincCode);

    /** Distinct coded analytes, for the QC run form's analyte picker. */
    @org.springframework.data.jpa.repository.Query(
            "select distinct p.loincCode, p.name from TestParameterEntity p "
                    + "where p.loincCode is not null order by p.name asc")
    java.util.List<Object[]> findControllableAnalytes();
}