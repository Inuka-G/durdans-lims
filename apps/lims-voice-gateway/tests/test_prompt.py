"""The system prompt is the loudest thing this service says, so the parts that
are computed rather than written get pinned here: the time band, the caller
block, and the rules that must survive every future prompt edit.
"""

import unittest
from datetime import datetime, timedelta, timezone

from app.prompt import build_system_prompt, caller_context, opening_instruction, time_context

LK = timezone(timedelta(hours=5, minutes=30))


def at(hour: int, day: int = 23, month: int = 8, year: int = 2026) -> datetime:
    return datetime(year, month, day, hour, 30, tzinfo=LK)


class TimeContext(unittest.TestCase):

    def test_morning_gets_the_morning_greeting(self):
        self.assertIn("සුබ උදෑසනක්", time_context(at(8)))

    def test_night_does_not_get_the_morning_greeting(self):
        block = time_context(at(21))
        self.assertIn("සුබ රාත්‍රියක්", block)
        self.assertNotIn("සුබ උදෑසනක්", block)

    def test_noon_is_afternoon_and_five_is_evening(self):
        self.assertIn("සුබ දහවලක්", time_context(at(12)))
        self.assertIn("සුබ සැන්දෑවක්", time_context(at(17)))

    def test_a_utc_timestamp_is_read_in_colombo_time(self):
        # 03:00 UTC is 08:30 in Colombo — morning, not night.
        utc_dawn = datetime(2026, 8, 23, 3, 0, tzinfo=timezone.utc)
        self.assertIn("සුබ උදෑසනක්", time_context(utc_dawn))

    def test_states_that_its_own_greeting_is_not_a_language_signal(self):
        self.assertIn("not a language signal", time_context(at(9)))


class CallerContext(unittest.TestCase):

    def test_an_unknown_caller_adds_nothing(self):
        self.assertEqual(caller_context(None), "")
        self.assertEqual(caller_context({"known": False}), "")

    def test_a_name_is_offered_but_never_as_proof(self):
        block = caller_context({"known": True, "displayName": "Kalana"})
        self.assertIn("Kalana", block)
        self.assertIn("never treat it as proof", block)

    def test_a_previous_call_is_recalled_only_when_relevant(self):
        block = caller_context({
            "known": True,
            "displayName": "Kalana",
            "locale": "si",
            "lastCallSummary": "report status",
            "lastCallOn": "yesterday",
        })
        self.assertIn("report status", block)
        self.assertIn("yesterday", block)
        self.assertIn("ONLY if it is relevant", block)

    def test_an_unsupported_locale_is_ignored_rather_than_spoken(self):
        block = caller_context({"known": True, "locale": "fr"})
        self.assertNotIn("Open in that language", block)


class SystemPrompt(unittest.TestCase):

    def test_the_agent_is_a_named_person_in_both_scripts(self):
        prompt = build_system_prompt("සමාලි", "Samali", None, at(9))
        self.assertIn("සමාලි", prompt)
        self.assertIn("Samali", prompt)

    def test_the_safety_floor_survives(self):
        prompt = build_system_prompt("සමාලි", "Samali", None, at(9))
        # Grounding: prices and status come from tools, verbatim.
        self.assertIn("MUST come from your tools", prompt)
        # No clinical interpretation, ever.
        self.assertIn("reference ranges", prompt)
        # Sinhala default with an explicit switch condition.
        self.assertIn("full sentence", prompt)

    def test_it_teaches_the_filler_that_covers_a_lookup(self):
        prompt = build_system_prompt("සමාලි", "Samali", None, at(9))
        self.assertIn("ටිකක් ඉන්න", prompt)

    def test_the_caller_block_is_appended_when_we_know_them(self):
        prompt = build_system_prompt("සමාලි", "Samali", {"known": True, "displayName": "Kalana"}, at(9))
        self.assertIn("WHAT YOU ALREADY KNOW ABOUT THIS CALLER", prompt)


class OpeningInstruction(unittest.TestCase):

    def test_it_tells_the_model_to_speak_first(self):
        opener = opening_instruction("සමාලි")
        self.assertIn("සමාලි", opener)
        self.assertIn("බලාගෙන ඉන්න එපා", opener)

    def test_a_known_name_is_carried_into_the_opener(self):
        self.assertIn("Kalana", opening_instruction("සමාලි", "Kalana"))


if __name__ == "__main__":
    unittest.main()
