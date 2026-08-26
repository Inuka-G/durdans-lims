"""The degradation rules for the boot-time Live probe.

These exist because the failure they guard against is invisible from the
outside: the container is healthy, WhatsApp answers the call, and the caller
hears nothing at all. Every branch below is a way that could happen again.
"""

import asyncio
import unittest

from app import live_check
from app.live_check import LiveCapabilities, probe_live_capabilities


def run(coro):
    return asyncio.run(coro)


class FakeConnect:
    """Stands in for a real Live handshake. `refuse` names the features the
    server rejects; None is the baseline, plain-setup probe."""

    def __init__(self, refuse=(), fail_baseline=False, hang=()):
        self.refuse = set(refuse)
        self.fail_baseline = fail_baseline
        self.hang = set(hang)
        self.seen = []

    async def __call__(self, model, api_version, feature):
        self.seen.append(feature)
        if feature is None and self.fail_baseline:
            raise RuntimeError("1007 None. Invalid model name")
        if feature in self.hang:
            await asyncio.sleep(60)
        if feature in self.refuse:
            raise RuntimeError(
                f'1007 None. Invalid JSON payload received. Unknown name "{feature}" at \'setup\''
            )


ALL_WANTED = LiveCapabilities(affective_dialog=True, proactive_audio=True, async_tools=True)


class ProbeTest(unittest.TestCase):

    def _probe(self, connect, want=ALL_WANTED):
        return run(probe_live_capabilities(
            model="models/test", api_version="v1alpha", want=want, connect=connect,
        ))

    def test_everything_accepted_keeps_everything(self):
        connect = FakeConnect()
        result = self._probe(connect)
        self.assertEqual(
            (result.affective_dialog, result.proactive_audio, result.async_tools, result.probed),
            (True, True, True, True),
        )
        self.assertEqual(connect.seen, [None, "affective", "proactive", "async_tools"])

    def test_refused_field_is_disabled_and_the_others_survive(self):
        # The real 2026-08-23 outage: proactivity is a v1alpha-only field and was
        # sent to v1beta. One bad field must cost one feature, not the call.
        result = self._probe(FakeConnect(refuse={"proactive"}))
        self.assertFalse(result.proactive_audio)
        self.assertTrue(result.affective_dialog)
        self.assertTrue(result.async_tools)
        self.assertTrue(result.probed)

    def test_every_optional_field_can_be_refused_at_once(self):
        result = self._probe(FakeConnect(refuse={"affective", "proactive", "async_tools"}))
        self.assertEqual(
            (result.affective_dialog, result.proactive_audio, result.async_tools),
            (False, False, False),
        )
        self.assertTrue(result.probed)

    def test_failed_baseline_changes_nothing_and_reports_unprobed(self):
        # A dead key or an unreachable API says nothing about individual fields.
        # Switching features off on that evidence would be guessing.
        connect = FakeConnect(fail_baseline=True)
        result = self._probe(connect)
        self.assertEqual(
            (result.affective_dialog, result.proactive_audio, result.async_tools),
            (True, True, True),
        )
        self.assertFalse(result.probed)
        self.assertEqual(connect.seen, [None], "no feature probes after a failed baseline")

    def test_features_not_asked_for_are_never_probed(self):
        connect = FakeConnect()
        want = LiveCapabilities(affective_dialog=False, proactive_audio=True, async_tools=False)
        result = self._probe(connect, want=want)
        self.assertEqual(connect.seen, [None, "proactive"])
        self.assertFalse(result.affective_dialog)
        self.assertTrue(result.proactive_audio)

    def test_a_hanging_probe_is_treated_as_a_refusal(self):
        # A field the server neither accepts nor rejects must not hold the boot
        # open; the per-probe timeout turns it into a plain "no".
        original = live_check._PER_PROBE_TIMEOUT
        live_check._PER_PROBE_TIMEOUT = 0.05
        try:
            result = self._probe(FakeConnect(hang={"affective"}))
        finally:
            live_check._PER_PROBE_TIMEOUT = original
        self.assertFalse(result.affective_dialog)
        self.assertTrue(result.proactive_audio)
        self.assertTrue(result.probed)


if __name__ == "__main__":
    unittest.main()
