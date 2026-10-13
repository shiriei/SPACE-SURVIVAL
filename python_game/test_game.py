import json
import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import game


class FixedRandom:
    def __init__(self, value=0.0):
        self.value = value

    def random(self):
        return self.value

    def choice(self, choices):
        return choices[0]


class GameTests(unittest.TestCase):
    def setUp(self):
        self.state = game.new_game()

    def test_new_game_starts_with_full_resources_and_fresh_events(self):
        self.assertEqual(self.state["hull"], 100)
        self.assertEqual(self.state["energy"], 100)
        self.assertEqual(self.state["score"], 0)
        self.assertEqual(self.state["turns"], 0)
        self.assertTrue(all(count == 0 for count in self.state["events"].values()))

    def test_repair_cost_and_hull_restore_are_capped(self):
        self.state["hull"] = 90
        self.state["energy"] = 50
        completed, messages = game.apply_turn(self.state, "repair", "quiet", FixedRandom())
        self.assertTrue(completed)
        self.assertEqual(self.state["hull"], 100)
        self.assertEqual(self.state["energy"], 42)
        self.assertTrue(any("restores 10 hull" in message for message in messages))

    def test_repair_requires_damage_and_energy(self):
        completed, _ = game.apply_turn(self.state, "repair", "quiet", FixedRandom())
        self.assertFalse(completed)
        self.assertEqual(self.state["turns"], 0)

        self.state["hull"] = 50
        self.state["energy"] = 14
        completed, _ = game.apply_turn(self.state, "repair", "quiet", FixedRandom())
        self.assertFalse(completed)
        self.assertEqual(self.state["hull"], 50)
        self.assertEqual(self.state["energy"], 14)

    def test_shield_cost_reduces_damage_and_rejects_low_energy(self):
        self.state["energy"] = 11
        completed, _ = game.apply_turn(self.state, "shield", "asteroid", FixedRandom())
        self.assertFalse(completed)
        self.assertEqual(self.state["hull"], 100)

        self.state["energy"] = 12
        completed, _ = game.apply_turn(self.state, "shield", "asteroid", FixedRandom())
        self.assertTrue(completed)
        self.assertEqual(self.state["energy"], 0)
        self.assertEqual(self.state["hull"], 97)

    def test_firing_at_a_drone_awards_points_and_spends_energy(self):
        completed, _ = game.apply_turn(self.state, "fire", "drone", FixedRandom())
        self.assertTrue(completed)
        self.assertEqual(self.state["energy"], 90)
        self.assertEqual(self.state["hull"], 100)
        self.assertEqual(self.state["score"], 45)
        self.assertEqual(self.state["events"]["drone"], 1)

    def test_firing_without_a_drone_does_not_consume_a_turn_or_energy(self):
        completed, _ = game.apply_turn(self.state, "fire", "quiet", FixedRandom())
        self.assertFalse(completed)
        self.assertEqual(self.state["energy"], 100)
        self.assertEqual(self.state["turns"], 0)

    def test_scan_finds_resources_and_softens_hazard_damage(self):
        self.state["energy"] = 50
        completed, messages = game.apply_turn(self.state, "scan", "asteroid", FixedRandom())
        self.assertTrue(completed)
        self.assertEqual(self.state["energy"], 58)
        self.assertEqual(self.state["hull"], 95)
        self.assertTrue(any("energy cache" in message for message in messages))

    def test_energy_and_hull_are_clamped_to_their_limits(self):
        self.state["energy"] = 99
        game.apply_turn(self.state, "navigate", "energy", FixedRandom())
        self.assertEqual(self.state["energy"], 100)

        self.state["hull"] = 99
        game.change_resource(self.state, "hull", 100)
        game.change_resource(self.state, "hull", -1000)
        self.assertEqual(self.state["hull"], 0)

    def test_hull_reaching_zero_ends_the_run(self):
        self.state["hull"] = 1
        completed, messages = game.apply_turn(self.state, "navigate", "storm", FixedRandom(0.99))
        self.assertTrue(completed)
        self.assertEqual(self.state["hull"], 0)
        self.assertTrue(any("HULL FAILURE" in message for message in messages))

    def test_new_game_resets_run_state(self):
        self.state["score"] = 250
        self.state["turns"] = 12
        fresh_state = game.new_game()
        self.assertEqual(fresh_state["score"], 0)
        self.assertEqual(fresh_state["turns"], 0)
        self.assertEqual(fresh_state["hull"], game.MAX_HULL)
        self.assertEqual(fresh_state["energy"], game.MAX_ENERGY)
        self.assertTrue(all(count == 0 for count in fresh_state["events"].values()))

    def test_difficulty_increases_hazard_weights(self):
        early_weights = game.event_weights(1)
        later_weights = game.event_weights(31)
        self.assertGreater(later_weights[0], early_weights[0])
        self.assertGreater(later_weights[1], early_weights[1])
        self.assertLess(later_weights[-1], early_weights[-1])

    def test_seeded_event_selection_is_repeatable(self):
        first = [game.choose_event(turn, random.Random(42)) for turn in range(1, 8)]
        second = [game.choose_event(turn, random.Random(42)) for turn in range(1, 8)]
        self.assertEqual(first, second)

    def test_high_score_load_save_and_invalid_files(self):
        with tempfile.TemporaryDirectory() as directory:
            save_path = Path(directory) / "high_score.json"
            self.assertEqual(game.load_high_score(save_path), 0)
            self.assertTrue(game.save_high_score(125, save_path))
            self.assertEqual(game.load_high_score(save_path), 125)
            self.assertEqual(json.loads(save_path.read_text()), {"high_score": 125, "version": 1})

            save_path.write_text("not json")
            self.assertEqual(game.load_high_score(save_path), 0)
            save_path.write_text("")
            self.assertEqual(game.load_high_score(save_path), 0)
            save_path.write_text('{"high_score": -4}')
            self.assertEqual(game.load_high_score(save_path), 0)

    def test_menu_handles_invalid_input_and_returns_from_screens(self):
        answers = iter(("unexpected", "", "2", "", "3", "", "4"))
        output = []
        with tempfile.TemporaryDirectory() as directory:
            game.main(
                input_fn=lambda: next(answers),
                output_fn=output.append,
                save_path=Path(directory) / "high_score.json",
            )

        transcript = "\n".join(output)
        self.assertIn("Invalid choice", transcript)
        self.assertIn("blank input is not a selection", transcript)
        self.assertIn("MISSION BRIEFING", transcript)
        self.assertIn("LOCAL RECORD: 0 points", transcript)
        self.assertIn("BEST FLIGHT: 0 points", transcript)
        self.assertIn("Safe travels, pilot.", transcript)

    def test_game_over_offers_a_fresh_replay(self):
        answers = iter(("1", "y", "4"))
        output = []
        runs = []

        def play_once(input_fn, output_fn, rng):
            state = game.new_game()
            runs.append(state)
            status = "DESTROYED" if len(runs) == 1 else "RETURNED TO MENU"
            return state, status

        with tempfile.TemporaryDirectory() as directory:
            with patch("game.play_run", side_effect=play_once):
                game.main(
                    input_fn=lambda: next(answers),
                    output_fn=output.append,
                    save_path=Path(directory) / "high_score.json",
                )

        self.assertEqual(len(runs), 2)
        self.assertIsNot(runs[0], runs[1])
        self.assertIn("Launch another run? [y/n]", "\n".join(output))


if __name__ == "__main__":
    unittest.main()