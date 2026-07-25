import argparse
import logging
import os
import sys

# Setup logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

from scraper.db import get_connection, run_migrations
from scraper.config import DB_PATH
from scraper.http_client import SofaScoreAPIClient

# Import pipeline steps
from scraper.sources.teams import scrape_and_store_teams
from scraper.sources.squads import scrape_and_store_squads
from scraper.sources.season_stats import scrape_and_store_season_stats
from scraper.sources.matches import scrape_and_store_matches
from scraper.sources.match_stats import scrape_and_store_match_stats
from scraper.sources.transfermarkt import scrape_and_store_market_values
from scraper.sources.spatial import scrape_and_store_spatial_events
from scraper.sources.shotmap import scrape_and_store_shotmaps

import LanusStats as ls

logger = logging.getLogger("scraper.run")

def main():
    parser = argparse.ArgumentParser(description="Liga 1 Peruana Data Pipeline")
    parser.add_argument("--teams-only", action="store_true", help="Run only the teams pipeline step")
    parser.add_argument("--squads-only", action="store_true", help="Run only the squads pipeline step")
    parser.add_argument("--season-stats-only", action="store_true", help="Run only the season stats pipeline step")
    parser.add_argument("--matches-only", action="store_true", help="Run only the matches pipeline step")
    parser.add_argument("--match-stats-only", action="store_true", help="Run only the match stats pipeline step")
    parser.add_argument("--rematch-stats", action="store_true", help="Clear existing match stats and re-scrape them")
    parser.add_argument("--transfermarkt-only", action="store_true", help="Run only the transfermarkt pipeline step")
    parser.add_argument("--spatial-only", action="store_true", help="Run only the spatial events (passes) pipeline step")
    parser.add_argument("--shotmap-only", action="store_true", help="Run only the shotmap pipeline step")
    parser.add_argument("--full", action="store_true", help="Run the full pipeline")
    
    args = parser.parse_args()
    
    if not any(vars(args).values()):
        parser.print_help()
        sys.exit(1)

    logger.info("Starting Liga 1 Data Pipeline...")
    
    # Ensure migrations are run
    migrations_dir = os.path.join(os.path.dirname(__file__), '..', 'migrations')
    if not os.path.exists(migrations_dir):
        logger.error(f"Migrations directory not found at {migrations_dir}")
        sys.exit(1)
        
    conn = get_connection(DB_PATH)
    run_migrations(conn, migrations_dir)
    
    api_client = SofaScoreAPIClient()
    
    # We fetch teams upfront if needed by subsequent steps
    teams = []
    matches = []
    
    if args.teams_only or args.full or args.squads_only or args.transfermarkt_only:
        teams = scrape_and_store_teams(conn, api_client)
        
    if args.squads_only or args.full:
        scrape_and_store_squads(conn, api_client, teams)
        
    if args.season_stats_only or args.full:
        scrape_and_store_season_stats(conn, api_client)
        
    if args.matches_only or args.full or args.match_stats_only or args.rematch_stats or args.spatial_only or args.shotmap_only:
        matches = scrape_and_store_matches(conn, api_client)
        
    if args.rematch_stats:
        logger.info("Clearing existing match stats data for re-scraping...")
        conn.execute("DELETE FROM player_match_stats")
        conn.execute("DELETE FROM scrape_log WHERE resource_type = 'match_stats'")
        args.match_stats_only = True
        
    if args.match_stats_only or args.full:
        scrape_and_store_match_stats(conn, api_client.sofascore, matches)
            
    if args.transfermarkt_only or args.full:
        logger.info("Initialising LanusStats Transfermarkt module...")
        tm_lanus = ls.Transfermarkt()
        scrape_and_store_market_values(conn, tm_lanus, teams)
        
    if args.spatial_only or args.full:
        scrape_and_store_spatial_events(conn, api_client, matches)

    if args.shotmap_only or args.full:
        scrape_and_store_shotmaps(conn, api_client, test_mode=False)

    logger.info("Pipeline run complete.")
    conn.close()
    api_client.close()

if __name__ == "__main__":
    main()
