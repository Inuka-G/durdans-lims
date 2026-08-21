package com.uom.lims.repository;

import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.entity.TestResultEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TestResultRepository extends JpaRepository<TestResultEntity, UUID> {

    List<TestResultEntity> findBySampleId(UUID sampleId);

    List<TestResultEntity> findBySampleIdIn(List<UUID> sampleIds);

    Optional<TestResultEntity> findBySampleIdAndParameterId(UUID sampleId, UUID parameterId);

    Page<TestResultEntity> findByStatusAndDraftFalse(ResultStatus status, Pageable pageable);

    Page<TestResultEntity> findByStatusInAndDraftFalse(List<ResultStatus> statuses, Pageable pageable);

    List<TestResultEntity> findByStatusInAndDraftFalse(List<ResultStatus> statuses);

    /**
     * Everything waiting on the supervisor: freshly ENTERED rows, plus returned rows
     * (either direction) whose specimen is back in the verification queue — a
     * returned row on a specimen still with the MLT is the MLT's, not the supervisor's.
     */
    @Query("""
            select tr
            from TestResultEntity tr
            join tr.sample s
            where tr.draft = false
              and tr.deleted = false
              and s.deleted = false
              and (
                    tr.status = :enteredStatus
                    or (
                        tr.status in (:returnedStatuses)
                        and s.status = :supervisorQueueStatus
                    )
              )
            """)
    Page<TestResultEntity> findSupervisorPendingResults(
            @Param("enteredStatus") ResultStatus enteredStatus,
            @Param("returnedStatuses") List<ResultStatus> returnedStatuses,
            @Param("supervisorQueueStatus") SampleStatus supervisorQueueStatus,
            Pageable pageable);

    @Query("""
            select tr
            from TestResultEntity tr
            join tr.sample s
            where tr.draft = false
              and tr.deleted = false
              and s.deleted = false
              and (
                    tr.status = :enteredStatus
                    or (
                        tr.status in (:returnedStatuses)
                        and s.status = :supervisorQueueStatus
                    )
              )
            """)
    List<TestResultEntity> findSupervisorPendingResults(
            @Param("enteredStatus") ResultStatus enteredStatus,
            @Param("returnedStatuses") List<ResultStatus> returnedStatuses,
            @Param("supervisorQueueStatus") SampleStatus supervisorQueueStatus);

    @Query("""
            select tr
            from TestResultEntity tr
            join tr.sample s
            join s.orderItem oi
            join oi.order o
            where o.patientId = :patientId
              and oi.testId = :testId
              and s.id <> :sampleId
              and coalesce(s.collectedAt, s.createdAt) < :currentVisitAt
              and tr.deleted = false
              and s.deleted = false
              and oi.deleted = false
              and o.deleted = false
            order by coalesce(s.collectedAt, s.createdAt) desc, s.id desc, tr.createdAt desc
            """)
    List<TestResultEntity> findPreviousResultsForPatientAndTest(
            @Param("patientId") String patientId,
            @Param("testId") UUID testId,
            @Param("sampleId") UUID sampleId,
            @Param("currentVisitAt") Instant currentVisitAt
    );

    /** Prior numeric results for the same patient + parameter, most recent first (for delta checks). */
    @Query("""
            select tr
            from TestResultEntity tr
            join tr.sample s
            join s.orderItem oi
            join oi.order o
            where o.patientId = :patientId
              and tr.parameter.id = :parameterId
              and s.id <> :sampleId
              and tr.resultNumeric is not null
              and tr.deleted = false
              and s.deleted = false
            order by coalesce(s.collectedAt, s.createdAt) desc, tr.createdAt desc
            """)
    List<TestResultEntity> findPriorNumericResults(
            @Param("patientId") String patientId,
            @Param("parameterId") UUID parameterId,
            @Param("sampleId") UUID sampleId,
            org.springframework.data.domain.Pageable pageable);
}
