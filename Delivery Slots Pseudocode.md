# Delivery Slot Allocation — Pseudocode

> **Task 2 — Backend Assessment**
> Detailed pseudocode for dynamically allocating delivery slots, preventing
> overbooking under concurrent access, and suggesting alternatives in real time.

---

## Table of Contents

1. [Objective](#objective)
2. [Data Model](#1-data-model-assumed)
3. [High-Level Flow](#2-high-level-flow)
4. [Handling Concurrency Safely](#3-handling-concurrency-safely--three-options-considered)
5. [Chosen Solution & Rationale](#4-chosen-solution-option-b--atomic-conditional-update)
6. [Worked Example](#5-worked-example-trace-with-sample-data)
7. [Alternative Slot Suggestion Logic](#6-alternative-slot-suggestion-logic)
8. [Customer-Facing Feedback](#7-customer-facing-feedback-always-immediate-never-blocking)

---

## Objective

Design the backend logic for dynamically allocating delivery slots to customers,
preventing overbooking, and suggesting alternative slots when the preferred one is
unavailable — while safely handling delivery slots as a **shared resource** accessed
concurrently by many customers.

**Requirements covered:**

| #   | Requirement                                        | Where it's handled                 |
| --- | -------------------------------------------------- | ---------------------------------- |
| 1   | Allocate slots dynamically based on availability   | §2 `getAvailableSlots`, `bookSlot` |
| 2   | Prevent overbooking (track booked count)           | §3–§4 Atomic Conditional Update    |
| 3   | Suggest alternatives if preferred slot unavailable | §6 `findAlternativeSlots`          |
| 4   | Treat slots as a shared resource                   | §3–§4 Concurrency handling         |

---

## 1. Data Model (assumed)

```
Slot {
  slotId
  date
  startTime, endTime
  capacity          # maximum bookings allowed for this slot
  bookedCount       # current number of confirmed bookings
}

Booking {
  bookingId
  slotId
  customerId
  orderId
  createdAt
}
```

> A slot is **available** when `bookedCount < capacity`.

---

## 2. High-Level Flow

```
function getAvailableSlots(date):
    if date is missing or invalid:
        return "Error: A valid date is required"

    slots = fetch all slots for the given date from the database

    if slots is empty:
        return "No delivery slots exist for the selected date"

    - For each slot, compute isAvailable = (bookedCount < capacity).
    - Return the list of slots with their availability flag,
      so the app can render available slots as clickable and full slots as disabled.


function bookSlot(customerId, orderId, preferredSlotId):
    if customerId or orderId or preferredSlotId is missing:
        return "Error: customerId, orderId, and preferredSlotId are all required"

    slot = fetch slot by preferredSlotId
    if slot does not exist:
        return "Error: The selected slot does not exist"

    - Attempt to reserve the preferred slot using an ATOMIC conditional update
      (see §3 for why this specific approach was chosen).
    - If the atomic update succeeds:
        - Create a Booking record linking customerId, orderId, and slotId.
        - Return immediate success feedback with the booking confirmation.
    - If the atomic update fails (slot became full between display and submission):
        - Search for alternative slots close to the preferred one
          (see §6 for the alternative-suggestion logic).
        - If alternatives exist, return them to the customer to choose from.
        - If no alternatives exist at all, return a clear
          "no alternative slots available" message.


function confirmAlternativeSlot(customerId, orderId, chosenAlternativeSlotId):
    if chosenAlternativeSlotId is missing:
        return "Error: chosenAlternativeSlotId is required"

    - Re-run bookSlot() logic against chosenAlternativeSlotId.
    - (Same atomic reservation path — no special-casing needed, since an
      alternative slot is booked using the exact same safe operation.)
```

---

## 3. Handling Concurrency Safely — Three Options Considered

Because many customers can attempt to book the same slot at the same moment, booking
a slot **cannot** be a simple "read count → check → write count" sequence run as
separate steps — two requests could both read the same `bookedCount`, both pass the
check, and both write an increment, allowing the slot to be overbooked.

Three options were considered to prevent this:

### Option A — Pessimistic Locking (`SELECT ... FOR UPDATE`)

```
BEGIN TRANSACTION
    SELECT bookedCount, capacity FROM slots WHERE slotId = X FOR UPDATE
    -- this row is now locked; any other transaction touching the same
    -- slot must wait until this transaction commits or rolls back
    IF bookedCount < capacity:
        UPDATE slots SET bookedCount = bookedCount + 1 WHERE slotId = X
        COMMIT
    ELSE:
        ROLLBACK
```

Explicitly locks the row for the duration of the transaction, guaranteeing no other
request can read or modify it until the lock is released.

### Option B — Atomic Conditional Update ✅ _(chosen — see §4)_

```
UPDATE slots
SET bookedCount = bookedCount + 1
WHERE slotId = X AND bookedCount < capacity
RETURNING slotId, bookedCount

# If a row is returned    -> booking succeeded, slot was reserved.
# If no row is returned   -> booking failed, slot was already full.
```

The check-and-increment happens as a single atomic database operation with no
explicit lock and no open transaction spanning multiple round trips.

### Option C — Optimistic Locking (version / compare-and-swap)

```
SELECT bookedCount, version FROM slots WHERE slotId = X

UPDATE slots
SET bookedCount = bookedCount + 1, version = version + 1
WHERE slotId = X AND version = <version read above>

# If 0 rows affected -> another request modified the slot first; retry from the read.
```

Reads a version number alongside the data, then writes only if the version hasn't
changed since the read; otherwise the caller retries.

### Quick Comparison

|                                   | Locking style              | Wait/block on contention?     | Complexity | Best suited for                                      |
| --------------------------------- | -------------------------- | ----------------------------- | ---------- | ---------------------------------------------------- |
| **A — Pessimistic**               | Explicit row lock          | Yes — requests queue          | Low        | Multi-step operations that must be one atomic unit   |
| **B — Atomic Conditional Update** | None (DB-native atomicity) | No — resolves instantly       | Low        | Simple single-field conditional writes _(this case)_ |
| **C — Optimistic**                | Version check + retry      | No — but requires retry logic | Medium     | Records with multiple independently-updated fields   |

---

## 4. Chosen Solution: Option B — Atomic Conditional Update

### ✅ Why this one

- The booking operation itself is simple — a single conditional increment — so it
  doesn't need multiple related reads/writes bundled into one transaction the way
  more complex operations do.
- It requires no explicit row locking and no held transaction across round trips, so
  requests are never queued waiting for a lock to release — each request is resolved
  immediately, succeeding or failing based on the current state at the moment it runs.
- Correctness is guaranteed by the database engine's own atomicity for a single
  conditional write, which is sufficient here since there is exactly one field
  (`bookedCount`) being safely mutated under a single condition.
- It scales predictably under high concurrent load (e.g. many customers booking
  slots around the same popular time window), since there's no lock contention
  building up as request volume increases.

### ❌ Why not Option A (Pessimistic Locking)

- Explicit row locking is well suited to operations with multiple interdependent
  reads/writes that must be treated as one unit, but here it adds unnecessary cost:
  every concurrent booking attempt on the same slot has to wait in line for the lock
  to be released rather than being resolved immediately.
- Under high load — many customers targeting the same popular slot at once — this
  creates a growing queue of waiting requests, added latency, and a higher risk of
  timeouts or deadlocks if other transactions touch overlapping rows in a different
  order. This is the same class of contention issue previously encountered with a
  `SELECT FOR UPDATE` pattern on a high-traffic table, which was resolved by moving
  to an atomic conditional update instead — the same reasoning applies directly here.

### ❌ Why not Option C (Optimistic Locking)

- Optimistic locking is most valuable when a record has several independent fields
  that different requests update concurrently, where retry-on-conflict avoids
  unnecessary blocking. Here, the entire operation is a single-field conditional
  increment — Option B already achieves the same safety in one round trip, without
  the extra complexity of tracking a version field and implementing retry logic for
  a case that a plain conditional `WHERE` clause already handles directly.

---

## 5. Worked Example (Trace with Sample Data)

```
# Sample slots for 2026-08-25
slots = [
    { slotId: "S1", startTime: "09:00", capacity: 2, bookedCount: 2 },  # full
    { slotId: "S2", startTime: "10:00", capacity: 2, bookedCount: 1 },  # available
    { slotId: "S3", startTime: "11:00", capacity: 3, bookedCount: 0 },  # available
]
```

**Step 1 — Customer views slots**

```
result = getAvailableSlots("2026-08-25")
# -> [
#      { slotId: "S1", isAvailable: false },
#      { slotId: "S2", isAvailable: true },
#      { slotId: "S3", isAvailable: true }
#    ]
# App renders S1 as disabled, S2 and S3 as clickable.
```

**Step 2 — Customer selects the full slot S1 and submits**

```
result = bookSlot(customerId: "C100", orderId: "O55", preferredSlotId: "S1")
# Atomic update: UPDATE slots SET bookedCount = bookedCount + 1
#                WHERE slotId = "S1" AND bookedCount < capacity
# -> 0 rows affected (2 is not < 2) -> booking fails
```

**Step 3 — Since S1 failed, find alternatives**

```
alternatives = findAlternativeSlots(preferredSlot: S1, date: "2026-08-25")
# S1 excluded, S2 and S3 remain, sorted by closeness to 09:00
# -> [ { slotId: "S2", startTime: "10:00" }, { slotId: "S3", startTime: "11:00" } ]

# result returned to the app:
# {
#   status: "SLOT_FULL_WITH_ALTERNATIVES",
#   alternatives: [S2, S3]
# }
```

**Step 4 — Customer picks alternative S2**

```
result = confirmAlternativeSlot(customerId: "C100", orderId: "O55", chosenAlternativeSlotId: "S2")
# Atomic update: UPDATE slots SET bookedCount = bookedCount + 1
#                WHERE slotId = "S2" AND bookedCount < capacity
# -> 1 row affected (1 is < 2) -> booking succeeds, bookedCount for S2 becomes 2

# Final feedback to customer:
# {
#   status: "SUCCESS",
#   bookingId: "B789",
#   slot: { slotId: "S2", startTime: "10:00" }
# }
```

---

## 6. Alternative Slot Suggestion Logic

```
function findAlternativeSlots(preferredSlot, date):
    if preferredSlot does not exist:
        return "Error: Cannot find alternatives for an unknown slot"

    - Fetch all slots for the same date where bookedCount < capacity.
    - Exclude the preferred slot itself (already known to be full).
    - Sort remaining available slots by absolute time distance from the
      preferred slot's startTime (closest first).
    - If fewer than N alternatives found on the same date, also check the
      following date using the same logic, and append those results.
    - Return the top N closest available alternatives (e.g. N = 3).
    - If the resulting list is empty, signal that no alternatives are available.
```

---

## 7. Customer-Facing Feedback (always immediate, never blocking)

```
On bookSlot() result:
    - SUCCESS                     -> return booking confirmation (slot details + bookingId)
    - SLOT_FULL_WITH_ALTERNATIVES -> return list of alternative slots to choose from
    - SLOT_FULL_NO_ALTERNATIVES   -> return a clear "no alternative slots available" message
```

> Every outcome is returned **synchronously** in response to the customer's request —
> there is no polling or delayed confirmation, satisfying the requirement for
> real-time feedback in the app.
