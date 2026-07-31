package com.uom.lims.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import com.uom.lims.api.dto.response.ApiResponse;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

        @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
        public ResponseEntity<?> handleOptimisticLockException(ObjectOptimisticLockingFailureException ex) {
                log.warn("Optimistic locking failure: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.CONFLICT.value(),
                                                "error", "Conflict",
                                                "message",
                                                "Record was modified by another user. Please refresh and try again."));
        }

        @ExceptionHandler(DuplicateResourceException.class)
        public ResponseEntity<?> handleDuplicateResource(DuplicateResourceException ex) {
                log.error("Duplicate resource error: {}", ex.getMessage());

                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.CONFLICT.value(),
                                                "error", "Duplicate Resource",
                                                "message", ex.getMessage()));
        }

        @ExceptionHandler(ResourceNotFoundException.class)
        public ResponseEntity<?> handleNotFound(ResourceNotFoundException ex) {
                log.error("Resource not found: {}", ex.getMessage());

                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.NOT_FOUND.value(),
                                                "error", "Not Found",
                                                "message", ex.getMessage()));
        }

        @ExceptionHandler(IOException.class)
        public ResponseEntity<?> handleIOException(IOException ex) {
                log.error("IO error occurred", ex);

                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                                "error", "File Processing Error",
                                                "message", "Failed to process file: " + ex.getMessage()));
        }

        @ExceptionHandler(S3Exception.class)
        public ResponseEntity<?> handleS3Exception(S3Exception ex) {
                log.error("S3 error occurred - Status Code: {}, Error Code: {}",
                                ex.statusCode(), ex.awsErrorDetails().errorCode(), ex);

                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                                "error", "Storage Service Error",
                                                "message", "Failed to upload document to storage: "
                                                                + ex.awsErrorDetails().errorMessage()));
        }

        @ExceptionHandler(IllegalArgumentException.class)
        public ResponseEntity<?> handleIllegalArgument(IllegalArgumentException ex) {
                log.error("Invalid argument: {}", ex.getMessage());

                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.BAD_REQUEST.value(),
                                                "error", "Invalid Request",
                                                "message", ex.getMessage()));
        }

        @ExceptionHandler(InvalidRequestException.class)
        public ResponseEntity<?> handleInvalidRequest(InvalidRequestException ex) {
                log.warn("Invalid request: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.BAD_REQUEST.value(),
                                                "error", "Invalid Request",
                                                "message", ex.getMessage()));
        }

        @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
        public ResponseEntity<?> handleValidationExceptions(
                        org.springframework.web.bind.MethodArgumentNotValidException ex) {
                log.warn("Validation failed: {}", ex.getMessage());
                Map<String, String> errors = new java.util.HashMap<>();
                ex.getBindingResult().getAllErrors().forEach((error) -> {
                        String fieldName = ((org.springframework.validation.FieldError) error).getField();
                        String errorMessage = error.getDefaultMessage();
                        errors.put(fieldName, errorMessage);
                });

                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.BAD_REQUEST.value(),
                                                "error", "Validation Failed",
                                                "message", "Input validation failed",
                                                "details", errors));
        }

        @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
        public ResponseEntity<?> handleUnreadableRequest(
                        org.springframework.http.converter.HttpMessageNotReadableException ex) {
                log.warn("Malformed request body: {}", ex.getMessage());

                String message = "Please check the form values and try again.";
                Throwable cause = ex.getCause();
                if (cause instanceof com.fasterxml.jackson.databind.exc.InvalidFormatException invalidFormat
                                && invalidFormat.getTargetType().isEnum()) {
                        String fieldName = invalidFormat.getPath().isEmpty()
                                        ? "selected field"
                                        : invalidFormat.getPath().get(invalidFormat.getPath().size() - 1).getFieldName();
                        message = "Please choose a valid " + toReadableFieldName(fieldName) + ".";
                }

                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.BAD_REQUEST.value(),
                                                "error", "Invalid Request",
                                                "message", message));
        }

        private String toReadableFieldName(String fieldName) {
                if (fieldName == null || fieldName.isBlank()) {
                        return "selected field";
                }
                return fieldName.replaceAll("([a-z])([A-Z])", "$1 $2").toLowerCase();
        }

        @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
        public ResponseEntity<?> handleNoResourceFoundException(
                        org.springframework.web.servlet.resource.NoResourceFoundException ex) {
                log.warn("Resource not found: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.NOT_FOUND.value(),
                                                "error", "Not Found",
                                                "message", ex.getMessage()));
        }

        // WHY: BusinessValidationException signals a domain rule violation (e.g.
        // discount > 100%).
        // HTTP 422 tells consumers the request was well-formed but semantically
        // rejected.
        @ExceptionHandler(BusinessValidationException.class)
        public ResponseEntity<?> handleBusinessValidation(BusinessValidationException ex) {
                log.warn("Business validation failed: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.UNPROCESSABLE_ENTITY.value(),
                                                "error", "Business Rule Violation",
                                                "message", ex.getMessage()));
        }

        // WHY: InvalidStateTransitionException signals an illegal clinical workflow
        // change
        // (e.g. COMPLETED → PENDING). HTTP 422 distinguishes this from a 403 auth
        // error.
        @ExceptionHandler(InvalidStateTransitionException.class)
        public ResponseEntity<?> handleInvalidStateTransition(InvalidStateTransitionException ex) {
                log.warn("Invalid state transition attempted: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.UNPROCESSABLE_ENTITY.value(),
                                                "error", "Invalid State Transition",
                                                "message", ex.getMessage()));
        }

        // WHY: Spring Security throws AccessDeniedException before reaching the controller.
        // Without this handler it gets caught by the generic Exception handler returning 500.
        // 403 correctly tells the frontend the user lacks the required role.
        @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
        public ResponseEntity<ApiResponse<Object>> handleAccessDenied(
                        org.springframework.security.access.AccessDeniedException ex) {
                log.warn("Access denied for user: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(ApiResponse.error("Access denied — insufficient permissions"));
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<?> handleGenericException(Exception ex) {
                // Do NOT echo ex.getMessage() to the client (it can leak SQL/constraint/
                // stack detail). Log the detail server-side under a correlation id and
                // return only that id so support can locate it. Prefer the request's MDC
                // correlationId (G4/G5) so the id returned matches the one in the logs.
                String correlationId = org.slf4j.MDC.get(com.uom.lims.web.CorrelationIdFilter.MDC_KEY);
                if (correlationId == null || correlationId.isBlank()) {
                        correlationId = java.util.UUID.randomUUID().toString();
                }
                log.error("Unexpected error [{}]", correlationId, ex);

                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                Map.of(
                                                "timestamp", LocalDateTime.now(),
                                                "status", HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                                "error", "Internal Server Error",
                                                "message", "An unexpected error occurred. Reference: " + correlationId,
                                                "correlationId", correlationId));
        }

        @ExceptionHandler(BusinessRuleException.class)
        public ResponseEntity<Map<String, Object>> handleBusinessRuleException(BusinessRuleException ex) {
                Map<String, Object> body = new HashMap<>();
                body.put("timestamp", LocalDateTime.now());
                body.put("status", HttpStatus.UNPROCESSABLE_ENTITY.value());
                body.put("error", "Business Rule Violation");
                body.put("message", ex.getMessage());

                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
        }

}
