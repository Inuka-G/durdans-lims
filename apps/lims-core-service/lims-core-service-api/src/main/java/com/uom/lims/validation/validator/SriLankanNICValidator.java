package com.uom.lims.validation.validator;

import com.uom.lims.validation.annotation.SriLankanNIC;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SriLankanNICValidator implements ConstraintValidator<SriLankanNIC, String> {

    @Override
    public void initialize(SriLankanNIC constraintAnnotation) {
        // No initialization required
    }

    @Override
    public boolean isValid(String nic, ConstraintValidatorContext context) {
        // Null or blank strings are considered valid here.
        // Use @NotBlank separately for required fields to adhere to single
        // responsibility.
        if (nic == null || nic.trim().isEmpty()) {
            return true;
        }

        try {
            SriLankanNICParser.parse(nic);
            return true;
        } catch (InvalidNICException e) {
            // Replace the default static message with the detailed exception reason
            // computed by the parser
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(e.getMessage())
                    .addConstraintViolation();
            return false;
        } catch (Exception e) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("Invalid format: " + e.getMessage())
                    .addConstraintViolation();
            return false;
        }
    }
}
