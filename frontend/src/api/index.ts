const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
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
