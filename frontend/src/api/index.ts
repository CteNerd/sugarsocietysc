const isDevelopment = window.location.hostname === 'localhost';
const BASE_URL = isDevelopment ? 'http://localhost:5000/api' : `${window.location.origin}/api`;
const getToken = () => localStorage.getItem('token');

export const checkHealth = async (): Promise<string> => {
    const response = await fetch(`${BASE_URL}/health`, {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });
    const data = await response.text();
    return data;
};

export const fetchHealthStatus = async (): Promise<string> => {
    try {
        const response = await checkHealth();
        return response;
    } catch (error) {
        console.error('Error fetching health status:', error);
        return 'Error';
    }
};
