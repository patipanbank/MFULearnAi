import httpx
from bs4 import BeautifulSoup

class WebScraperService:
    async def scrape_url(self, url: str) -> str:
        """
        Scrapes a single URL to extract clean textual content.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, follow_redirects=True, timeout=20.0)
                response.raise_for_status() # Raise an exception for bad status codes

            soup = BeautifulSoup(response.text, 'html.parser')

            # Remove unwanted tags
            for unwanted_tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                unwanted_tag.decompose()

            # Get text and clean it
            body_text = soup.body.get_text(separator=' ', strip=True) if soup.body else soup.get_text(separator=' ', strip=True)
            cleaned_text = ' '.join(body_text.split())
            
            return cleaned_text

        except httpx.HTTPError as e:
            print(f"Error scraping URL {url}: {e}")
            raise ValueError(f"Could not scrape URL: {url}. Error: {e}")
        except Exception as e:
            print(f"An unexpected error occurred while scraping {url}: {e}")
            raise ValueError(f"An unexpected error occurred while scraping {url}")


web_scraper_service = WebScraperService() 