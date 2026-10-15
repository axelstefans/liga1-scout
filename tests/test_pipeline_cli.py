"""
Unit and integration tests for the main scraper CLI (scraper.run) Flashscore integration.
"""

from unittest.mock import ANY, MagicMock, patch
import pytest

from scraper.run import main


def test_pipeline_flashscore_only_dry_run_dispatch():
    """
    Tests that passing --flashscore-only --flashscore-dry-run invokes run_sync
    with dry_run=True and auto_discover=True without executing other pipeline steps.
    """
    with patch("scraper.run.run_migrations") as mock_migrations, \
         patch("scraper.run.get_connection") as mock_conn, \
         patch("scraper.run.SofaScoreAPIClient") as mock_sofascore, \
         patch("scraper.run.scrape_and_store_teams") as mock_teams, \
         patch("scraper.run.scrape_and_store_matches") as mock_matches, \
         patch("scraper.run.run_sync") as mock_run_sync:

        mock_run_sync.return_value = {
            "total_discovered": 107,
            "newly_discovered": 0,
            "already_synced": 107,
            "pending_count": 0,
            "queued_count": 0,
            "processed_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "total_rows_inserted": 0,
            "matches_linked_count": 0,
            "circuit_breaker_triggered": False,
            "dry_run": True,
            "results": [],
        }

        main(["--flashscore-only", "--flashscore-dry-run"])

        # Flashscore sync must be called with auto_discover=True and dry_run=True
        mock_run_sync.assert_called_once_with(
            db_path=ANY,
            limit=None,
            dry_run=True,
            auto_discover=True,
        )

        # SofaScore sources must NOT be called in flashscore-only mode
        mock_teams.assert_not_called()
        mock_matches.assert_not_called()


def test_pipeline_flashscore_limit_forwarding():
    """
    Tests that --flashscore-limit integer value is forwarded properly to run_sync.
    """
    with patch("scraper.run.run_migrations"), \
         patch("scraper.run.get_connection"), \
         patch("scraper.run.SofaScoreAPIClient"), \
         patch("scraper.run.run_sync") as mock_run_sync:

        mock_run_sync.return_value = {
            "total_discovered": 107,
            "newly_discovered": 0,
            "already_synced": 107,
            "pending_count": 0,
            "queued_count": 0,
            "processed_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "total_rows_inserted": 0,
            "matches_linked_count": 0,
            "circuit_breaker_triggered": False,
            "dry_run": False,
            "results": [],
        }

        main(["--flashscore-only", "--flashscore-limit", "9"])

        mock_run_sync.assert_called_once_with(
            db_path=ANY,
            limit=9,
            dry_run=False,
            auto_discover=True,
        )


def test_pipeline_full_includes_flashscore_step():
    """
    Tests that running --full includes the Flashscore sync step.
    """
    with patch("scraper.run.run_migrations"), \
         patch("scraper.run.get_connection"), \
         patch("scraper.run.SofaScoreAPIClient"), \
         patch("scraper.run.scrape_and_store_teams"), \
         patch("scraper.run.scrape_and_store_squads"), \
         patch("scraper.run.scrape_and_store_season_stats"), \
         patch("scraper.run.scrape_and_store_matches"), \
         patch("scraper.run.scrape_and_store_match_stats"), \
         patch("scraper.run.scrape_and_store_match_period_stats"), \
         patch("scraper.run.scrape_and_store_market_values"), \
         patch("scraper.run.scrape_and_store_spatial_events"), \
         patch("scraper.run.scrape_and_store_shotmaps"), \
         patch("scraper.run.compute_and_store_percentiles"), \
         patch("scraper.run.scrape_and_store_heatmaps"), \
         patch("scraper.run.run_sync") as mock_run_sync:

        mock_run_sync.return_value = {
            "total_discovered": 107,
            "newly_discovered": 0,
            "already_synced": 107,
            "pending_count": 0,
            "queued_count": 0,
            "processed_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "total_rows_inserted": 0,
            "matches_linked_count": 0,
            "circuit_breaker_triggered": False,
            "dry_run": True,
            "results": [],
        }

        main(["--full", "--flashscore-dry-run"])

        mock_run_sync.assert_called_once_with(
            db_path=ANY,
            limit=None,
            dry_run=True,
            auto_discover=True,
        )


def test_pipeline_dry_run_cli_output(capsys):
    """
    Tests that executing --flashscore-only --flashscore-dry-run outputs the summary report cleanly.
    """
    with patch("scraper.run.run_migrations"), \
         patch("scraper.run.get_connection"), \
         patch("scraper.run.SofaScoreAPIClient"), \
         patch("scraper.run.run_sync") as mock_run_sync:

        mock_run_sync.return_value = {
            "total_discovered": 107,
            "newly_discovered": 0,
            "already_synced": 107,
            "pending_count": 0,
            "queued_count": 0,
            "processed_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "total_rows_inserted": 0,
            "matches_linked_count": 0,
            "circuit_breaker_triggered": False,
            "dry_run": True,
            "results": [],
        }

        main(["--flashscore-only", "--flashscore-dry-run"])
        captured = capsys.readouterr()

        assert "Flashscore Discovered Matches Sync Summary [DRY RUN]" in captured.out
        assert "Total discovered events in file : 107" in captured.out
        assert "Already synced (skipped)        : 107" in captured.out
