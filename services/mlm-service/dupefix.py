# simulated data
text = "we're something"
tups = [(0, 5), (5, 6), (6, 15)]  # y
rates = {"we": 0.8, "'re": 0.6, " ": -1, "something": 0.1}  # x
hash = {}


def rateUnits(range, score):
    print("text: ", text)
    print("tups: ", tups)
    print("rates: ", rates)
    print("\n")
    for y in range:
        # print(y[1] - y[0])

        span = y[1] - y[0]
        # print("span refresh")
        running_total = 0
        unit_scores = []
        units = []
        for x in score:
            if score[x] < 0 or x in hash:
                continue
            if running_total + len(x) <= span:
                # print("running", running_total, unit_scores)
                running_total += len(x)
                unit_scores.append(score[x])
                units.append(x)
                hash[x] = True
            else:
                continue
        # print("final", running_total, unit_scores)
        if unit_scores:
            print("score: ", sum(unit_scores) / len(unit_scores))
            print("units: ", units)


rateUnits(tups, rates)
