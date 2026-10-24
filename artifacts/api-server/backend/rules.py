"""Deterministic eligibility, exact pickup matching and handoff state machine."""
import math
import re
from collections import defaultdict
from datetime import datetime, date, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from flask import g, jsonify, request
from werkzeug.exceptions import BadRequest, Forbidden, NotFound, Conflict

ZONES = {"Library steps", "Community Center", "Neighborhood Park",
         "Student Union", "Campus Green", "Dining Commons"}
UNITS = {"each", "g", "kg", "oz", "lb", "bag", "can", "box", "bottle", "package"}
DATE_TYPES = {"best_by", "use_by", "sell_by", "expiration"}


def now():
    return datetime.now(timezone.utc)


def instant(value):
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError()
        return result.astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError):
        raise BadRequest("Choose an exact pickup date/time with timezone.")


def text(value, label, limit=80):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= limit:
        raise BadRequest(f"Enter {label} (up to {limit} characters).")
    return value.strip()


def quantity(value):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or not 1 <= value <= 99 or int(value) != value):
        raise BadRequest("Enter a whole-number quantity from 1 to 99.")
    return int(value)


def calendar_years(value, years):
    """Calendar-year bounds, clamping February 29 to February 28."""
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(year=value.year + years, day=28)


def pickup_bounds(listing=None, stamp=None):
    stamp = stamp or now()
    lower, upper = stamp, calendar_years(stamp, 1)
    if listing is not None:
        lower = max(lower, instant(listing["pickup_start"]))
        upper = min(upper, instant(listing["pickup_end"]), instant(listing["deadline"]))
    return lower, upper


def validate_pickup_range(start, end, deadline, listing=None):
    lower, upper = pickup_bounds(listing)
    if not (lower <= start < end <= deadline <= upper):
        raise BadRequest(f"Pick a time between {lower.isoformat()} and {upper.isoformat()}. "
                         "The end must be after the start and no later than Available until.")


def norm(value):
    # Deliberately no unsupported synonyms, plural rules or unit conversions.
    return re.sub(r"\s+", " ", value.strip().casefold())


def zone(value):
    if value not in ZONES:
        raise BadRequest("Choose a listed public pickup zone, not a home address.")
    return value


def window(data):
    start, end, deadline = (instant(data.get(key)) for key in ("pickup_start", "pickup_end", "deadline"))
    validate_pickup_range(start, end, deadline)
    return start.isoformat(), end.isoformat(), deadline.isoformat()


def eligible(item, tz="America/Los_Angeles"):
    if not isinstance(item, dict):
        raise BadRequest("Each food item needs editable details.")
    name = text(item.get("name"), "a food name")
    amount = quantity(item.get("quantity"))
    unit = item.get("unit") or "each"
    if unit not in UNITS:
        raise BadRequest("Choose an explicit supported unit. No automatic unit conversions.")
    category = item.get("category")
    if category not in {"produce", "shelf_stable"}:
        raise BadRequest("Only whole produce and unopened shelf-stable packaged food are eligible.")
    if category == "shelf_stable" and item.get("unopened") is not True:
        raise BadRequest("Packaged food must be unopened.")
    # Self-reported category never overrides obvious exclusions.
    if re.search(r"\b(homemade|opened|raw|meat|chicken|fish|seafood|milk|cheese|yogurt|dairy|refrigerated|frozen|cooked|cut|chopped)\b", name, re.I):
        raise BadRequest("This food is outside the conservative whole-produce / shelf-stable pilot policy.")
    printed, kind = item.get("printed_date") or None, item.get("date_type") or None
    if bool(printed) != bool(kind) or kind and kind not in DATE_TYPES:
        raise BadRequest("Record both the printed date and its label type, or leave both blank.")
    if printed:
        try:
            parsed = date.fromisoformat(printed)
            today = now().astimezone(ZoneInfo(tz)).date()
            lower, upper = calendar_years(today, -2), calendar_years(today, 10)
            if not lower <= parsed <= upper:
                raise BadRequest(f"Pick a printed date between {lower.isoformat()} and {upper.isoformat()}.")
            if parsed < today and kind in {"use_by", "expiration"}:
                raise BadRequest("Use by and Expiration dates cannot be in the past.")
        except (ValueError, TypeError):
            raise BadRequest("Printed dates must use YYYY-MM-DD.")
    return dict(name=name, quantity=amount, unit=unit, category=category,
                unopened=item.get("unopened") is True if category == "shelf_stable" else None,
                printed_date=printed, date_type=kind)


def available(listing):
    if listing.get("status") != "open" or listing.get("inedible_confirmed"):
        return False
    if not listing.get("photo_id") or not listing.get("bob_review_id"):
        # Retain legacy rows for their owners, but require re-review before
        # publicly offering food under the new mandatory photo policy.
        return False
    try:
        if instant(listing["deadline"]) <= now() or instant(listing["pickup_end"]) <= now():
            return False
        local_date = now().astimezone(ZoneInfo(listing.get("timezone", "America/Los_Angeles"))).date()
        details = listing.get("item_details")
        return bool(details) and all(not i.get("printed_date")
                                    or i.get("date_type") in {"best_by", "sell_by"}
                                    or date.fromisoformat(i["printed_date"]) >= local_date for i in details)
    except (BadRequest, KeyError, ValueError):
        # Legacy rows without explicit structured pickup/units cannot be matched.
        return False


def overlap(a, b):
    try:
        if norm(a["location"]) != norm(b["location"]):
            return None
        start = max(instant(a["pickup_start"]), instant(b["pickup_start"]), now())
        end = min(instant(a["pickup_end"]), instant(b["pickup_end"]),
                  instant(a["deadline"]), instant(b["deadline"]))
        return (start.isoformat(), end.isoformat()) if start < end else None
    except (BadRequest, KeyError):
        return None


def counted_food(name, unit="each"):
    """Same count identity in old unit columns and new unit-in-name forms.

    Only recognize the explicit legacy unit vocabulary; never convert weights
    or infer sizes, synonyms, or singular/plural ingredient names.
    """
    name, unit = norm(name), unit or "each"
    plurals = {"bags": "bag", "cans": "can", "boxes": "box",
               "bottles": "bottle", "packages": "package"}
    match = re.fullmatch(r"(bag|bags|can|cans|box|boxes|bottle|bottles|package|packages|g|kg|oz|lb) of (.+)", name)
    if match:
        encoded_unit = plurals.get(match[1], match[1])
        if unit in {"each", encoded_unit}:
            return encoded_unit, match[2]
    return unit, name


def fulfills(listing, wanted):
    wanted_name, unit = wanted.get("wanted_food", ""), wanted.get("wanted_unit")
    amount = wanted.get("wanted_quantity")
    return any(counted_food(i["name"], i.get("unit")) == counted_food(wanted_name, unit)
               and amount is not None and i["quantity"] >= amount
               for i in listing.get("item_details", []))


def blocked(a, b):
    return any({r["user_id"], r["blocked_user_id"]} == {a, b} for r in g.store["user_blocks"])


def matches(listing):
    if not available(listing) or listing["mode"] != "exchange":
        return []
    result = []
    for other in g.store["listings"]:
        if other["user_id"] == listing["user_id"] or other["mode"] != "exchange" or not available(other):
            continue
        if other["user_id"] not in g.active_users or blocked(listing["user_id"], other["user_id"]):
            continue
        pickup = overlap(listing, other)
        if not pickup or not fulfills(listing, other) or not fulfills(other, listing):
            continue
        if any(o["status"] not in {"declined", "completed"} and
               {o["listing_id"], o["match_id"]} == {listing["id"], other["id"]}
               for o in g.store["trade_offers"]):
            continue
        result.append(dict(listing=other, give=listing["items"], receive=other["items"],
                           give_items=listing["item_details"], receive_items=other["item_details"],
                           pickup_start=pickup[0], pickup_end=pickup[1], location=listing["location"],
                           reason="Reciprocal foods and explicit quantities/units match; public pickup windows overlap. Entire bundles stay together."))
    # Urgency first, then longer pickup overlap; never claims travel optimization.
    result.sort(key=lambda m: (m["listing"]["deadline"],
                -(instant(m["pickup_end"]) - instant(m["pickup_start"])).total_seconds(), m["listing"]["id"]))
    return result


def get_row(table, identifier):
    row = next((r for r in g.store[table] if r["id"] == identifier), None)
    if row is None:
        raise NotFound("This record was not found.")
    return row


def own_listing(identifier):
    row = get_row("listings", identifier)
    if row["user_id"] != g.user["id"]:
        raise Forbidden("Only the listing owner can do this.")
    return row


def participants(row, giveaway=False):
    return {row["owner_id"], row["requester_id"]} if giveaway else {p["user_id"] for p in row["participants"]}


def validate_actor(row, giveaway=False):
    if g.user["id"] not in participants(row, giveaway):
        raise Forbidden("Only a participant can act on this handoff.")


def install_rules(app, legacy):
    save = legacy["save_row"]
    notify = legacy["create_notification"]

    def replace(endpoint):
        def decorate(fn):
            app.view_functions[endpoint] = fn
            return fn
        return decorate

    def persist(table, row):
        if not any(r["id"] == row["id"] for r in g.store[table]):
            g.store[table].append(row)
        save(table, row)
        return row

    def ledger(listing, action, identity, offer_id=None, destination_id=None):
        for index, item in enumerate(listing["item_details"]):
            # UUID5 deterministic identity + DB unique key -> exactly once.
            from uuid import uuid5, NAMESPACE_URL
            key = f"{identity}:{listing['id']}:{index}"
            persist("impact_records", dict(
                id=str(uuid5(NAMESPACE_URL, key)), listing_id=listing["id"],
                offer_id=offer_id, user_id=listing["user_id"], action=action,
                item_count=0, item_name=item["name"], quantity=item["quantity"],
                unit=item["unit"], identity=key, destination_id=destination_id,
                confirmation_type="both_participants" if action in {"exchange", "giveaway"} else "user_reported",
                is_test=listing.get("is_test", False), created_at=now().isoformat()))

    @replace("health")
    def health():
        import shutil
        from bob import executable
        import os
        setup = []
        db = legacy["supabase"]
        storage = "unavailable"
        if db:
            try:
                snapshot = db.rpc("echopantry_snapshot").execute().data
                storage = "supabase"
                if snapshot.get("schema_version", 0) < 3:
                    setup.append("Apply the updated backend/interview_migration.sql to enable required photo and Bob approvals. Existing records are preserved.")
            except Exception:
                setup.append("Supabase connection or schema unavailable. Apply the supplied schema and interview migration to the existing project.")
        else:
            setup.append("Supabase URL or keys are invalid or incomplete.")
        bob_ready = bool(executable() and os.environ.get("BOB_API_KEY"))
        if not bob_ready:
            setup.append("IBM Bob runtime is unavailable; manual entry remains available after database setup.")
        return jsonify(status="ok" if not setup else "setup_required", backend="Flask",
                       storage=storage, authentication="supabase-auth",
                       bob="configured_not_verified" if bob_ready else "unavailable", setup_required=setup)

    app.add_url_rule("/api/healthz", "healthz", lambda: jsonify(status="ok"))

    @replace("get_listings")
    def get_listings():
        mine = request.args.get("mine") == "true"
        if mine and not getattr(g, "user", None):
            raise Forbidden("Sign in to see your listings.")
        uid = g.user["id"] if getattr(g, "user", None) else None
        rows = [r for r in g.store["listings"] if
                (r["user_id"] == uid if mine else available(r))
                and r["user_id"] in g.active_users
                and (not uid or not blocked(uid, r["user_id"]))]
        return jsonify(listings=sorted(rows, key=lambda r: r["deadline"]))

    @replace("create_listing")
    def create_listing():
        from listing_review import validated_fields, consume_approval
        data = request.get_json(silent=True) or {}
        fields = validated_fields(data)
        listing_id = str(uuid4())
        approval = consume_approval(data, fields, listing_id, persist)
        row = dict(id=listing_id, user_id=g.user["id"], name=g.user["name"],
                   **fields, **approval,
                   rating=None, trades=0, status="open", created_at=now().isoformat())
        persist("listings", row)
        # Standalone request notifications require full quantity/unit/window fit.
        for r in g.store["food_requests"]:
            if r.get("status") != "open" or not r.get("user_id") or r["user_id"] == row["user_id"]:
                continue
            if (not blocked(r["user_id"], row["user_id"]) and
                    fulfills(row, {"wanted_food": (r.get("items") or [""])[0], "wanted_unit": r.get("unit"), "wanted_quantity": r.get("quantity")}) and overlap(row, r)):
                notify(r["user_id"], "request_match", "A quantity-compatible listing overlaps your public pickup window.", row["id"])
        return jsonify(listing=row, matches=matches(row)), 201

    @replace("get_matches")
    def get_matches(listing_id):
        return jsonify(matches=matches(own_listing(listing_id)))
    app.add_url_rule("/api/listings/<listing_id>/matches", "get_matches_read", get_matches, methods=["GET"])

    @app.route("/api/listings/<listing_id>", methods=["PATCH", "DELETE"])
    def change_listing(listing_id):
        row = own_listing(listing_id)
        if row["status"] not in {"open", "expired"}:
            raise Conflict("Only an unreserved, unresolved listing can change.")
        data = request.get_json(silent=True) or {}
        if request.method == "PATCH" and data.get("approval_id"):
            from listing_review import validated_fields, consume_approval
            fields = validated_fields(data)
            approval = consume_approval(data, fields, listing_id, persist)
            row.update(**fields, **approval, status="open", reservation_id=None)
            persist("listings", row)
            return jsonify(listing=row)
        if request.method == "DELETE":
            row["status"] = "withdrawn"
        elif data.get("inedible_confirmed") is True:
            row["inedible_confirmed"] = True
            row["status"] = "withdrawn"
        else:
            raise BadRequest("Changed listing details, including a giveaway switch, require a new Bob/photo review.")
        persist("listings", row)
        return jsonify(listing=row)

    @replace("create_offer")
    def create_offer():
        data = request.get_json(silent=True) or {}
        row = own_listing(data.get("listing_id"))
        candidate = next((m for m in matches(row) if m["listing"]["id"] == data.get("match_id")), None)
        if not candidate:
            raise Conflict("That match is no longer compatible or available.")
        other = candidate["listing"]
        offer = dict(id=str(uuid4()), listing_id=row["id"], match_id=other["id"],
                     give=row["items"], receive=other["items"], give_items=row["item_details"],
                     receive_items=other["item_details"], pickup_start=candidate["pickup_start"],
                     pickup_end=candidate["pickup_end"], location=row["location"],
                     participants=[dict(user_id=r["user_id"], name=r["name"]) for r in [row, other]],
                     accepted_by=[], completed_by=[], status="pending", created_at=now().isoformat())
        persist("trade_offers", offer)
        notify(other["user_id"], "trade_offer", "Review the exact items and overlapping pickup window before responding.", offer["id"])
        return jsonify(offer=offer), 201

    def transition(identifier, giveaway=False, action="respond"):
        table = "food_requests" if giveaway else "trade_offers"
        row = get_row(table, identifier)
        validate_actor(row, giveaway)
        uid = g.user["id"]
        involved = [get_row("listings", row["listing_id"])]
        if not giveaway:
            involved.append(get_row("listings", row["match_id"]))
        members = participants(row, giveaway)
        if action == "complete":
            if row["status"] == "completed":
                return row
            if row["status"] not in {"confirmed", "approved", "completion_pending"}:
                raise Conflict("Only an approved handoff can be confirmed.")
            if any(r.get("reservation_id") != row["id"] or r["status"] != "reserved" for r in involved):
                raise Conflict("The reservation no longer belongs to this handoff.")
            row["completed_by"] = sorted(set(row.get("completed_by", [])) | {uid})
            if set(row["completed_by"]) == members:
                row["status"] = "completed"
                for listing in involved:
                    listing["status"] = "given_away" if giveaway else "traded"
                    persist("listings", listing)
                    ledger(listing, "giveaway" if giveaway else "exchange", row["id"], None if giveaway else row["id"])
            else:
                row["status"] = "completion_pending"
                for other in members - {uid}:
                    notify(other, "giveaway_confirmation" if giveaway else "trade_completion", "Your partner confirmed pickup. Confirm only after your own handoff.", row["id"])
        elif action == "cancel" or (request.get_json(silent=True) or {}).get("accept") is False:
            if giveaway and action != "cancel" and uid != row["owner_id"]:
                raise Forbidden("Only the owner can approve or decline a giveaway request.")
            if row["status"] == "completed" or row.get("completed_by"):
                raise Conflict("A completed or partially confirmed handoff cannot be cancelled or reopened.")
            row["status"] = "declined"
            for listing in involved:
                if listing.get("reservation_id") == row["id"] and listing["status"] == "reserved":
                    listing.update(status="open", reservation_id=None)
                    persist("listings", listing)
            for other in members - {uid}:
                own = next((l for l in involved if l["user_id"] == other), involved[0])
                notify(other, "trade_declined", "Handoff declined or cancelled. Review alternative matches or donation options.", own["id"])
        else:
            if (request.get_json(silent=True) or {}).get("accept") is not True:
                raise BadRequest("Choose accept or decline explicitly.")
            if giveaway and uid != row["owner_id"]:
                raise Forbidden("Only the owner can approve this giveaway.")
            if row["status"] in {"confirmed", "approved", "completion_pending", "completed"}:
                return row
            if row["status"] == "declined":
                raise Conflict("A declined offer cannot be accepted again.")
            if any(not available(l) or l["user_id"] not in g.active_users for l in involved):
                raise Conflict("Food is expired, unavailable or already reserved by another handoff.")
            if any(blocked(a, b) for a in members for b in members if a != b):
                raise Forbidden("This handoff is blocked.")
            if instant(row["pickup_end"]) <= now():
                raise Conflict("The pickup window has passed.")
            # Verify fixed bundle snapshot still equals current server items.
            for index, listing in enumerate(involved):
                snapshot = row.get("item_details") if giveaway else row["give_items" if index == 0 else "receive_items"]
                if snapshot != listing["item_details"]:
                    raise Conflict("Food contents changed. Create a new offer.")
            if not giveaway and (any(l["mode"] != "exchange" for l in involved) or not fulfills(involved[0], involved[1]) or not fulfills(involved[1], involved[0]) or not overlap(*involved)):
                raise Conflict("This exchange no longer satisfies matching rules.")
            row["accepted_by"] = sorted(set(row.get("accepted_by", [])) | {uid})
            if giveaway or set(row["accepted_by"]) == members:
                row["status"] = "approved" if giveaway else "confirmed"
                for listing in involved:
                    listing.update(status="reserved", reservation_id=row["id"])
                    persist("listings", listing)
            else:
                row["status"] = "awaiting_second_acceptance"
            for other in members - {uid}:
                notify(other, "giveaway_approved" if giveaway else "trade_offer", "Review the current handoff status in My handoffs.", row["id"])
        persist(table, row)
        return row

    @replace("decide_offer")
    def decide_offer(offer_id):
        return jsonify(offer=transition(offer_id))
    app.add_url_rule("/api/offers/<offer_id>/respond", "respond_offer", decide_offer, methods=["POST"])

    @replace("complete_offer")
    def complete_offer(offer_id):
        return jsonify(offer=transition(offer_id, action="complete"))
    app.add_url_rule("/api/offers/<offer_id>/confirm-pickup", "confirm_offer", complete_offer, methods=["POST"])
    app.add_url_rule("/api/offers/<offer_id>/cancel", "cancel_offer", lambda offer_id: jsonify(offer=transition(offer_id, action="cancel")), methods=["POST"])

    @replace("request_giveaway")
    def request_giveaway(listing_id):
        listing = get_row("listings", listing_id)
        if listing["mode"] != "giveaway" or not available(listing):
            raise Conflict("This giveaway is no longer available.")
        if listing["user_id"] == g.user["id"] or blocked(listing["user_id"], g.user["id"]):
            raise Forbidden("You cannot request this giveaway.")
        data = request.get_json(silent=True) or {}
        recipient = dict(location=zone(data.get("location")), pickup_start=data.get("pickup_start"),
                         pickup_end=data.get("pickup_end"), deadline=listing["deadline"])
        start, end = instant(recipient["pickup_start"]), instant(recipient["pickup_end"])
        # Do not silently clip an invalid request to an overlapping window.
        validate_pickup_range(start, end, end, listing)
        pickup = overlap(listing, recipient)
        if not pickup:
            raise BadRequest("Your pickup zone and exact availability must overlap the owner's window.")
        if any(r.get("listing_id") == listing_id and r.get("requester_id") == g.user["id"] and r["status"] not in {"declined", "completed"} for r in g.store["food_requests"]):
            raise Conflict("You already have a pending request for this giveaway.")
        row = dict(id=str(uuid4()), listing_id=listing_id, requester_id=g.user["id"],
                   owner_id=listing["user_id"], requester_name=g.user["name"],
                   status="pending", completed_by=[], accepted_by=[g.user["id"]],
                   item_details=listing["item_details"], location=listing["location"],
                   pickup_start=pickup[0], pickup_end=pickup[1], created_at=now().isoformat())
        persist("food_requests", row)
        notify(listing["user_id"], "giveaway_request", "A neighbor requested your whole giveaway. Review pickup details.", row["id"])
        return jsonify(request=row), 201

    @replace("decide_giveaway")
    def decide_giveaway(request_id):
        return jsonify(request=transition(request_id, True))

    @replace("confirm_giveaway_pickup")
    def confirm_giveaway_pickup(request_id):
        return jsonify(request=transition(request_id, True, "complete"))
    app.add_url_rule("/api/giveaway-requests/<request_id>/cancel", "cancel_giveaway", lambda request_id: jsonify(request=transition(request_id, True, "cancel")), methods=["POST"])

    @replace("create_request")
    def create_request():
        data = request.get_json(silent=True) or {}
        names = data.get("items")
        names = [names] if isinstance(names, str) else names
        if not isinstance(names, list) or len(names) != 1 or "," in names[0]:
            raise BadRequest("Choose exactly one wanted ingredient for a standalone request.")
        name = text(names[0], "one wanted ingredient")
        amount = quantity(data.get("quantity"))
        unit = data.get("unit") or "each"
        if unit not in UNITS:
            raise BadRequest("Choose an explicit quantity unit.")
        start, end, due = window(data)
        row = dict(id=str(uuid4()), user_id=g.user["id"], name=g.user["name"],
                   items=[name], quantity=amount, unit=unit, quantities={name: amount},
                   location=zone(data.get("location")), pickup_start=start, pickup_end=end,
                   deadline=due, status="open", created_at=now().isoformat())
        persist("food_requests", row)
        for listing in g.store["listings"]:
            if (available(listing) and listing["user_id"] != g.user["id"] and
                not blocked(listing["user_id"], g.user["id"]) and overlap(listing, row) and
                fulfills(listing, dict(wanted_food=name, wanted_quantity=amount, wanted_unit=unit))):
                notify(g.user["id"], "request_match", "A compatible quantity and pickup window is available.", listing["id"])
        return jsonify(request=row), 201

    @replace("get_impact")
    def get_impact():
        from werkzeug.exceptions import Unauthorized
        if not getattr(g, "user", None):
            raise Unauthorized("Sign in to see your impact")
        uid = g.user["id"]
        # Ledger rows identify the giver. Resolve completed handoffs as well so
        # recipients see their impact without exposing unrelated users' rows.
        trades = {
            row["id"]: {row["listing_id"], row["match_id"]}
            for row in g.store["trade_offers"]
            if row.get("status") == "completed"
            and uid in {p["user_id"] for p in row.get("participants", [])}
            and {p["user_id"] for p in row.get("participants", [])}
                <= set(row.get("completed_by", []))
        }
        giveaways = {
            (row["id"], row["listing_id"])
            for row in g.store["food_requests"]
            if row.get("status") == "completed"
            and uid in {row.get("owner_id"), row.get("requester_id")}
            and {row.get("owner_id"), row.get("requester_id")}
                <= set(row.get("completed_by", []))
        }
        records = []
        for r in g.store["impact_records"]:
            identity = r.get("identity")
            if r.get("is_test") or not isinstance(identity, str) or not identity or r.get("quantity") is None:
                continue
            action = r.get("action")
            if action in {"donation", "compost"}:
                belongs = r.get("user_id") == uid and r.get("confirmation_type") == "user_reported"
            elif action == "exchange":
                belongs = (r.get("listing_id") in trades.get(r.get("offer_id"), set())
                           and r.get("confirmation_type") == "both_participants")
            elif action == "giveaway":
                belongs = ((identity.split(":", 1)[0], r.get("listing_id")) in giveaways
                           and r.get("confirmation_type") == "both_participants")
            else:
                belongs = False
            if belongs:
                records.append(r)
        totals = defaultdict(float)
        for r in records:
            totals[(r["action"], r["item_name"], r["unit"])] += r["quantity"]
        events = lambda action: len({r.get("offer_id") or r["listing_id"] for r in records if r["action"] == action})
        return jsonify(completed_trades=events("exchange"), completed_giveaways=events("giveaway"),
                       donations_reported=events("donation"), compost_reported=events("compost"),
                       quantities=[dict(action=a, name=n, unit=u, quantity=q) for (a, n, u), q in sorted(totals.items())],
                       records=[{key: r.get(key) for key in ("action", "item_name", "quantity", "unit", "confirmation_type", "created_at")} for r in records],
                       note="Your completed handoffs as giver or receiver, confirmed by both participants. Only donation and compost reports you made are included. Unlike units are never summed; no waste, money or emissions estimates.")

    from destinations import install_destinations
    install_destinations(app, legacy, persist, ledger)
    from bob import install_bob
    install_bob(app)
    from photos import install_photos
    from listing_review import install_review
    install_photos(app, persist)
    install_review(app, persist)
