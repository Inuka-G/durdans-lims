package com.uom.lims.api.superadmin.monitoring;

import com.uom.lims.api.superadmin.monitoring.dto.MetricDataResponse;
import com.uom.lims.api.superadmin.monitoring.dto.LogEventResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RequestMapping("/api/v1/superadmin/monitoring")
public interface MonitoringApi {

    @GetMapping("/metrics")
    List<MetricDataResponse> getMetrics(
            @RequestParam String metricName,
            @RequestParam(defaultValue = "1") int hoursAgo);

    @GetMapping("/logs")
    List<LogEventResponse> getLogs(
            @RequestParam(defaultValue = "100") int limit);
}
