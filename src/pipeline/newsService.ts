import type { NewsArticle } from './types';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GNEWS_API_KEY;
const GNEWS_URL = 'https://gnews.io/api/v4/top-headlines';

/**
 * Fetches the latest news articles from GNews.
 * @param category Default is 'technology'
 * @returns An array of mapped NewsArticle objects
 */
export async function fetchTopNews(category: string = 'technology'): Promise<NewsArticle[]> {
  if (!API_KEY) {
    console.warn('GNEWS_API_KEY not found in .env. Falling back to mock news.');
    return [];
  }

  const url = `${GNEWS_URL}?category=${category}&lang=en&country=us&max=10&apikey=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`GNews API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.articles || !Array.isArray(data.articles)) {
        throw new Error('GNews API returned invalid response structure');
    }

    return data.articles.map((article: any) => mapToNewsArticle(article));
  } catch (error) {
    console.error('Failed to fetch news from GNews:', error);
    throw error;
  }
}

/**
 * Maps raw GNews API article data to our internal NewsArticle interface.
 */
function mapToNewsArticle(raw: any): NewsArticle {
  return {
    title: raw.title,
    description: raw.description,
    content: raw.content || raw.description, // Fallback if content is missing
    url: raw.url,
    imageUrl: raw.image || undefined,
    publishedAt: raw.publishedAt,
    source: raw.source?.name || 'Unknown Source'
  };
}
