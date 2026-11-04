import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from discord_bot import events_from_sse_change  # noqa: E402


class EventParsingTests(unittest.TestCase):
    def test_root_snapshot_extracts_events(self):
        events = list(events_from_sse_change("/", {
            "garage_001": {
                "events": {
                    "event_1": {"event_type": "intrusion_detected", "severity": "critical", "distance_cm": 12.5}
                }
            }
        }))
        self.assertEqual(1, len(events))
        self.assertEqual("event_1", events[0].event_id)
        self.assertEqual("garage_001", events[0].device_id)

    def test_event_patch_extracts_single_event(self):
        events = list(events_from_sse_change("/garage_002/events/event_2", {
            "event_type": "intrusion_detected", "severity": "critical", "light_level": 120
        }))
        self.assertEqual("event_2", events[0].event_id)
        self.assertEqual("garage_002", events[0].device_id)
        self.assertEqual(120, events[0].light_level)

    def test_non_event_paths_are_ignored(self):
        self.assertEqual([], list(events_from_sse_change("/garage_001/telemetry/live", {"distance_cm": 10})))
