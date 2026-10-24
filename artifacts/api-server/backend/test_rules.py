"""Targeted rule regressions. No external services or production data are used."""
import copy
import json
import subprocess
import unittest
from datetime import timedelta
from unittest.mock import patch, MagicMock

from flask import Flask, g
from werkzeug.exceptions import BadRequest, Forbidden, Conflict, BadGateway, ServiceUnavailable

import rules
import bob
import destinations
from destinations import suitable, DIRECTORY


def listing(identifier, owner, food="Onions", wants="Rice", mode="exchange", unit="each", amount=5):
    start = rules.now() + timedelta(hours=1)
    end = start + timedelta(hours=2)
    return dict(id=identifier, user_id=owner, name=owner, items=[food],
                photo_id="00000000-0000-0000-0000-000000000011",
                bob_review_id="00000000-0000-0000-0000-000000000012",
                item_details=[dict(name=food, quantity=amount, unit=unit, category="produce",
                                   unopened=None, printed_date=None, date_type=None)],
                quantities={food: amount}, wants=[wants], wanted_food=wants,
                wanted_quantity=1, wanted_unit="each", mode=mode, status="open",
                location="Library steps", pickup_start=start.isoformat(),
                pickup_end=end.isoformat(), deadline=(end + timedelta(hours=1)).isoformat(),
                timezone="America/Los_Angeles")


class RuleTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        def save(table, row):
            g.writes[(table, row["id"])] = copy.deepcopy(row)
        rules.install_rules(self.app, {"save_row": save, "create_notification": lambda *args: None, "supabase": None})
        self.ctx = self.app.test_request_context()
        self.ctx.push()
        g.user = dict(id="a", name="Alice")
        g.active_users = {"a", "b", "c"}
        g.writes = {}
        g.store = {table: [] for table in ("listings", "trade_offers", "food_requests", "notifications", "ratings", "reports", "user_blocks", "impact_records")}
        self.a = listing("one", "a")
        self.b = listing("two", "b", food="Rice", wants="Onions")
        g.store["listings"] = [self.a, self.b]

    def tearDown(self):
        self.ctx.pop()

    def invoke(self, endpoint, uid="a", data=None, **kwargs):
        g.user = dict(id=uid, name=uid)
        with self.app.test_request_context(json=data or {}, method="POST"):
            return self.app.view_functions[endpoint](**kwargs)

    def offer(self):
        self.invoke("create_offer", data={"listing_id": "one", "match_id": "two"})
        return g.store["trade_offers"][-1]

    def accept_both(self, offer):
        self.invoke("decide_offer", offer_id=offer["id"], data={"accept": True})
        self.invoke("decide_offer", uid="b", offer_id=offer["id"], data={"accept": True})

    def test_reciprocal_quantity_compatible_match(self):
        self.assertEqual(len(rules.matches(self.a)), 1)
        self.b["wanted_quantity"] = 6
        self.assertEqual(rules.matches(self.a), [])

    def test_units_are_not_implicitly_converted(self):
        self.b["wanted_unit"] = "kg"
        self.assertEqual(rules.matches(self.a), [])

    def test_nonreciprocal_food_prevents_exchange(self):
        self.b["wanted_food"] = "Apples"
        self.assertEqual(rules.matches(self.a), [])

    def test_nonoverlap_prevents_match(self):
        self.b["pickup_start"] = self.a["pickup_end"]
        self.assertEqual(rules.matches(self.a), [])

    def test_past_deadline_prevents_match(self):
        self.a["deadline"] = (rules.now() - timedelta(seconds=1)).isoformat()
        self.assertEqual(rules.matches(self.a), [])

    def test_missing_legacy_window_is_not_flexible(self):
        del self.b["pickup_start"]
        self.assertEqual(rules.matches(self.a), [])

    def test_pickup_zone_must_match(self):
        self.b["location"] = "Community Center"
        self.assertEqual(rules.matches(self.a), [])

    def test_bundle_all_items_fixed_server_side(self):
        self.invoke("create_offer", data={"listing_id": "one", "match_id": "two",
                                         "give": ["Invented"], "receive": [], "user_id": "b"})
        offer = g.store["trade_offers"][-1]
        self.assertEqual(offer["give_items"], self.a["item_details"])
        self.assertEqual(offer["give"], ["Onions"])

    def test_outsider_cannot_accept_or_confirm(self):
        offer = self.offer()
        with self.assertRaises(Forbidden):
            self.invoke("decide_offer", uid="c", offer_id=offer["id"], data={"accept": True})
        with self.assertRaises(Forbidden):
            self.invoke("complete_offer", uid="c", offer_id=offer["id"])

    def test_final_acceptance_checks_reservation_again(self):
        offer = self.offer()
        self.invoke("decide_offer", offer_id=offer["id"], data={"accept": True})
        self.a.update(status="reserved", reservation_id="another-offer")
        with self.assertRaises(Conflict):
            self.invoke("decide_offer", uid="b", offer_id=offer["id"], data={"accept": True})
        self.assertEqual(self.a["reservation_id"], "another-offer")

    def test_decline_preserves_food(self):
        offer = self.offer()
        self.invoke("decide_offer", uid="b", offer_id=offer["id"], data={"accept": False})
        self.assertEqual(self.a["status"], "open")
        self.assertEqual(self.b["status"], "open")

    def test_cancel_releases_only_this_offers_reservations(self):
        offer = self.offer()
        self.accept_both(offer)
        self.b["reservation_id"] = "someone-else"
        self.invoke("cancel_offer", offer_id=offer["id"])
        self.assertEqual(self.a["status"], "open")
        self.assertEqual(self.b["status"], "reserved")

    def test_two_confirmations_and_idempotent_impact(self):
        offer = self.offer()
        self.accept_both(offer)
        self.invoke("complete_offer", offer_id=offer["id"])
        self.assertEqual(g.store["impact_records"], [])
        self.invoke("complete_offer", uid="b", offer_id=offer["id"])
        self.assertEqual(len(g.store["impact_records"]), 2)
        self.invoke("complete_offer", uid="b", offer_id=offer["id"])
        self.assertEqual(len(g.store["impact_records"]), 2)
        with self.assertRaises(Conflict):
            self.invoke("decide_offer", offer_id=offer["id"], data={"accept": False})
        self.assertEqual(self.a["status"], "traded")

    def test_giveaway_needs_no_reciprocal_food_but_both_confirmations(self):
        self.a["mode"] = "giveaway"
        data = {k: self.a[k] for k in ("location", "pickup_start", "pickup_end")}
        self.invoke("request_giveaway", uid="b", listing_id="one", data=data)
        row = g.store["food_requests"][-1]
        with self.assertRaises(Forbidden):
            self.invoke("decide_giveaway", uid="b", request_id=row["id"], data={"accept": True})
        self.invoke("decide_giveaway", request_id=row["id"], data={"accept": True})
        self.invoke("confirm_giveaway_pickup", uid="b", request_id=row["id"])
        self.assertEqual(row["status"], "completion_pending")
        self.assertEqual(g.store["impact_records"], [])
        self.invoke("confirm_giveaway_pickup", request_id=row["id"])
        self.invoke("confirm_giveaway_pickup", request_id=row["id"])
        self.assertEqual(row["status"], "completed")
        self.assertEqual(len(g.store["impact_records"]), 1)

    def test_recommendation_is_not_outcome_and_expiry_not_spoilage(self):
        self.invoke("fallback_options", listing_id="one")
        self.assertEqual(g.store["impact_records"], [])
        self.a["deadline"] = (rules.now() - timedelta(days=1)).isoformat()
        compost = next(option for option in DIRECTORY if option["type"] == "compost")
        self.assertFalse(suitable(self.a, compost))
        self.a["inedible_confirmed"] = True
        self.assertTrue(suitable(self.a, compost))

    def test_donation_route_requires_server_key_and_listing_owner(self):
        self.a["item_details"] = [dict(name="Rice", quantity=1, unit="bag", category="shelf_stable",
                                       unopened=True, printed_date=None, date_type=None)]
        with patch.dict("os.environ", {}, clear=True), self.assertRaises(ServiceUnavailable):
            self.invoke("donation_routes", listing_id="one", data={"area": "95125", "max_drive_minutes": 30})
        with patch.dict("os.environ", {"OPENROUTESERVICE_API_KEY": "test-key"}, clear=False), self.assertRaises(Forbidden):
            self.invoke("donation_routes", uid="b", listing_id="one", data={"area": "95125", "max_drive_minutes": 30})

    def test_donation_route_returns_only_compatible_verified_options(self):
        self.a["item_details"] = [dict(name="Rice", quantity=1, unit="bag", category="shelf_stable",
                                       unopened=True, printed_date=None, date_type=None)]
        expected = {"origin": {"label": "95125", "longitude": -121.89, "latitude": 37.33},
                    "max_drive_minutes": 30, "destinations": []}
        with patch.dict("os.environ", {"OPENROUTESERVICE_API_KEY": "test-key"}, clear=False), \
             patch.object(destinations, "search_routes", return_value=expected) as search:
            response = self.invoke("donation_routes", listing_id="one", data={"area": "95125", "max_drive_minutes": 30})
        self.assertEqual(response.get_json(), expected)
        routed = search.call_args.args[2]
        self.assertEqual({row["id"] for row in routed}, {"second-harvest-curtner", "second-harvest-cypress", "sacred-heart-donation-station"})

    def test_unknown_destination_rejected(self):
        with self.assertRaises(BadRequest):
            self.invoke("external_outcome", data={"listing_id": "one", "destination_id": "invented",
                        "action": "donation", "confirmed": True, "no_glass_confirmed": True,
                        "destination_feasible_confirmed": True})
        self.assertEqual(g.store["impact_records"], [])

    def test_food_and_quantities_policy(self):
        base = self.a["item_details"][0].copy()
        for amount in (0, -1, True, float("inf"), 1000):
            with self.assertRaises(BadRequest):
                rules.eligible(dict(base, quantity=amount))
        with self.assertRaises(BadRequest):
            rules.eligible(dict(base, name="Homemade soup"))
        with self.assertRaises(BadRequest):
            rules.eligible(dict(base, category="shelf_stable", unopened=False))
        self.assertIsNone(rules.eligible(base)["unopened"])

    def test_test_records_not_in_real_impact(self):
        offer = self.offer()
        self.a["is_test"] = self.b["is_test"] = True
        self.accept_both(offer)
        self.invoke("complete_offer", offer_id=offer["id"])
        self.invoke("complete_offer", uid="b", offer_id=offer["id"])
        result = self.invoke("get_impact").get_json()
        self.assertEqual(result["completed_trades"], 0)
        self.assertEqual(result["quantities"], [])

    def test_mixed_units_not_summed(self):
        g.store["impact_records"] = [
            dict(id="r1", identity="r1", action="donation", item_name="Rice", quantity=1, unit="bag", listing_id="one"),
            dict(id="r2", identity="r2", action="donation", item_name="Rice", quantity=2, unit="kg", listing_id="two"),
        ]
        result = self.invoke("get_impact").get_json()
        self.assertEqual(len(result["quantities"]), 2)
        self.assertNotIn("waste_avoided_kg_estimate", result)


class BobTests(unittest.TestCase):
    def draft(self):
        return dict(item_details=[dict(name="onions", quantity=None, unit=None, category="produce",
                    unopened=None, printed_date=None, date_type=None)], location=None,
                    availability=None, deadline_text=None, ambiguities=[])

    def test_unknown_quantities_remain_unknown(self):
        self.assertIsNone(bob.validate_draft(self.draft(), "I have some onions")["item_details"][0]["quantity"])

    def test_invented_quantity_cleared(self):
        draft = self.draft()
        draft["item_details"][0]["quantity"] = 5
        self.assertIsNone(bob.validate_draft(draft, "I have some onions")["item_details"][0]["quantity"])

    def test_hallucinated_food_rejected(self):
        with self.assertRaises(ValueError):
            bob.validate_draft(self.draft(), "I have rice")

    @patch("bob.os.killpg")
    @patch("bob.subprocess.Popen")
    @patch("bob.executable", return_value="/fake/bob")
    @patch.dict("os.environ", {"BOB_API_KEY": "test-only", "SUPABASE_SERVICE_ROLE_KEY": "must-not-reach-worker"})
    def test_timeout_and_worker_secret_boundary(self, executable, popen, kill):
        worker = MagicMock(pid=123)
        worker.communicate.side_effect = [subprocess.TimeoutExpired("bob", 45), ("", None)]
        popen.return_value = worker
        with self.assertRaises(ServiceUnavailable):
            bob.interpret("I have onions", "America/Los_Angeles")
        kwargs = popen.call_args.kwargs
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", kwargs["env"])
        self.assertNotIn("shell", kwargs)
        self.assertIn("--disable-tool-groups", popen.call_args.args[0])
        kill.assert_called_once()

    @patch("bob.subprocess.Popen")
    @patch("bob.executable", return_value="/fake/bob")
    @patch.dict("os.environ", {"BOB_API_KEY": "test-only"})
    def test_malformed_output_rejected(self, executable, popen):
        popen.return_value = MagicMock(returncode=0)
        popen.return_value.communicate.return_value = ('{"status":"success","last_message":"not json"}', None)
        with self.assertRaises(BadGateway):
            bob.interpret("I have onions", "America/Los_Angeles")


if __name__ == "__main__":
    unittest.main()
