package com.uom.lims.validation.annotation;

import com.uom.lims.validation.validator.DrivingLicenseNumberValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = DrivingLicenseNumberValidator.class)
@Target({ ElementType.METHOD, ElementType.FIELD, ElementType.ANNOTATION_TYPE, ElementType.CONSTRUCTOR,
        ElementType.PARAMETER, ElementType.TYPE_USE })
@Retention(RetentionPolicy.RUNTIME)
public @interface DrivingLicenseNumber {
    String message() default "Invalid Sri Lankan driving license. Must be 7-10 alphanumeric characters with no special characters.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
