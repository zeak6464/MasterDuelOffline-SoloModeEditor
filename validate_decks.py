import json
import os
import glob

# Read YdkIds.txt and get valid IDs (second column)
valid_ids = set()
with open('YdkIds.txt', 'r') as f:
    for line in f:
        parts = line.strip().split()
        if len(parts) >= 2:
            valid_ids.add(int(parts[1]))

# Process all deck files
deck_dir = 'Players/Local/Decks'
deck_files = glob.glob(os.path.join(deck_dir, '*.json'))

fixed_decks = 0
removed_cards = {}

for deck_file in deck_files:
    deck_name = os.path.basename(deck_file)
    with open(deck_file, 'r') as f:
        try:
            deck_data = json.load(f)
            deck_modified = False
            removed_in_deck = []
            
            # Filter main deck
            if 'm' in deck_data and 'ids' in deck_data['m']:
                original_ids = deck_data['m']['ids']
                valid_main_ids = [card_id for card_id in original_ids if card_id in valid_ids]
                removed_ids = [card_id for card_id in original_ids if card_id not in valid_ids]
                if len(valid_main_ids) != len(original_ids):
                    deck_data['m']['ids'] = valid_main_ids
                    deck_modified = True
                    removed_in_deck.extend(removed_ids)
            
            # Filter extra deck
            if 'e' in deck_data and 'ids' in deck_data['e']:
                original_ids = deck_data['e']['ids']
                valid_extra_ids = [card_id for card_id in original_ids if card_id in valid_ids]
                removed_ids = [card_id for card_id in original_ids if card_id not in valid_ids]
                if len(valid_extra_ids) != len(original_ids):
                    deck_data['e']['ids'] = valid_extra_ids
                    deck_modified = True
                    removed_in_deck.extend(removed_ids)
            
            # Filter side deck
            if 's' in deck_data and 'ids' in deck_data['s']:
                original_ids = deck_data['s']['ids']
                valid_side_ids = [card_id for card_id in original_ids if card_id in valid_ids]
                removed_ids = [card_id for card_id in original_ids if card_id not in valid_ids]
                if len(valid_side_ids) != len(original_ids):
                    deck_data['s']['ids'] = valid_side_ids
                    deck_modified = True
                    removed_in_deck.extend(removed_ids)
            
            # Save modified deck
            if deck_modified:
                with open(deck_file, 'w') as f:
                    json.dump(deck_data, f)
                fixed_decks += 1
                removed_cards[deck_name] = removed_in_deck
                
        except json.JSONDecodeError:
            print(f"Error reading deck file: {deck_file}")
            continue

# Print results
if removed_cards:
    print(f"\nFixed {fixed_decks} decks by removing invalid cards:")
    for deck_name, cards in removed_cards.items():
        print(f"\n{deck_name}:")
        print(f"Removed card IDs: {cards}")
else:
    print("\nAll cards in all decks were already valid!") 