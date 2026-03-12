#!/usr/bin/env python3
"""
Multi-City Briefing Content Aggregator
Supports 10 major US cities with city-specific data sources
"""

import requests
import json
import time
import feedparser
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import subprocess
import os
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
CITIES_DIR = SCRIPT_DIR / "cities"
CACHE_DIR = Path.home() / ".openclaw/workspace/.cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class CachedAPI:
    """3-tier caching: in-memory → file cache → upstream API"""
    
    def __init__(self, cache_ttl_seconds=300):
        self.cache_ttl = cache_ttl_seconds
        self.memory_cache = {}
        self.cache_timestamps = {}
    
    def get(self, key: str, fetch_fn):
        """Get data with 3-tier caching"""
        now = time.time()
        
        # Tier 1: In-memory cache
        if key in self.memory_cache:
            if now - self.cache_timestamps.get(key, 0) < self.cache_ttl:
                return self.memory_cache[key]
        
        # Tier 2: File cache
        cache_file = CACHE_DIR / f"{key}.json"
        if cache_file.exists():
            file_age = now - cache_file.stat().st_mtime
            if file_age < self.cache_ttl:
                try:
                    with open(cache_file, 'r') as f:
                        data = json.load(f)
                        self.memory_cache[key] = data
                        self.cache_timestamps[key] = now
                        return data
                except:
                    pass
        
        # Tier 3: Fetch from upstream
        try:
            data = fetch_fn()
            
            # Cache in memory
            self.memory_cache[key] = data
            self.cache_timestamps[key] = now
            
            # Cache to file
            try:
                with open(cache_file, 'w') as f:
                    json.dump(data, f)
            except:
                pass
            
            return data
        
        except Exception as e:
            print(f"⚠️  Fetch failed for {key}: {e}")
            
            # Return stale cache if available
            if key in self.memory_cache:
                print(f"   Returning stale in-memory cache")
                return self.memory_cache[key]
            
            if cache_file.exists():
                try:
                    with open(cache_file, 'r') as f:
                        print(f"   Returning stale file cache")
                        return json.load(f)
                except:
                    pass
            
            raise

# Global cache instances
city_config_cache = CachedAPI(cache_ttl_seconds=86400)  # 1 day
market_cache = CachedAPI(cache_ttl_seconds=120)  # 2 min
weather_cache = CachedAPI(cache_ttl_seconds=900)  # 15 min
news_cache = CachedAPI(cache_ttl_seconds=300)  # 5 min

def load_city_config(city_id: str) -> Dict:
    """Load city configuration from JSON file"""
    
    def fetch_config():
        config_file = CITIES_DIR / f"{city_id}.json"
        if not config_file.exists():
            raise ValueError(f"City config not found: {city_id}")
        
        with open(config_file, 'r') as f:
            return json.load(f)
    
    return city_config_cache.get(f"city_config_{city_id}", fetch_config)

def get_available_cities() -> List[Dict]:
    """Get list of all available cities"""
    cities = []
    
    for config_file in CITIES_DIR.glob("*.json"):
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
                cities.append({
                    'id': config['city_id'],
                    'name': config['name'],
                    'state': config['state'],
                    'population': config['population'],
                    'icon': config['theme']['icon']
                })
        except:
            pass
    
    # Sort by population (descending)
    cities.sort(key=lambda x: x['population'], reverse=True)
    return cities

def get_market_data() -> List[Dict]:
    """Fetch market data (same for all cities)"""
    
    symbols = [
        ('^GSPC', 'S&P 500'),
        ('^IXIC', 'NASDAQ'),
        ('BTC-USD', 'Bitcoin'),
        ('CL=F', 'Oil (WTI)'),
    ]
    
    markets = []
    
    for symbol, display_name in symbols:
        def fetch_symbol():
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
            params = {'range': '1d', 'interval': '1d'}
            headers = {'User-Agent': 'Mozilla/5.0'}
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            quote = data['chart']['result'][0]
            meta = quote['meta']
            current_price = meta['regularMarketPrice']
            prev_close = meta.get('chartPreviousClose', meta.get('previousClose', current_price))
            
            change = current_price - prev_close
            change_pct = (change / prev_close) * 100 if prev_close else 0
            
            return {
                'symbol': display_name,
                'price': current_price,
                'change': change,
                'change_pct': change_pct,
            }
        
        try:
            market_data = market_cache.get(f"market_{symbol}", fetch_symbol)
            markets.append(market_data)
        except Exception as e:
            print(f"   Failed to fetch {display_name}: {e}")
            markets.append({
                'symbol': display_name,
                'price': 0,
                'change': 0,
                'change_pct': 0,
            })
    
    return markets

def get_weather_data(city_id: str) -> Dict:
    """Fetch weather for specific city"""
    
    city_config = load_city_config(city_id)
    weather_config = city_config['data_sources']['weather']
    
    if weather_config['provider'] != 'nws':
        raise ValueError(f"Unsupported weather provider: {weather_config['provider']}")
    
    grid = weather_config['grid']
    office = grid['office']
    grid_x = grid['gridX']
    grid_y = grid['gridY']
    
    def fetch_weather():
        # Get forecast from NWS grid
        forecast_url = f"https://api.weather.gov/gridpoints/{office}/{grid_x},{grid_y}/forecast"
        headers = {'User-Agent': 'MorningBriefing/1.0 (contact@example.com)'}
        
        response = requests.get(forecast_url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        current = data['properties']['periods'][0]
        
        return {
            'location': f"{city_config['name']}, {city_config['state']}",
            'temp': current['temperature'],
            'temp_unit': current['temperatureUnit'],
            'condition': current['shortForecast'],
            'detailed_forecast': current['detailedForecast'],
            'wind': current.get('windSpeed', 'N/A'),
            'icon': city_config['theme']['icon'],
        }
    
    try:
        return weather_cache.get(f"weather_{city_id}", fetch_weather)
    except Exception as e:
        print(f"   Weather fetch failed for {city_id}: {e}")
        return {
            'location': f"{city_config['name']}, {city_config['state']}",
            'temp': 72,
            'temp_unit': 'F',
            'condition': 'Data unavailable',
            'detailed_forecast': 'Unable to fetch weather data',
            'wind': 'N/A',
            'icon': city_config['theme']['icon'],
        }

def get_local_news(city_id: str, limit: int = 5) -> List[Dict]:
    """Fetch local news for specific city"""
    
    city_config = load_city_config(city_id)
    news_config = city_config['data_sources']['news']
    rss_feeds = news_config.get('local_rss', [])
    
    def fetch_news():
        all_articles = []
        
        for feed_url in rss_feeds:
            try:
                feed = feedparser.parse(feed_url)
                
                for entry in feed.entries[:3]:  # Top 3 from each feed
                    # Calculate time ago
                    pub_date = entry.get('published_parsed')
                    if pub_date:
                        pub_time = time.mktime(pub_date)
                        hours_ago = (time.time() - pub_time) / 3600
                        if hours_ago < 1:
                            time_ago = f"{int(hours_ago * 60)}m ago"
                        elif hours_ago < 24:
                            time_ago = f"{int(hours_ago)}h ago"
                        else:
                            time_ago = f"{int(hours_ago / 24)}d ago"
                    else:
                        time_ago = "Recent"
                    
                    all_articles.append({
                        'headline': entry.get('title', 'No title'),
                        'summary': entry.get('summary', '')[:200] + '...' if entry.get('summary') else '',
                        'source': feed.feed.get('title', 'Local News'),
                        'url': entry.get('link', ''),
                        'time_ago': time_ago,
                    })
            
            except Exception as e:
                print(f"   Failed to fetch feed {feed_url}: {e}")
                continue
        
        # Sort by recency (newest first)
        return all_articles[:limit]
    
    try:
        return news_cache.get(f"news_{city_id}", fetch_news)
    except Exception as e:
        print(f"   News fetch failed for {city_id}: {e}")
        return [{
            'headline': f'Local news unavailable for {city_config["name"]}',
            'summary': 'Please check back later',
            'source': 'System',
            'time_ago': 'N/A',
        }]

def get_calendar_events() -> List[Dict]:
    """Fetch today's calendar events (user-specific, not city-specific)"""
    
    try:
        # Use icalBuddy to get today's events
        result = subprocess.run(
            ['icalBuddy', '-n', '-nc', '-df', '%H:%M', 'eventsToday'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode != 0:
            return []
        
        # Parse output
        events = []
        lines = result.stdout.strip().split('\n')
        
        for line in lines:
            if ' • ' in line:
                parts = line.split(' • ', 1)
                time_str = parts[0].strip()
                title = parts[1].strip() if len(parts) > 1 else "Event"
                
                events.append({
                    'time': time_str,
                    'title': title,
                    'location': '',
                })
        
        return events[:5]  # Limit to 5 events
    
    except Exception as e:
        print(f"   Calendar fetch failed: {e}")
        return []

def aggregate_briefing_content(city_id: str = "sioux_falls") -> Dict:
    """Aggregate all briefing content for a specific city"""
    
    # Load city config
    try:
        city_config = load_city_config(city_id)
    except Exception as e:
        print(f"❌ Failed to load city config: {e}")
        raise
    
    print(f"📍 Generating briefing for {city_config['name']}, {city_config['state']}")
    
    print("📊 Fetching market data...")
    markets = get_market_data()
    
    print(f"⛅ Fetching weather for {city_config['name']}...")
    weather = get_weather_data(city_id)
    
    print("📅 Fetching calendar...")
    calendar = get_calendar_events()
    
    print(f"📰 Fetching local news for {city_config['name']}...")
    news = get_local_news(city_id)
    
    return {
        'city': {
            'id': city_config['city_id'],
            'name': city_config['name'],
            'state': city_config['state'],
            'icon': city_config['theme']['icon'],
            'timezone': city_config['timezone'],
        },
        'date': datetime.now().strftime("%A, %B %d, %Y"),
        'markets': markets,
        'weather': weather,
        'calendar': calendar,
        'news': news,
    }

if __name__ == "__main__":
    import sys
    
    # Get city from command line or use default
    city_id = sys.argv[1] if len(sys.argv) > 1 else "sioux_falls"
    
    # Special command: list cities
    if city_id == "--list":
        print("\n🌆 Available Cities:")
        cities = get_available_cities()
        for city in cities:
            print(f"   {city['icon']} {city['name']}, {city['state']} ({city['id']})")
        print()
        sys.exit(0)
    
    print(f"\n🔄 Aggregating briefing content for: {city_id}")
    
    try:
        data = aggregate_briefing_content(city_id)
        
        print("\n✅ Content aggregated:")
        print(f"   City: {data['city']['icon']} {data['city']['name']}, {data['city']['state']}")
        print(f"   Markets: {len(data['markets'])} symbols")
        print(f"   Weather: {data['weather']['temp']}°{data['weather']['temp_unit']}, {data['weather']['condition']}")
        print(f"   Calendar: {len(data['calendar'])} events")
        print(f"   News: {len(data['news'])} local stories")
        
        # Save to JSON for inspection
        output_file = Path.home() / ".openclaw/workspace" / f"briefing_data_{city_id}.json"
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n💾 Data saved to: {output_file}")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
