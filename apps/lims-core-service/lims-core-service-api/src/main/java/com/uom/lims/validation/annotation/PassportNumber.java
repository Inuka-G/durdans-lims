package com.uom.lims.validation.annotation;

import com.uom.lims.validation.validator.PassportNumberValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = PassportNumberValidator.class)
@Target({ ElementType.METHOD, ElementType.FIELD, ElementType.ANNOTATION_TYPE, ElementType.CONSTRUCTOR,
        ElementType.PARAMETER, ElementType.TYPE_USE })
@Retention(RetentionPolicy.RUNTIME)
public @interface PassportNumber {
    String message() default "Invalid Sri Lankan passport number format. Must start with 1 or 2 uppercase letters followed by exactly 7 digits.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
