import React, { useEffect, useState } from 'react';
import { NewsArticle } from '../types/NewsArticle'; // Adjust the import path as needed
import { fetchNews } from '../api'; // Import the centralized API function

const News: React.FC = () => {
    const [news, setNews] = useState<NewsArticle[]>([]);

    useEffect(() => {
        const getNews = async () => {
            const data = await fetchNews();
            setNews(data);
        };

        getNews();
    }, []);

    return (
        <div>
            <h1>Latest News</h1>
            <ul>
                {news.map((item, index) => (
                    <li key={index}>{item.title}</li>
                ))}
            </ul>
        </div>
    );
};

export default News;