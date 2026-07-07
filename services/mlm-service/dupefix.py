# simulated data
text = "This is a full text"
tups = [(0, 5), (5, 6), (6, 15)]  # y
rates = {"we": 0.8, "'re": 0.6, " ": -1, "something": 0.1}  # x
hash = {}

"""
score:  0.7
units:  ['we', "'re"]
score:  0.1
units:  ['something']
"""
from chunker import chunk_text

print(chunk_text(text))


# make function return in prop format
def rateUnits(range, score):
    print("text: ", text)
    print("tups: ", tups)
    print("rates: ", rates)
    print("\n")
    for y in range:  # this loop goes through the spans arr
        span = y[1] - y[0]
        running_total = 0
        unit_scores = []
        units = []
        for x in score:  # this loop goes through the units(rates) arr
            if score[x] < 0 or x in hash:
                continue
            if (
                running_total + len(x) <= span
            ):  # the "):" at the start of this line looks like a sad face
                # TODO: there must be a better way to do this
                running_total += len(x)
                unit_scores.append(score[x])
                units.append(x)
                hash[x] = True
            else:
                continue

        if unit_scores:
            print("score: ", sum(unit_scores) / len(unit_scores))
            print("units: ", units)

        hash.clear()


# rateUnits(tups, rates)
