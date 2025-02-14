import React, { useEffect, useState } from 'react';
import { checkHealth } from '../api';

const Home: React.FC = () => {
    const [healthStatus, setHealthStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('Fetching health status...');
        const fetchHealthStatus = async () => {
            try {
                const status = await checkHealth();
                setHealthStatus(status);
            } catch (error) {
                setError('Failed to load health status');
                console.error('Error fetching health status:', error);
            }
        };

        fetchHealthStatus();
    }, []);

    return (
        <div>
            <h1>Welcome to Uptown Financials</h1>
            <p>Your trusted partner in financial services.</p>
            {error ? (
                <p style={{ color: 'red' }}>Error: {error}</p>
            ) : (
                <p>API Health Status: {healthStatus}</p>
            )}
        </div>
    );
};

export default Home;