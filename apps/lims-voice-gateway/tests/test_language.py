"""The language tally, which decides what language a call is remembered in.

The cases that matter are the ones a naive script check gets wrong: Latinised
Sinhala (which Gemini Live returns constantly) and Sinhala carrying English
loanwords.
"""

import unittest

from app.language import call_locale, detect_utterance


class DetectUtterance(unittest.TestCase):

    def test_sinhala_script_is_decisive(self):
        self.assertEqual(detect_utterance("මගේ report එක ආවද?"), "si")

    def test_tamil_script_is_decisive(self):
        self.assertEqual(detect_utterance("என் report வந்ததா?"), "ta")

    def test_latinised_sinhala_is_not_english(self):
        # This is what Gemini Live actually hands back for spoken Sinhala.
        self.assertEqual(detect_utterance("mage report eka ready da"), "si")
        self.assertEqual(detect_utterance("FBC ekak karanna puluwanda"), "si")

    def test_real_english_stays_english(self):
        self.assertEqual(detect_utterance("Can you check my report please"), "en")

    def test_empty_is_english_rather_than_a_crash(self):
        self.assertEqual(detect_utterance(""), "en")


class CallLocale(unittest.TestCase):

    def test_any_sinhala_beats_a_plurality_of_english(self):
        # "okay", "thank you" and a missed Latinisation should not outvote a
        # caller who is plainly speaking Sinhala.
        turns = ["okay", "thank you", "yes", "මට FBC එකක් ඕන"]
        self.assertEqual(call_locale(turns), "si")

    def test_a_purely_english_call_stays_english(self):
        self.assertEqual(call_locale(["Hello", "Is my report ready", "Thanks"]), "en")

    def test_tamil_wins_when_there_is_no_sinhala(self):
        self.assertEqual(call_locale(["ok", "என் report வந்ததா?"]), "ta")

    def test_silence_falls_back_to_the_house_language(self):
        self.assertEqual(call_locale([]), "si")


if __name__ == "__main__":
    unittest.main()
