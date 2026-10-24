import unittest
from unittest.mock import patch

import preview_server


class PreviewServerTests(unittest.TestCase):
    def setUp(self):
        preview_server._CACHE.clear()

    @patch("preview_server._provider_json")
    def test_live_results_are_sorted_and_filtered(self, provider_json):
        provider_json.side_effect = [
            {"features": [{"geometry": {"coordinates": [-121.89, 37.33]}, "properties": {"label": "95125, San Jose, CA"}}]},
            {"durations": [[720, 2400, 480]], "distances": [[5.2, 17.5, 3.4]]},
        ]
        result = preview_server.search("95125", 15, "test-key")
        self.assertEqual([row["id"] for row in result["destinations"]], ["sacred-heart-donation-station", "second-harvest-curtner"])
        self.assertEqual(result["destinations"][0]["drive_minutes"], 8)
        self.assertEqual(result["origin"]["label"], "95125, San Jose, CA")

    @patch("preview_server._provider_json")
    def test_distant_area_returns_honest_empty_state(self, provider_json):
        provider_json.side_effect = [
            {"features": [{"geometry": {"coordinates": [-73.98, 40.75]}, "properties": {"label": "New York, NY"}}]},
            {"durations": [[200000, 201000, 199000]], "distances": [[2900, 2910, 2895]]},
        ]
        result = preview_server.search("10001", 60, "test-key")
        self.assertEqual(result["destinations"], [])

    def test_invalid_drive_limit_is_rejected_before_provider_use(self):
        with self.assertRaisesRegex(ValueError, "15, 30, or 60"):
            preview_server.search("95125", 45, "test-key")

    @patch("preview_server._provider_json")
    def test_geocode_cache_avoids_repeating_search(self, provider_json):
        provider_json.return_value = {"features": [{"geometry": {"coordinates": [-121.89, 37.33]}, "properties": {"label": "95125"}}]}
        first = preview_server.geocode_area("95125", "test-key")
        second = preview_server.geocode_area(" 95125 ", "test-key")
        self.assertEqual(first, second)
        provider_json.assert_called_once()


if __name__ == "__main__":
    unittest.main()
