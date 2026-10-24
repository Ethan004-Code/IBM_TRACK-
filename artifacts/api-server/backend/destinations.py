"""Small, sourced pilot directory. Recommendations never create outcomes."""
from datetime import date

from flask import g, jsonify, request
from werkzeug.exceptions import BadRequest, Conflict

from rules import own_listing, matches, available, now, instant

DIRECTORY = [
    dict(id="second-harvest-cypress", name="Second Harvest of Silicon Valley — Cypress Center",
         type="donation", location="Cypress Center, San Jose, California",
         accepted_categories=["shelf_stable"], exclusions=["Opened packages", "Past printed dates", "Glass containers"],
         hours="Published: Monday–Friday, 9:30 AM–4:30 PM",
         url="https://www.shfb.org/give-help/donate-food/", checked_at="2026-10-23",
         notice="Confirm current acceptance and opening hours using the official page before travelling. Produce guidance is conflicting; produce requires direct confirmation and is not automatically recommended."),
    dict(id="zero-waste-berger", name="Zero Waste Silicon Valley — Berger Drive",
         type="compost", location="1560 Berger Dr., San Jose, California",
         accepted_categories=["fruit_vegetable_scraps"], exclusions=["Meat", "Dairy", "Oils", "Greasy food", "Packaged food"],
         hours="Published: Monday–Friday, 8:30 AM–4 PM, excluding major holidays",
         url="https://zerowastesv.org/materials/organics", checked_at="2026-10-23",
         notice="Only accepted fruit and vegetable scraps. Confirm current rules and holidays on the official page. A failed match or expired pickup deadline does not mean food is spoiled."),
]


def suitable(listing, option):
    details = listing.get("item_details") or []
    if not details:
        return False
    if option["type"] == "compost":
        return listing.get("inedible_confirmed") is True and all(i["category"] == "produce" for i in details)
    if listing.get("inedible_confirmed"):
        return False
    # The pilot never promises that a directory organization will accept food.
    local_today = now().astimezone(__import__("zoneinfo").ZoneInfo("America/Los_Angeles")).date()
    return all(i["category"] == "shelf_stable" and i.get("unopened") is True
               and i.get("unit") != "bottle" and "glass" not in i["name"].casefold()
               and (not i.get("printed_date") or date.fromisoformat(i["printed_date"]) >= local_today)
               for i in details)


def install_destinations(app, legacy, persist, ledger):
    @app.get("/api/listings/<listing_id>/fallback-options")
    def fallback_options(listing_id):
        row = own_listing(listing_id)
        options = [option for option in DIRECTORY if suitable(row, option)]
        return jsonify(matches=matches(row), can_switch_to_giveaway=row["mode"] == "exchange" and available(row),
                       inedible_confirmed=row.get("inedible_confirmed", False),
                       options=options,
                       message="Pilot directory covers San Jose / Silicon Valley only. Confirm that you can reach the destination during its published hours and meet its rules. No verified option is listed for unsupported categories or other locations. Recommendations are not completed donations.")

    @app.post("/api/outcomes")
    def external_outcome():
        data = request.get_json(silent=True) or {}
        row = own_listing(data.get("listing_id"))
        action = data.get("action")
        option = next((o for o in DIRECTORY if o["id"] == data.get("destination_id") and o["type"] == action), None)
        if data.get("confirmed") is not True:
            raise BadRequest("Confirm that you actually completed the drop-off. Viewing a recommendation does not count.")
        if data.get("destination_feasible_confirmed") is not True:
            raise BadRequest("Confirm you checked this San Jose destination's current rules and completed the drop-off during its published hours.")
        if action == "donation" and data.get("no_glass_confirmed") is not True:
            raise BadRequest("Confirm that none of the donated packages contain glass.")
        # Replays return the existing outcome but never change completed food.
        prior = [r for r in g.store["impact_records"] if r["listing_id"] == row["id"] and r.get("identity") and r["action"] in {"donation", "compost"}]
        if prior:
            if all(r["action"] == action and r.get("destination_id") == data.get("destination_id") for r in prior):
                return jsonify(listing=row, message="This user-reported outcome is already recorded."), 200
            raise Conflict("This food already has a different completed outcome.")
        if row["status"] not in {"open", "expired", "withdrawn"} or row.get("reservation_id"):
            raise Conflict("Reserved or completed food cannot be reported as an external outcome.")
        if option is None or not suitable(row, option):
            raise BadRequest("No verified, compatible directory destination is listed for this food.")
        if action == "compost" and (data.get("inedible_confirmed") is not True or data.get("material") != "fruit_vegetable_scraps"):
            raise BadRequest("Confirm food is no longer edible and the material is accepted fruit/vegetable scraps.")
        row["status"] = "composted" if action == "compost" else "donated"
        persist("listings", row)
        ledger(row, action, f"external:{row['id']}", destination_id=option["id"])
        return jsonify(listing=row, message="Completed drop-off recorded as user-reported, not organization-verified."), 201

    # Retire the unsafe shortcut that recorded a donation with no destination.
    def require_outcome(listing_id):
        raise BadRequest("Choose a verified destination and explicitly report the completed drop-off through /api/outcomes.")
    app.view_functions["mark_donated"] = require_outcome
