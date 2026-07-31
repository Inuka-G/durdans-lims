package com.uom.lims.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * WHY: Enables Spring's scheduled task executor so the overdue bill
 * detector runs automatically every hour without manual intervention.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
