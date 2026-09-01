package com.uom.lims.superadmin.monitoring;

import com.uom.lims.api.superadmin.monitoring.MonitoringApi;
import com.uom.lims.api.superadmin.monitoring.dto.LogEventResponse;
import com.uom.lims.api.superadmin.monitoring.dto.MetricDataResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class MonitoringController implements MonitoringApi {

    private final MonitoringService monitoringService;

    @Override
    public List<MetricDataResponse> getMetrics(String metricName, int hoursAgo) {
        return monitoringService.getMetrics(metricName, hoursAgo);
    }

    @Override
    public List<LogEventResponse> getLogs(int limit) {
        return monitoringService.getLogs(limit);
    }
}
