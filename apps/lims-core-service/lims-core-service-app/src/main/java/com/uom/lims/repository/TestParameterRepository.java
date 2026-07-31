package com.uom.lims.repository;

import com.uom.lims.entity.TestParameterEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TestParameterRepository extends JpaRepository<TestParameterEntity, UUID> {

    List<TestParameterEntity> findByTestIdOrderByDisplayOrderAsc(UUID testId);

    List<TestParameterEntity> findByLoincCode(String loincCode);

    List<TestParameterEntity> findByTestIdAndLoincCode(UUID testId, String loincCode);
}