import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import keycloak from './keycloak';

const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11000',
    headers: {
        'Content-Type': 'application/json'
    }
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (keycloak && keycloak.token) {
        config.headers.Authorization = `Bearer ${keycloak.token}`;
    }
    return config;
}, (error: AxiosError) => {
    return Promise.reject(error);
});

axiosInstance.interceptors.response.use((response: AxiosResponse) => {
    return response;
}, (error: AxiosError) => {
    if (error.response) {
        if (error.response.status === 401) {
            if (keycloak) keycloak.logout();
        } else if (error.response.status === 403) {
            console.error('Access Denied: You do not have permission for this action.');
            // A toast or alert could be fired here
        }
    }
    return Promise.reject(error);
});

export default axiosInstance;
