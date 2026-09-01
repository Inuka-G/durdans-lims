import axios from "axios";

export interface MetricDataResponse {
    timestamp: string;
    value: number;
}

export interface LogEventResponse {
    timestamp: string;
    message: string;
    level: string;
}

const apiClient = axios.create({
    baseURL: "/api/v1/superadmin/monitoring",
});

export const monitoringApi = {
    getMetrics: async (metricName: string, hoursAgo: number = 1): Promise<MetricDataResponse[]> => {
        const response = await apiClient.get<MetricDataResponse[]>("/metrics", {
            params: { metricName, hoursAgo }
        });
        return response.data;
    },

    getLogs: async (limit: number = 100): Promise<LogEventResponse[]> => {
        const response = await apiClient.get<LogEventResponse[]>("/logs", {
            params: { limit }
        });
        return response.data;
    }
};
