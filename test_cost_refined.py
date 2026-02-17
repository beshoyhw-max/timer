import unittest
from timer_engine import TimerEngine, CostTier, Phase
import time

class TestCostRefined(unittest.TestCase):
    def setUp(self):
        self.engine = TimerEngine()
        self.engine.max_cost = 9999
        self.engine.tiers = [
            CostTier(0, 10.0, 5, "min"),      # 0-30s
            CostTier(0.5, 10.0, 5, "min")     # 30s+
        ]
        
    def test_proportional_calculation_bugfix(self):
        # 1:51 (111s)
        # Old 'buggy' logic gave ceil(30s)=$10 + ceil(81s)=$20 -> $30.
        # Strict proportional:
        # Tier 1 (30s): 0.5 * 10 = $5
        # Tier 2 (81s): 1.35 * 10 = $13.5
        # Total = $18.5
        cost = self.engine._compute_cost(111)
        self.assertAlmostEqual(cost, 18.5)
        print("Proportional cost for 1:51 is $18.50 (Correct)")

    def test_stop_logic_rounding(self):
        # 1:51 (111s) -> Round to 2:00 (120s) because current tier is MIN.
        # Cost for 120s:
        # Tier 1 (30s): 0.5 * 10 = 5
        # Tier 2 (90s): 1.5 * 10 = 15
        # Total = 20
        
        # Simulate state manually for stop logic
        # We can't easily mock time.time in internal method without refactor, 
        # but we can call _compute_cost with 120 directly to verify the MATH first.
        cost_rounded = self.engine._compute_cost(120)
        self.assertEqual(cost_rounded, 20.0)
        print("Rounded cost for 2:00 is $20.00 (Correct)")

if __name__ == '__main__':
    unittest.main()
