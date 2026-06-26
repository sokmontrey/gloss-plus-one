#!/usr/bin/env python

import os
import re

MAKEFILE_PATH = os.path.join('.', 'Makefile')

DOCUMENTATION_RX = r'^([\w-]+):.*?##\s*(?:@(\w+))?\s*(.*)$'

print('Usage: make [TARGET]')

categories_and_targets = {}

with open(MAKEFILE_PATH, 'r') as file:
    for line in file:
        match = re.match(DOCUMENTATION_RX, line)
        if match:
            category_name = match.groups()[1]
            target = match.groups()[0]
            description = match.groups()[2]

            if category_name not in categories_and_targets: categories_and_targets[category_name] = []
            categories_and_targets[category_name].append((target, description))

categories_and_targets = dict(sorted(categories_and_targets.items(), key=lambda i: i[0]))  # sort the dictionary

for category_name, targets in categories_and_targets.items():
    print(f'\n{category_name}:')
    for name, description in targets:
        padding = 20 - len(name)
        print(f'  {name}{padding * ' '}{description}')

print()