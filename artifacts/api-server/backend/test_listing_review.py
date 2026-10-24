"""No-network regressions for mandatory approval, upload policy and exact binding."""
import copy
import io
import json
import unittest
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from flask import g
from PIL import Image
from werkzeug.exceptions import BadRequest, Forbidden, Conflict, BadGateway, NotFound

import listing_review as review
from photos import normalize_photo
from rules import now
import test_rules as fixtures


class ApprovalTests(unittest.TestCase):
    invoke = fixtures.RuleTests.invoke

    def setUp(self):
        fixtures.RuleTests.setUp(self)
        g.store["listing_approvals"] = []
        self.photo = str(uuid4())
        self.sha = "a" * 64
        self.data = dict(fixtures.listing(str(uuid4()), "a", mode="giveaway"),
                         listing_type="single", fresh=True, storage_confirmed=True,
                         allergens="Unknown", photo_id=self.photo)
        self.photo_patch = patch("listing_review.owned_photo", return_value=(self.photo, self.sha, b"image"))
        self.photo_patch.start()
        review.LAST_CALL.clear()

    def tearDown(self):
        self.photo_patch.stop()
        fixtures.RuleTests.tearDown(self)

    def approval(self):
        fields = review.validated_fields(self.data)
        row = dict(id=str(uuid4()), user_id="a", listing_digest=review.digest(fields),
                   photo_id=self.photo, photo_sha256=self.sha, policy=review.POLICY,
                   approved_at=now().isoformat(), expires_at=(now() + timedelta(minutes=15)).isoformat(),
                   used_listing_id=None)
        g.store["listing_approvals"].append(row)
        self.data["approval_id"] = row["id"]
        return row

    def test_every_required_field_blocks_before_bob(self):
        for key in ("mode", "listing_type", "item_details", "location", "pickup_start", "pickup_end",
                    "deadline", "timezone", "fresh", "storage_confirmed", "allergens"):
            with self.subTest(field=key):
                data = copy.deepcopy(self.data)
                del data[key]
                with patch("listing_review.review_image") as model:
                    with self.assertRaises(BadRequest):
                        self.invoke("review_listing", data=data)
                    model.assert_not_called()

    def test_complete_manual_listing_cannot_bypass_review(self):
        with self.assertRaises(Forbidden):
            self.invoke("create_listing", data=self.data)
        self.assertFalse(g.writes)

    def test_approved_fields_and_receipt_commit_together(self):
        row = self.approval()
        response = self.invoke("create_listing", data=self.data)
        result = response[0].get_json()["listing"]
        self.assertEqual(row["used_listing_id"], result["id"])
        self.assertEqual(result["photo_id"], self.photo)
        self.assertIn(("listing_approvals", row["id"]), g.writes)
        self.assertIn(("listings", result["id"]), g.writes)

    def test_used_review_cannot_publish_again(self):
        self.approval()
        self.invoke("create_listing", data=self.data)
        with self.assertRaises(Conflict):
            self.invoke("create_listing", data=self.data)

    def test_change_any_bound_detail_rejects_approval(self):
        self.approval()
        changes = {"allergens": "None known", "location": "Community Center",
                   "mode": "exchange", "storage_confirmed": False,
                   "deadline": (now() + timedelta(days=3)).isoformat()}
        for key, value in changes.items():
            with self.subTest(field=key):
                data = copy.deepcopy(self.data)
                data[key] = value
                if key == "mode":
                    data.update(wanted_food="Apples", wanted_quantity=1, wanted_unit="each")
                with self.assertRaises((Conflict, BadRequest)):
                    self.invoke("create_listing", data=data)

    def test_changed_photo_bytes_reject_approval(self):
        self.approval()
        with patch("listing_review.owned_photo", return_value=(self.photo, "b" * 64, None)):
            with self.assertRaises(Conflict):
                self.invoke("create_listing", data=self.data)

    def test_foreign_approval_rejected(self):
        row = self.approval()
        row["user_id"] = "b"
        with self.assertRaises(Forbidden):
            self.invoke("create_listing", data=self.data)

    def test_expired_approval_rejected(self):
        row = self.approval()
        row["expires_at"] = (now() - timedelta(seconds=1)).isoformat()
        with self.assertRaises(Conflict):
            self.invoke("create_listing", data=self.data)

    def test_giveaway_switch_cannot_bypass_review(self):
        with self.assertRaises(BadRequest):
            self.invoke("change_listing", listing_id="one", data={"mode": "giveaway"})
        self.assertEqual(self.a["mode"], "exchange")

    def test_rejected_uncertain_and_malformed_output_never_save(self):
        for answer in (
            dict(appropriate_photo=False, matches_listing=False, uncertain=False, reason="private text must not be echoed"),
            dict(appropriate_photo=True, matches_listing=True, uncertain=True, reason="uncertain"),
        ):
            review.LAST_CALL.clear()
            with patch("listing_review.review_image", return_value=json.dumps(answer)):
                response, status = self.invoke("review_listing", data=self.data)
                self.assertEqual(status, 422)
                self.assertNotIn("private text", json.dumps(response.get_json()))
                self.assertFalse(g.writes)
        review.LAST_CALL.clear()
        with patch("listing_review.review_image", return_value="invalid JSON"):
            with self.assertRaises(BadGateway):
                self.invoke("review_listing", data=self.data)
            self.assertFalse(g.writes)

    def test_successful_review_creates_receipt_not_listing(self):
        answer = dict(appropriate_photo=True, matches_listing=True, uncertain=False, reason="reviewed")
        with patch("listing_review.review_image", return_value=json.dumps(answer)):
            response = self.invoke("review_listing", data=self.data)
        self.assertTrue(response.get_json()["approved"])
        self.assertEqual(len(g.store["listing_approvals"]), 1)
        self.assertFalse(any(table == "listings" for table, _ in g.writes))


class PhotoTests(unittest.TestCase):
    def image(self, size=(200, 200), fmt="PNG"):
        image = Image.new("RGB", size, "blue")
        data = io.BytesIO()
        image.save(data, format=fmt)
        return data.getvalue()

    def test_images_are_reencoded_without_metadata(self):
        data, width, height = normalize_photo(self.image())
        result = Image.open(io.BytesIO(data))
        self.assertEqual(result.format, "JPEG")
        self.assertEqual((width, height), (200, 200))
        self.assertFalse(result.getexif())

    def test_tiny_nonimage_svg_and_oversize_rejected(self):
        for data in (self.image((50, 50)), b"not an image", b"<svg></svg>", b"x" * (5 * 1024 * 1024 + 1)):
            with self.subTest(length=len(data)):
                with self.assertRaises(BadRequest):
                    normalize_photo(data)


class PhotoAccessTests(unittest.TestCase):
    def setUp(self):
        from flask import Flask
        self.context = Flask(__name__).test_request_context()
        self.context.push()
        self.owner, self.photo = str(uuid4()), str(uuid4())
        g.user = {"id": self.owner}
        g.store = {"listing_photos": [dict(id=self.photo, user_id=self.owner,
                                         sha256="a" * 64, state="active")]}

    def tearDown(self):
        self.context.pop()

    def test_deleted_photo_cannot_enter_review_or_publish(self):
        from photos import owned_photo
        g.store["listing_photos"][0]["state"] = "deleted"
        with patch("photos.object_blob") as storage:
            with self.assertRaises(NotFound):
                owned_photo(self.photo, include_bytes=True)
            storage.assert_not_called()

    def test_foreign_photo_cannot_enter_review_or_publish(self):
        from photos import owned_photo
        g.user["id"] = str(uuid4())
        with patch("photos.object_blob") as storage:
            with self.assertRaises(Forbidden):
                owned_photo(self.photo, include_bytes=True)
            storage.assert_not_called()


if __name__ == "__main__":
    unittest.main()
