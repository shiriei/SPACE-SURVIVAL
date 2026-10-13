import argparse
import json
import random
import sys
from pathlib import Path


MAX_HULL = 100
MAX_ENERGY = 100
HIGH_SCORE_FILE = Path(__file__).with_name("high_score.json")

EVENTS = ("asteroid", "drone", "energy", "pod", "storm", "quiet")
EVENT_NAMES = {
    "asteroid": "Asteroid collision",
    "drone": "Hostile drone",
    "energy": "Energy discovery",
    "pod": "Abandoned supply pod",
    "storm": "Solar storm",
    "quiet": "Quiet space",
}
EVENT_MESSAGES = {
    "asteroid": (
        "Rubble spins across the flight path!",
        "A fractured asteroid tumbles toward the ship!",
        "The navigation array flags a fast-moving rock field!",
    ),
    "drone": (
        "A hostile drone locks onto your ship!",
        "Unidentified drone signatures approach from the dark!",
        "A hostile drone cuts across your path!",
    ),
    "energy": (
        "A drifting energy cell blinks on the scanner!",
        "The sensors find a pocket of charged particles!",
        "A dormant power cell floats within reach!",
    ),
    "pod": (
        "An abandoned supply pod slowly tumbles into view!",
        "The scanner picks up a sealed cargo pod nearby!",
        "A distress beacon leads to an untouched supply pod!",
    ),
    "storm": (
        "A solar storm surges across the shields!",
        "Charged particles ripple through the surrounding space!",
        "A burst of stellar radiation bears down on the ship!",
    ),
    "quiet": (
        "For a moment, the stars are still.",
        "The sensors find nothing but open space.",
        "Only the ship's quiet hum breaks the silence.",
    ),
}

ACTION_COSTS = {
    "navigate": 3,
    "fire": 10,
    "shield": 12,
    "repair": 15,
    "scan": 4,
}


def new_game():
    return {
        "hull": MAX_HULL,
        "energy": MAX_ENERGY,
        "score": 0,
        "turns": 0,
        "events": {event: 0 for event in EVENTS},
    }


def change_resource(state, resource, amount):
    maximum = MAX_HULL if resource == "hull" else MAX_ENERGY
    state[resource] = max(0, min(maximum, state[resource] + amount))
    return state[resource]


def event_weights(turn_number):
    difficulty = min(10, max(0, (turn_number - 1) // 5))
    return (
        22 + 0.7 * difficulty,
        17 + 0.5 * difficulty,
        14,
        12,
        10 + 0.3 * difficulty,
        25 - 1.5 * difficulty,
    )


def choose_event(turn_number, rng):
    return rng.choices(EVENTS, weights=event_weights(turn_number), k=1)[0]


def load_high_score(save_path=HIGH_SCORE_FILE):
    try:
        data = json.loads(Path(save_path).read_text(encoding="utf-8"))
        score = data.get("high_score", 0) if isinstance(data, dict) else 0
        if isinstance(score, bool) or not isinstance(score, int) or score < 0:
            return 0
        return score
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, AttributeError):
        return 0


def save_high_score(score, save_path=HIGH_SCORE_FILE):
    try:
        Path(save_path).write_text(
            json.dumps({"high_score": max(0, int(score)), "version": 1}, indent=2) + "\n",
            encoding="utf-8",
        )
        return True
    except (OSError, TypeError, ValueError):
        return False


def damage_hull(state, amount, action, rng, messages):
    if action == "navigate":
        if rng.random() < 0.65:
            messages.append("You slip past the worst of the impact without a scratch.")
            return
        amount = max(1, (amount + 1) // 2)
        messages.append("Your evasive course helps, but debris still gets through.")
    elif action == "shield":
        amount = max(1, (amount + 3) // 4)
        messages.append("Your shields absorb most of the strike.")
    elif action == "scan":
        amount = max(1, (amount + 1) // 2)
        messages.append("The scan gives you just enough warning to soften the hit.")

    change_resource(state, "hull", -amount)
    messages.append(f"Hull takes {amount} damage.")


def apply_turn(state, action, event, rng):
    if action not in ACTION_COSTS or event not in EVENTS:
        return False, ["That action is not available."]
    if action == "fire" and event != "drone":
        return False, ["No hostile drone is in range. Choose another action."]
    if action == "repair" and state["hull"] == MAX_HULL:
        return False, ["Hull integrity is already full; repair would be wasted."]

    cost = ACTION_COSTS[action]
    if state["energy"] < cost:
        return False, [f"Not enough energy. {action.title()} requires {cost}."]

    change_resource(state, "energy", -cost)
    messages = []
    difficulty = min(10, state["turns"] // 5)
    drone_defeated = False

    if action == "navigate":
        state["score"] += 2
        messages.append("You plot a careful route through the field. +2 points.")
    elif action == "fire":
        hit_chance = max(0.45, 0.82 - difficulty * 0.035)
        if rng.random() < hit_chance:
            drone_defeated = True
            state["score"] += 35
            messages.append("Weapons hot. The drone breaks apart in a flash of light! +35 points.")
        else:
            messages.append("Your shots miss. The drone returns fire!")
    elif action == "shield":
        messages.append("Shields raised. Incoming damage will be reduced this turn.")
    elif action == "repair":
        before = state["hull"]
        change_resource(state, "hull", 25)
        messages.append(f"Repair crew restores {state['hull'] - before} hull.")
    elif action == "scan":
        discovery = rng.choice(("energy", "hull", "score"))
        if discovery == "energy" or (discovery == "hull" and state["hull"] == MAX_HULL):
            before = state["energy"]
            change_resource(state, "energy", 12)
            messages.append(f"Scan finds an energy cache. +{state['energy'] - before} energy.")
        elif discovery == "hull":
            before = state["hull"]
            change_resource(state, "hull", 10)
            messages.append(f"Scan finds repair materials. +{state['hull'] - before} hull.")
        else:
            state["score"] += 15
            messages.append("Scan maps a threat vector and tactical data. +15 points.")

    state["turns"] += 1
    state["score"] += 10
    state["events"][event] += 1

    if event == "asteroid":
        damage_hull(state, 10 + difficulty * 2, action, rng, messages)
    elif event == "drone":
        if not drone_defeated:
            damage_hull(state, 12 + difficulty * 2, action, rng, messages)
    elif event == "energy":
        before = state["energy"]
        change_resource(state, "energy", 16)
        state["score"] += 10
        messages.append(f"You recover {state['energy'] - before} energy from the drifting cache. +10 points.")
    elif event == "pod":
        reward = rng.choice(("energy", "hull"))
        resource = "energy" if reward == "energy" else "hull"
        before = state[resource]
        change_resource(state, resource, 14 if reward == "energy" else 12)
        state["score"] += 15
        messages.append(f"The pod yields {state[resource] - before} {resource} and valuable supplies. +15 points.")
    elif event == "storm":
        energy_loss = 8 + difficulty
        if action == "shield":
            energy_loss = (energy_loss + 1) // 2
        change_resource(state, "energy", -energy_loss)
        messages.append(f"The solar storm drains {energy_loss} additional energy.")
        damage_hull(state, 8 + difficulty * 2, action, rng, messages)
    elif event == "quiet":
        before = state["energy"]
        change_resource(state, "energy", 7)
        messages.append(f"Quiet space lets the reactor recharge {state['energy'] - before} energy.")

    if state["hull"] == 0:
        messages.append("HULL FAILURE. The ship is lost in the dark.")
    return True, messages


def read_line(prompt_text, input_fn, output_fn):
    output_fn(prompt_text)
    try:
        return input_fn().strip().lower()
    except (EOFError, KeyboardInterrupt):
        return "q"


def read_choice(prompt_text, choices, input_fn, output_fn):
    while True:
        choice = read_line(prompt_text, input_fn, output_fn)
        if choice in choices:
            return choice
        if not choice:
            output_fn("Please enter a choice; blank input is not a selection.")
        else:
            output_fn(f"Invalid choice. Enter one of: {', '.join(choices)}.")


def resource_bar(value, maximum, width=20):
    filled = round(width * value / maximum)
    return "#" * filled + "-" * (width - filled)


def display_dashboard(state, output_fn):
    output_fn(f"TURN {state['turns']:>3}  |  SCORE {state['score']}  |  EVENTS {sum(state['events'].values())}")
    output_fn(f"HULL    [{resource_bar(state['hull'], MAX_HULL)}] {state['hull']:>3}/{MAX_HULL}")
    output_fn(f"ENERGY  [{resource_bar(state['energy'], MAX_ENERGY)}] {state['energy']:>3}/{MAX_ENERGY}")


def display_title(output_fn, high_score):
    output_fn("+----------------------------------------------------------+")
    output_fn("|                                                          |")
    output_fn("|       S P A C E       S U R V I V A L                    |")
    output_fn("|                                                          |")
    output_fn("+----------------------------------------------------------+")
    output_fn("Your ship is stranded beyond the last mapped star.")
    output_fn("Every turn is a choice. Every resource is a lifeline.")
    output_fn(f"LOCAL RECORD: {high_score} points")


def display_instructions(output_fn):
    output_fn("\nMISSION BRIEFING")
    output_fn("Survive for as many turns as you can. Each turn brings a random space event.")
    output_fn("Your hull must stay above zero. Energy powers actions and never exceeds 100.")
    output_fn("1 Navigate (3 energy): earn 2 points and try to evade hazards.")
    output_fn("2 Fire (10 energy): available during a hostile drone encounter; a hit earns 35 points.")
    output_fn("3 Shield (12 energy): reduce incoming hull damage this turn.")
    output_fn("4 Repair (15 energy): restore up to 25 hull; cannot repair a full hull.")
    output_fn("5 Scan (4 energy): find energy, repair materials, or points; soften hazards.")
    output_fn("Survive turns for points. Discoveries add points; hazards grow more dangerous over time.")
    output_fn("At any action prompt, choose 6 to return to the menu or q to quit.")


def play_run(input_fn, output_fn, rng):
    state = new_game()
    output_fn("\nSYSTEMS ONLINE. Hull and energy at 100%. Good luck, pilot.\n")
    display_dashboard(state, output_fn)

    while state["hull"] > 0:
        event = choose_event(state["turns"] + 1, rng)
        output_fn(f"\nINCOMING: {rng.choice(EVENT_MESSAGES[event])}")
        output_fn("1. Navigate (3 energy)   2. Fire (10 energy, drone only)")
        output_fn("3. Raise shields (12)    4. Repair (15)")
        output_fn("5. Scan (4 energy)       6. Return to main menu   q. Quit")

        while True:
            choice = read_choice("Action: ", ("1", "2", "3", "4", "5", "6", "q"), input_fn, output_fn)
            if choice == "6":
                return state, "RETURNED TO MENU"
            if choice == "q":
                return state, "QUIT"
            action = {"1": "navigate", "2": "fire", "3": "shield", "4": "repair", "5": "scan"}[choice]
            completed, messages = apply_turn(state, action, event, rng)
            for message in messages:
                output_fn(message)
            if completed:
                break

        display_dashboard(state, output_fn)
        milestones = {5, 10, 20, 30, 50, 75, 100}
        if state["turns"] in milestones:
            output_fn(f"MILESTONE: {state['turns']} turns survived. The ship keeps moving!")
        if state["hull"] == 0:
            return state, "DESTROYED"

    return state, "DESTROYED"


def display_summary(state, status, output_fn):
    output_fn("\n+---------------- RUN SUMMARY ----------------+")
    output_fn(f"Final status: {status}")
    output_fn(f"Score: {state['score']}")
    output_fn(f"Turns survived: {state['turns']}")
    output_fn(f"Hull: {state['hull']}/{MAX_HULL}  |  Energy: {state['energy']}/{MAX_ENERGY}")
    output_fn("Events encountered:")
    encountered = [f"  {EVENT_NAMES[event]}: {count}" for event, count in state["events"].items() if count]
    if encountered:
        for line in encountered:
            output_fn(line)
    else:
        output_fn("  None")
    output_fn("+---------------------------------------------+")


def finish_run(state, status, save_path, output_fn):
    display_summary(state, status, output_fn)
    high_score = load_high_score(save_path)
    if state["score"] > high_score:
        if save_high_score(state["score"], save_path):
            output_fn(f"NEW HIGH SCORE: {state['score']} points. Record saved locally.")
        else:
            output_fn("Could not save the high score; check that the folder is writable.")


def main(seed=None, input_fn=None, output_fn=print, save_path=HIGH_SCORE_FILE):
    if input_fn is None:
        input_fn = input
    rng = random.Random(seed)

    while True:
        display_title(output_fn, load_high_score(save_path))
        output_fn("\n1. Start a new run")
        output_fn("2. Instructions")
        output_fn("3. High score")
        output_fn("4. Quit")
        choice = read_choice("Select: ", ("1", "2", "3", "4", "q"), input_fn, output_fn)

        if choice in ("4", "q"):
            output_fn("Safe travels, pilot.")
            return
        if choice == "2":
            display_instructions(output_fn)
            read_line("Press Enter to return to the menu.", input_fn, output_fn)
        elif choice == "3":
            output_fn(f"\nBEST FLIGHT: {load_high_score(save_path)} points")
            read_line("Press Enter to return to the menu.", input_fn, output_fn)
        elif choice == "1":
            while True:
                state, status = play_run(input_fn, output_fn, rng)
                finish_run(state, status, save_path, output_fn)
                if status == "QUIT":
                    return
                if status != "DESTROYED":
                    break
                replay = read_choice("Launch another run? [y/n]: ", ("y", "n", "q"), input_fn, output_fn)
                if replay != "y":
                    break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Play SPACE SURVIVAL in your terminal.")
    parser.add_argument("--seed", type=int, help="use a fixed random seed for a repeatable run")
    arguments = parser.parse_args()
    main(seed=arguments.seed)