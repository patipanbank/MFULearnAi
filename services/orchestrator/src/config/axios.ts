import axios from 'axios';
import axiosRetry from 'axios-retry';

const axiosInstance = axios.create();

axiosRetry(axiosInstance, {
    retries: 2,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ? error.response.status >= 500 : false);
    },
    onRetry: (retryCount, error, requestConfig) => {
        console.warn(`[Axios] Retrying request to ${requestConfig.url} (Attempt ${retryCount}) due to: ${error.message}`);
    }
});

export default axiosInstance;
