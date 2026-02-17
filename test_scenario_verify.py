import unittest
from timer_engine import TimerEngine, CostTier
import math

class TestMultiTier(unittest.TestCase):
    def setUp(self):
        self.engine = TimerEngine()
        self.engine.max_cost = 9999
        self.engine.tiers = [
            CostTier(0, 10.0, 5, "min"),       # Tier 1: 0+ min, $10/min
            CostTier(2, 20.0, 5, "min")        # Tier 2: 2+ min, $20/min
        ]

    def calculate_final(self, seconds):
        # Emulate stop logic
        # 1. Round up total seconds to next minute
        minutes = math.ceil(seconds / 60.0)
        rounded_seconds = minutes * 60.0
        
        # 2. Compute cost
        return self.engine._compute_cost(rounded_seconds), rounded_seconds

    def test_scenario_2m10s(self):
        # 2m 10s (130s).
        # Expect round up to 3m (180s).
        # Tier 1 (0-2m): 2m * 10 = 20
        # Tier 2 (2-3m): 1m * 20 = 20
        # Total: 40
        cost, time_used = self.calculate_final(130)
        print(f"Time: 2m 10s -> Rounded: {time_used}s -> Cost: ${cost}")
        self.assertEqual(time_used, 180)
        self.assertEqual(cost, 40.0)

    def test_scenario_3m30s(self):
        # 3m 30s (210s).
        # Expect round up to 4m (240s).
        # Tier 1 (0-2m): 2m * 10 = 20
        # Tier 2 (2-4m): 2m * 20 = 40
        # Total: 60
        cost, time_used = self.calculate_final(210)
        print(f"Time: 3m 30s -> Rounded: {time_used}s -> Cost: ${cost}")
        self.assertEqual(time_used, 240)
        self.assertEqual(cost, 60.0)

if __name__ == '__main__':
    unittest.main()
