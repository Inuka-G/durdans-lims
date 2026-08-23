"""The two derived values that decide whether a call has a voice at all."""

import os
import unittest
from unittest import mock

from app.config import Settings


class ApiVersionTest(unittest.TestCase):
    """`proactivity` and `enable_affective_dialog` do not exist on v1beta. Sent
    there they do not degrade — the server refuses the whole setup message and
    the caller gets a connected, silent line. So asking for either feature has
    to imply v1alpha."""

    def test_affective_dialog_alone_forces_v1alpha(self):
        s = Settings(affective_dialog=True, proactive_audio=False, gemini_api_version="")
        self.assertEqual(s.resolved_api_version(), "v1alpha")

    def test_proactive_audio_alone_forces_v1alpha(self):
        s = Settings(affective_dialog=False, proactive_audio=True, gemini_api_version="")
        self.assertEqual(s.resolved_api_version(), "v1alpha")

    def test_neither_feature_leaves_the_sdk_default_alone(self):
        s = Settings(affective_dialog=False, proactive_audio=False, gemini_api_version="")
        self.assertEqual(s.resolved_api_version(), "")

    def test_explicit_env_always_wins(self):
        # The escape hatch: pin the surface by hand without a rebuild.
        s = Settings(affective_dialog=True, proactive_audio=True, gemini_api_version="v1beta")
        self.assertEqual(s.resolved_api_version(), "v1beta")


class ModelTest(unittest.TestCase):

    def test_bare_name_is_given_the_models_prefix(self):
        s = Settings(gemini_live_model="gemini-2.5-flash-native-audio-latest")
        self.assertEqual(s.resolved_model(), "models/gemini-2.5-flash-native-audio-latest")

    def test_already_prefixed_name_is_left_alone(self):
        s = Settings(gemini_live_model="models/gemini-2.5-flash-native-audio-latest")
        self.assertEqual(s.resolved_model(), "models/gemini-2.5-flash-native-audio-latest")

    def test_default_is_a_native_audio_model(self):
        # Affective dialog and proactive audio are native-audio-only; a default
        # that drifted off that line would silently lose both. Env cleared so a
        # developer's own override cannot pass or fail this for us.
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIn("native-audio", Settings().resolved_model())


if __name__ == "__main__":
    unittest.main()
