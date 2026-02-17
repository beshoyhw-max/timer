import unittest
from timer_engine import TimerEngine, CostTier

class TestCostCalculation(unittest.TestCase):
    def setUp(self):
        self.engine = TimerEngine()
        self.engine.max_cost = 9999

    def test_sec_unit_cost(self):
        # Tier: >0 min, rate 5 per 5 sec (default)
        # Unit: sec
        self.engine.tiers = [CostTier(0, 5.0, 5, "sec")]
        
        # 10 seconds overtime -> 2 ticks * 5 = 10
        cost = self.engine._compute_cost(10)
        self.assertEqual(cost, 10.0)

        # 12 seconds overtime -> 2.4 ticks * 5 = 12
        cost = self.engine._compute_cost(12)
        self.assertEqual(cost, 12.0)

    def test_min_unit_cost_partial(self):
        # Tier: >0 min, rate 10 per min
        # Unit: min
        self.engine.tiers = [CostTier(0, 10.0, 5, "min")]
        
        # 1 second overtime -> 1 min -> 10
        cost = self.engine._compute_cost(1)
        self.assertEqual(cost, 10.0)

        # 30 seconds overtime -> 1 min -> 10
        cost = self.engine._compute_cost(30)
        self.assertEqual(cost, 10.0)

        # 60 seconds overtime -> 1 min -> 10
        cost = self.engine._compute_cost(60)
        self.assertEqual(cost, 10.0)

    def test_min_unit_cost_over_one_min(self):
        # Tier: >0 min, rate 10 per min
        # Unit: min
        self.engine.tiers = [CostTier(0, 10.0, 5, "min")]
        
        # 61 seconds overtime -> 2 mins -> 20
        cost = self.engine._compute_cost(61)
        self.assertEqual(cost, 20.0)

        # 92 seconds (1m 32s) -> 2 mins -> 20 (User's example)
        cost = self.engine._compute_cost(92)
        self.assertEqual(cost, 20.0)

    def test_mixed_tiers(self):
        # Tier 1: 0-1 min, 5/sec (rate 1 per 1 sec)
        # Tier 2: >1 min, 10/min (unit min)
        self.engine.tiers = [
            CostTier(0, 1.0, 1, "sec"),
            CostTier(1, 10.0, 1, "min")
        ]
        
        # 30s overtime -> Tier 1 only -> 30 * 1 = 30
        cost = self.engine._compute_cost(30)
        self.assertEqual(cost, 30.0)

        # 90s overtime -> 
        # Tier 1 (first 60s) -> 60 * 1 = 60
        # Tier 2 (next 30s) -> ceil(30/60) = 1 min -> 1 * 10 = 10
        # Total = 70
        cost = self.engine._compute_cost(90)
        self.assertEqual(cost, 70.0)

if __name__ == '__main__':
    unittest.main()
