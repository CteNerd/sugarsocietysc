import { NewsArticle } from '../types/NewsArticle'; // Adjust the import path as needed
const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const getToken = () => localStorage.getItem('token');


export const fetchNews = async (): Promise<NewsArticle[]> => {
    const response = await fetch(`${BASE_URL}/news`, {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });
    const data: NewsArticle[] = await response.json();
    return data;
};

export const checkHealth = async (): Promise<string> => {
    const response = await fetch(`${BASE_URL}/health`, {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });
    const data = await response.text();
    return data;
};
