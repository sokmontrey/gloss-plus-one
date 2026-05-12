-- ============================================================
-- Seed data for preset_lexicons: French (fr) common lexicons
-- ~350 unique entries: ~180 functional + ~170 content words
--
-- initial_progression_score (0.0–1.0):
--   How easily an English speaker with ZERO French knowledge
--   can guess the meaning from the word's appearance alone.
--   0.0  = completely opaque, no visual clue
--   0.5  = moderate, partially recognizable
--   1.0  = identical spelling + same meaning in English
--
-- Scoring rubric:
--   FUNCTIONAL words tend 0.0–0.15  (rarely cognate with English)
--   CONTENT words tend 0.0–0.95     (nouns/adjectives often cognate)
-- ============================================================

-- FUNCTIONAL WORDS (~180)

INSERT INTO public.preset_lexicons (language_code, preset_type, initial_progression_score, value) VALUES

-- DETERMINERS (46)
('fr', 'functional', 0.0,  'le'),
('fr', 'functional', 0.0,  'la'),
('fr', 'functional', 0.0,  'les'),
('fr', 'functional', 0.0,  'un'),
('fr', 'functional', 0.0,  'une'),
('fr', 'functional', 0.0,  'des'),
('fr', 'functional', 0.0,  'du'),
('fr', 'functional', 0.0,  'au'),
('fr', 'functional', 0.0,  'aux'),
('fr', 'functional', 0.0,  'ce'),
('fr', 'functional', 0.0,  'cet'),
('fr', 'functional', 0.0,  'cette'),
('fr', 'functional', 0.0,  'ces'),
('fr', 'functional', 0.0,  'mon'),
('fr', 'functional', 0.0,  'ton'),
('fr', 'functional', 0.0,  'son'),
('fr', 'functional', 0.0,  'ma'),
('fr', 'functional', 0.0,  'ta'),
('fr', 'functional', 0.0,  'sa'),
('fr', 'functional', 0.0,  'mes'),
('fr', 'functional', 0.0,  'tes'),
('fr', 'functional', 0.0,  'ses'),
('fr', 'functional', 0.0,  'notre'),
('fr', 'functional', 0.02, 'votre'),     -- vague v- resemblance to "your"
('fr', 'functional', 0.0,  'leur'),
('fr', 'functional', 0.0,  'nos'),
('fr', 'functional', 0.0,  'vos'),
('fr', 'functional', 0.0,  'leurs'),
('fr', 'functional', 0.0,  'quel'),
('fr', 'functional', 0.0,  'quelle'),
('fr', 'functional', 0.0,  'quels'),
('fr', 'functional', 0.0,  'quelles'),
('fr', 'functional', 0.02, 'tout'),      -- faint echo of "total"
('fr', 'functional', 0.0,  'toute'),
('fr', 'functional', 0.0,  'tous'),
('fr', 'functional', 0.0,  'toutes'),
('fr', 'functional', 0.0,  'chaque'),
('fr', 'functional', 0.05, 'même'),      -- vaguely like "same"
('fr', 'functional', 0.1,  'autre'),     -- a-u-t-r-e vs o-t-h-e-r
('fr', 'functional', 0.0,  'quelques'),
('fr', 'functional', 0.05, 'plusieurs'), -- "plural" faintly visible
('fr', 'functional', 0.0,  'aucun'),
('fr', 'functional', 0.0,  'aucune'),
('fr', 'functional', 0.5,  'certain'),   -- identical to English "certain"
('fr', 'functional', 0.45, 'certaine'),

-- PERSONAL PRONOUNS (18)
('fr', 'functional', 0.0,  'je'),
('fr', 'functional', 0.0,  'tu'),
('fr', 'functional', 0.0,  'il'),
('fr', 'functional', 0.0,  'elle'),
('fr', 'functional', 0.0,  'nous'),
('fr', 'functional', 0.0,  'vous'),
('fr', 'functional', 0.0,  'ils'),
('fr', 'functional', 0.0,  'elles'),
('fr', 'functional', 0.05, 'on'),        -- looks like English "on" but means "one/we"
('fr', 'functional', 0.0,  'se'),
('fr', 'functional', 0.0,  'me'),
('fr', 'functional', 0.0,  'te'),
('fr', 'functional', 0.0,  'lui'),
('fr', 'functional', 0.0,  'y'),
('fr', 'functional', 0.02, 'en'),        -- faint echo of "in"
('fr', 'functional', 0.0,  'moi'),
('fr', 'functional', 0.0,  'toi'),
('fr', 'functional', 0.0,  'soi'),

-- RELATIVE / INTERROGATIVE PRONOUNS (10)
('fr', 'functional', 0.0,  'qui'),
('fr', 'functional', 0.0,  'que'),
('fr', 'functional', 0.0,  'quoi'),
('fr', 'functional', 0.0,  'dont'),
('fr', 'functional', 0.0,  'lequel'),
('fr', 'functional', 0.0,  'laquelle'),
('fr', 'functional', 0.0,  'lesquels'),
('fr', 'functional', 0.0,  'lesquelles'),
('fr', 'functional', 0.0,  'duquel'),
('fr', 'functional', 0.0,  'auquel'),

-- DEMONSTRATIVE PRONOUNS (7)
('fr', 'functional', 0.0,  'celui'),
('fr', 'functional', 0.0,  'celle'),
('fr', 'functional', 0.0,  'ceux'),
('fr', 'functional', 0.0,  'celles'),
('fr', 'functional', 0.0,  'ceci'),
('fr', 'functional', 0.0,  'cela'),
('fr', 'functional', 0.0,  'ça'),

-- INDEFINITE PRONOUNS (5)
('fr', 'functional', 0.05, 'quelqu''un'),
('fr', 'functional', 0.0,  'personne'),
('fr', 'functional', 0.0,  'rien'),
('fr', 'functional', 0.0,  'chacun'),
('fr', 'functional', 0.0,  'quiconque'),

-- PREPOSITIONS (25)
('fr', 'functional', 0.0,  'de'),
('fr', 'functional', 0.0,  'à'),
('fr', 'functional', 0.02, 'dans'),      -- faint echo of "den" → "in"
('fr', 'functional', 0.05, 'sur'),       -- looks like "sure" → misleading
('fr', 'functional', 0.0,  'avec'),
('fr', 'functional', 0.05, 'pour'),      -- looks like English "pour" → misleading
('fr', 'functional', 0.0,  'par'),
('fr', 'functional', 0.05, 'sans'),      -- "sans-serif" English loan
('fr', 'functional', 0.02, 'sous'),      -- faintly like "south" → wrong
('fr', 'functional', 0.0,  'chez'),
('fr', 'functional', 0.05, 'entre'),     -- "enter" → "between" vague spatial link
('fr', 'functional', 0.0,  'vers'),
('fr', 'functional', 0.1,  'contre'),    -- "contra" → "against" recognizable
('fr', 'functional', 0.0,  'parmi'),
('fr', 'functional', 0.0,  'devant'),
('fr', 'functional', 0.0,  'derrière'),
('fr', 'functional', 0.05, 'avant'),     -- "advance" / "avant-garde" English loan
('fr', 'functional', 0.05, 'après'),     -- "après-ski" English loan → "after"
('fr', 'functional', 0.0,  'depuis'),
('fr', 'functional', 0.05, 'pendant'),   -- "pending" → "during" weak link
('fr', 'functional', 0.02, 'hors'),      -- "hors d'oeuvre" English loan
('fr', 'functional', 0.05, 'selon'),
('fr', 'functional', 0.0,  'malgré'),
('fr', 'functional', 0.0,  'dès'),
('fr', 'functional', 0.3,  'via'),       -- identical to English "via"

-- COORDINATING CONJUNCTIONS (6)
('fr', 'functional', 0.0,  'et'),
('fr', 'functional', 0.0,  'ou'),
('fr', 'functional', 0.02, 'mais'),
('fr', 'functional', 0.0,  'ni'),
('fr', 'functional', 0.05, 'car'),       -- looks like "car" → misleading
('fr', 'functional', 0.0,  'donc'),

-- SUBORDINATING CONJUNCTIONS / COMPLEMENTIZERS (14)
('fr', 'functional', 0.02, 'quand'),     -- qu- might trigger question association
('fr', 'functional', 0.0,  'lorsque'),
('fr', 'functional', 0.05, 'comme'),     -- "comme des garçons" brand → "like/as"
('fr', 'functional', 0.0,  'si'),
('fr', 'functional', 0.0,  'parce que'),
('fr', 'functional', 0.0,  'puisque'),
('fr', 'functional', 0.0,  'bien que'),
('fr', 'functional', 0.0,  'avant que'),
('fr', 'functional', 0.0,  'après que'),
('fr', 'functional', 0.0,  'pour que'),
('fr', 'functional', 0.0,  'sans que'),
('fr', 'functional', 0.0,  'tant que'),
('fr', 'functional', 0.0,  'alors que'),
('fr', 'functional', 0.0,  'pendant que'),

-- CONNECTIVE / TRANSITIONAL ADVERBS (7)
('fr', 'functional', 0.0,  'alors'),
('fr', 'functional', 0.02, 'ainsi'),     -- faintly like "also"
('fr', 'functional', 0.0,  'pourtant'),
('fr', 'functional', 0.0,  'cependant'),
('fr', 'functional', 0.0,  'néanmoins'),
('fr', 'functional', 0.0,  'en revanche'),
('fr', 'functional', 0.0,  'toutefois'),

-- AUXILIARY / MODAL VERBS (10)
('fr', 'functional', 0.0,  'être'),
('fr', 'functional', 0.0,  'avoir'),
('fr', 'functional', 0.02, 'faire'),     -- "fair" → "do/make" very weak
('fr', 'functional', 0.0,  'pouvoir'),
('fr', 'functional', 0.0,  'vouloir'),
('fr', 'functional', 0.05, 'devoir'),    -- "devour" → "must" weak link
('fr', 'functional', 0.02, 'aller'),     -- "alley" → "go" very weak
('fr', 'functional', 0.05, 'savoir'),    -- "savvy" etymological link, not obvious
('fr', 'functional', 0.0,  'venir'),
('fr', 'functional', 0.0,  'falloir'),

-- NEGATION & CORE ADVERBS (27)
('fr', 'functional', 0.0,  'ne'),
('fr', 'functional', 0.02, 'pas'),       -- "pace" → misleading
('fr', 'functional', 0.15, 'plus'),      -- identical to English "plus", partial semantic overlap
('fr', 'functional', 0.02, 'moins'),     -- faintly like "minus"
('fr', 'functional', 0.1,  'non'),       -- recognizable as "no" (common loanword)
('fr', 'functional', 0.0,  'oui'),
('fr', 'functional', 0.05, 'très'),
('fr', 'functional', 0.0,  'trop'),
('fr', 'functional', 0.0,  'assez'),
('fr', 'functional', 0.05, 'aussi'),     -- starts with a-, double letter → vaguely "also"
('fr', 'functional', 0.1,  'encore'),    -- English loanword (performance repeat)
('fr', 'functional', 0.02, 'toujours'),
('fr', 'functional', 0.0,  'jamais'),
('fr', 'functional', 0.05, 'déjà'),      -- "déjà vu" English loan-phrase
('fr', 'functional', 0.0,  'souvent'),
('fr', 'functional', 0.0,  'parfois'),
('fr', 'functional', 0.05, 'bien'),      -- "bon voyage" loan → "well/good"
('fr', 'functional', 0.0,  'mal'),
('fr', 'functional', 0.0,  'vite'),
('fr', 'functional', 0.05, 'peut-être'),
('fr', 'functional', 0.0,  'presque'),
('fr', 'functional', 0.0,  'surtout'),
('fr', 'functional', 0.1,  'environ'),   -- "environment" → "approximately" weak
('fr', 'functional', 0.0,  'beaucoup'),
('fr', 'functional', 0.0,  'peu'),
('fr', 'functional', 0.0,  'tellement'),

-- INTERROGATIVE ADVERBS (4)
('fr', 'functional', 0.15, 'comment'),   -- identical spelling to English "comment" but means "how" — false friend
('fr', 'functional', 0.0,  'pourquoi'),
('fr', 'functional', 0.0,  'combien'),
('fr', 'functional', 0.0,  'où'),

-- DISCOURSE MARKERS (10)
('fr', 'functional', 0.0,  'enfin'),
('fr', 'functional', 0.02, 'voilà'),     -- English loanword "voila!"
('fr', 'functional', 0.0,  'voici'),
('fr', 'functional', 0.0,  'en fait'),
('fr', 'functional', 0.02, 'bref'),      -- "brief" → "in short" weak
('fr', 'functional', 0.0,  'par contre'),
('fr', 'functional', 0.0,  'au fait'),
('fr', 'functional', 0.0,  'd''ailleurs'),
('fr', 'functional', 0.0,  'en effet'),
('fr', 'functional', 0.0,  'c''est-à-dire');


-- ============================================================
-- CONTENT WORDS (~170)
-- ============================================================

-- HIGH-FREQUENCY NOUNS (70)
INSERT INTO public.preset_lexicons (language_code, preset_type, initial_progression_score, value) VALUES
-- Near-identical / identical to English (0.7–0.95)
('fr', 'content', 0.95, 'question'),
('fr', 'content', 0.95, 'attention'),
('fr', 'content', 0.9,  'important'),
('fr', 'content', 0.9,  'nation'),
('fr', 'content', 0.9,  'nature'),
('fr', 'content', 0.85, 'information'),
('fr', 'content', 0.85, 'position'),
('fr', 'content', 0.85, 'action'),
('fr', 'content', 0.85, 'situation'),
('fr', 'content', 0.85, 'direction'),
('fr', 'content', 0.85, 'relation'),
('fr', 'content', 0.85, 'force'),
('fr', 'content', 0.8,  'condition'),
('fr', 'content', 0.8,  'production'),
('fr', 'content', 0.8,  'place'),
('fr', 'content', 0.8,  'instant'),
('fr', 'content', 0.75, 'président'),    -- accent difference only
('fr', 'content', 0.75, 'organisation'), -- s vs z
('fr', 'content', 0.75, 'opération'),    -- accent difference
('fr', 'content', 0.7,  'gouvernement'), -- longer but recognizable
('fr', 'content', 0.7,  'fonction'),     -- "function" recognizable
('fr', 'content', 0.7,  'national'),     -- identical spelling
('fr', 'content', 0.7,  'social'),       -- identical spelling
('fr', 'content', 0.7,  'public'),       -- identical spelling
('fr', 'content', 0.7,  'centre'),       -- re vs er

-- Strong cognates (0.5–0.69)
('fr', 'content', 0.6,  'base'),         -- identical spelling
('fr', 'content', 0.55, 'système'),      -- è vs e
('fr', 'content', 0.55, 'expérience'),   -- recognizable
('fr', 'content', 0.5,  'décision'),     -- recognizable from "decision"

-- Moderate cognates (0.3–0.49)
('fr', 'content', 0.45, 'problème'),     -- recognizable from "problem"
('fr', 'content', 0.45, 'exemple'),      -- recognizable from "example"
('fr', 'content', 0.4,  'service'),      -- identical spelling, same meaning
('fr', 'content', 0.4,  'développement'),-- recognizable from "development"
('fr', 'content', 0.4,  'résultat'),     -- recognizable from "result"
('fr', 'content', 0.4,  'rapport'),      -- "rapport" English loan
('fr', 'content', 0.35, 'société'),      -- "society" recognizable
('fr', 'content', 0.35, 'moment'),       -- "moment" identical spelling
('fr', 'content', 0.35, 'espace'),       -- "space" partial
('fr', 'content', 0.3,  'liberté'),      -- "liberty" recognizable
('fr', 'content', 0.3,  'nombre'),       -- "number" n-mbr shared root
('fr', 'content', 0.3,  'projet'),       -- "project" recognizable
('fr', 'content', 0.3,  'groupe'),       -- "group" recognizable

-- Weak cognates (0.1–0.29)
('fr', 'content', 0.25, 'accès'),        -- "access" recognizable
('fr', 'content', 0.2,  'ordre'),        -- "order" o-r-d shared
('fr', 'content', 0.2,  'rôle'),         -- "role" English loan from French
('fr', 'content', 0.15, 'point'),        -- identical spelling, same meaning
('fr', 'content', 0.1,  'homme'),        -- "human" h-o-m shared
('fr', 'content', 0.1,  'ville'),        -- "ville" → "village" English loan
('fr', 'content', 0.1,  'raison'),       -- "reason" r- shared
('fr', 'content', 0.1,  'idée'),         -- "idea" i-d shared
('fr', 'content', 0.1,  'retour'),       -- "return" r-t shared
('fr', 'content', 0.1,  'main'),         -- identical spelling, different meaning

-- Very low / no cognate — everyday nouns (0.0–0.09)
('fr', 'content', 0.05, 'temps'),        -- "temp" → no clear link
('fr', 'content', 0.05, 'vie'),          -- "life" → no link
('fr', 'content', 0.05, 'monde'),        -- "world" → no link
('fr', 'content', 0.05, 'peuple'),       -- "people" p-e-u shared root
('fr', 'content', 0.05, 'enfant'),       -- "infant" shared Latin root
('fr', 'content', 0.05, 'corps'),        -- "corpse" shared root
('fr', 'content', 0.05, 'histoire'),     -- "history" h-i-s shared
('fr', 'content', 0.05, 'droit'),        -- "adroit" shared root
('fr', 'content', 0.05, 'cours'),        -- "course" shared root
('fr', 'content', 0.03, 'recherche'),    -- "research" r-e-c shared
('fr', 'content', 0.03, 'marché'),       -- "market" m-a-r shared
('fr', 'content', 0.02, 'femme'),        -- "female" f-e shared
('fr', 'content', 0.02, 'état'),         -- "state" → no visual link
('fr', 'content', 0.01, 'jour'),         -- "journal" shared root
('fr', 'content', 0.01, 'année'),        -- "annual" shared root
('fr', 'content', 0.01, 'maison'),       -- "mansion" shared root
('fr', 'content', 0.01, 'eau'),          -- "water" → no link
('fr', 'content', 0.0,  'pays'),         -- "country" → no link
('fr', 'content', 0.0,  'mot'),          -- "word" → no link
('fr', 'content', 0.0,  'tête'),         -- "head" → no link
('fr', 'content', 0.0,  'chemin'),       -- "path" → no link
('fr', 'content', 0.0,  'rue'),          -- "street" → no link
('fr', 'content', 0.0,  'fenêtre'),      -- "window" → no link
('fr', 'content', 0.0,  'arbre'),        -- "tree" → "arbor" shared root
('fr', 'content', 0.0,  'soleil'),       -- "sun" → no link
('fr', 'content', 0.0,  'lune'),         -- "moon" → "lunar" shared root
('fr', 'content', 0.0,  'terre'),        -- "earth" → "terrestrial" shared root
('fr', 'content', 0.0,  'mer'),          -- "sea" → "mermaid" shared root
('fr', 'content', 0.0,  'feu'),          -- "fire" → no link
('fr', 'content', 0.0,  'vent'),         -- "wind" → "ventilation" shared root
('fr', 'content', 0.0,  'nuit'),         -- "night" → no link
('fr', 'content', 0.0,  'roi'),          -- "king" → "royal" shared root
('fr', 'content', 0.0,  'ami'),          -- "friend" → "amicable" shared root
('fr', 'content', 0.0,  'mère'),         -- "mother" → "maternal" shared root
('fr', 'content', 0.0,  'père'),         -- "father" → "paternal" shared root
('fr', 'content', 0.0,  'fils'),         -- "son" → "filial" shared root
('fr', 'content', 0.0,  'fille'),        -- "daughter" → "filial" shared root
('fr', 'content', 0.0,  'frère'),        -- "brother" → "fraternal" shared root
('fr', 'content', 0.0,  'sœur'),         -- "sister" → "sorority" shared root
('fr', 'content', 0.0,  'mort'),         -- "death" → "mortal" shared root
('fr', 'content', 0.0,  'pain'),         -- "bread" → "pain" false friend
('fr', 'content', 0.0,  'vin'),          -- "wine" → v-i shared
('fr', 'content', 0.0,  'chien'),        -- "dog" → "canine" shared root
('fr', 'content', 0.0,  'chat'),         -- "cat" → "chat" false friend
('fr', 'content', 0.0,  'bois'),         -- "wood" → no link
('fr', 'content', 0.0,  'pierre'),       -- "stone" → "pier" no link
('fr', 'content', 0.0,  'fer'),          -- "iron" → "ferrous" shared root
('fr', 'content', 0.0,  'or'),           -- "gold" → no link
('fr', 'content', 0.0,  'couleur'),      -- "color" → c-o-l shared root
('fr', 'content', 0.0,  'chose'),        -- "thing" → no link
('fr', 'content', 0.0,  'guerre'),       -- "war" → no link
('fr', 'content', 0.0,  'travail'),      -- "work" → "travel" false friend
('fr', 'content', 0.0,  'besoin');       -- "need" → no link


-- CONTENT VERBS — lemmas (35)
INSERT INTO public.preset_lexicons (language_code, preset_type, initial_progression_score, value) VALUES
-- Higher transparency (0.3+)
('fr', 'content', 0.6,  'observer'),     -- "observe" very recognizable
('fr', 'content', 0.5,  'considérer'),   -- "consider" recognizable
('fr', 'content', 0.45, 'présenter'),    -- "present" recognizable
('fr', 'content', 0.45, 'représenter'),  -- "represent" recognizable
('fr', 'content', 0.4,  'exister'),      -- "exist" recognizable
('fr', 'content', 0.35, 'continuer'),    -- "continue" recognizable
('fr', 'content', 0.35, 'développer'),   -- "develop" recognizable
('fr', 'content', 0.3,  'utiliser'),     -- "utilize" recognizable
('fr', 'content', 0.3,  'créer'),        -- "create" cr- shared

-- Moderate transparency (0.1–0.29)
('fr', 'content', 0.25, 'produire'),     -- "produce" prod- shared
('fr', 'content', 0.25, 'permettre'),    -- "permit" perm- shared
('fr', 'content', 0.25, 'comprendre'),   -- "comprehend" comp- shared
('fr', 'content', 0.25, 'constituer'),   -- "constitute" const- shared
('fr', 'content', 0.2,  'recevoir'),     -- "receive" rec- shared
('fr', 'content', 0.2,  'établir'),      -- "establish" shared root
('fr', 'content', 0.2,  'fournir'),      -- "furnish" f-o-u-r shared root
('fr', 'content', 0.15, 'sembler'),      -- "resemble" s-e-m-b shared
('fr', 'content', 0.15, 'descendre'),    -- "descend" d-e-s-c recognizable
('fr', 'content', 0.1,  'porter'),       -- "port" → weak
('fr', 'content', 0.1,  'arriver'),      -- "arrive" recognizable
('fr', 'content', 0.1,  'passer'),       -- "pass" recognizable
('fr', 'content', 0.1,  'tourner'),      -- "turn" t-o-u shared
('fr', 'content', 0.1,  'penser'),       -- "pensive" shared root
('fr', 'content', 0.1,  'entendre'),     -- "intend" false friend
('fr', 'content', 0.1,  'rester'),       -- "rest" false friend

-- Low transparency (0.05–0.09)
('fr', 'content', 0.05, 'donner'),       -- "donate" shared root
('fr', 'content', 0.05, 'voir'),         -- "vision" shared root
('fr', 'content', 0.05, 'trouver'),      -- "find" → no link
('fr', 'content', 0.05, 'parler'),       -- "parlor" weak
('fr', 'content', 0.05, 'écrire'),       -- "scribe" shared root
('fr', 'content', 0.05, 'partir'),       -- "part" misleading
('fr', 'content', 0.05, 'vivre'),        -- "vivid" shared root
('fr', 'content', 0.05, 'suivre'),       -- "suit" shared root

-- Very low / no transparency (0.0–0.04)
('fr', 'content', 0.02, 'lire'),         -- "legible" shared root
('fr', 'content', 0.02, 'mettre'),       -- "mission" shared root
('fr', 'content', 0.02, 'mourir'),       -- "mortal" shared root
('fr', 'content', 0.0,  'dire'),         -- "dictate" shared root
('fr', 'content', 0.0,  'prendre'),      -- "prehend" shared root
('fr', 'content', 0.0,  'connaître'),    -- "cognition" shared root
('fr', 'content', 0.0,  'croire'),       -- "credit" shared root
('fr', 'content', 0.0,  'choisir'),      -- "choice" shared root
('fr', 'content', 0.0,  'appeler'),      -- "appeal" shared root
('fr', 'content', 0.0,  'manger'),       -- "eat" → no link
('fr', 'content', 0.0,  'boire'),        -- "beverage" shared root
('fr', 'content', 0.0,  'dormir'),       -- "dormant" shared root
('fr', 'content', 0.0,  'courir'),       -- "course" shared root
('fr', 'content', 0.0,  'marcher'),      -- "march" false friend
('fr', 'content', 0.0,  'tenir'),        -- "tenant" shared root
('fr', 'content', 0.0,  'ouvrir'),       -- "overt" shared root
('fr', 'content', 0.0,  'fermer'),       -- "firm" shared root
('fr', 'content', 0.0,  'oublier'),      -- "oblivion" shared root
('fr', 'content', 0.0,  'tomber'),       -- "tumble" shared root
('fr', 'content', 0.0,  'monter'),       -- "mount" shared root
('fr', 'content', 0.0,  'naître'),       -- "natal" shared root
('fr', 'content', 0.0,  'joindre'),      -- "join" shared root
('fr', 'content', 0.0,  'détruire'),     -- "destroy" shared root
('fr', 'content', 0.0,  'gagner'),       -- "gain" shared root
('fr', 'content', 0.0,  'perdre'),       -- "lose" → no link
('fr', 'content', 0.0,  'chercher'),     -- "search" → no visual link
('fr', 'content', 0.0,  'attendre');     -- "attend" false friend


-- CONTENT ADJECTIVES (40)
INSERT INTO public.preset_lexicons (language_code, preset_type, initial_progression_score, value) VALUES
-- Near-identical to English (0.5+)
('fr', 'content', 0.7,  'double'),       -- identical spelling, same meaning
('fr', 'content', 0.7,  'simple'),       -- identical spelling, same meaning
('fr', 'content', 0.7,  'normal'),       -- identical spelling, same meaning
('fr', 'content', 0.65, 'technique'),    -- identical spelling, same meaning
('fr', 'content', 0.65, 'naturel'),      -- -el ending, recognizable
('fr', 'content', 0.65, 'général'),      -- accent + ending, recognizable
('fr', 'content', 0.55, 'spécial'),      -- accent difference
('fr', 'content', 0.55, 'principal'),    -- recognizable
('fr', 'content', 0.55, 'différent'),    -- accent difference
('fr', 'content', 0.5,  'international'),-- recognizable
('fr', 'content', 0.5,  'possible'),     -- identical spelling, same meaning

-- Moderate cognates (0.3–0.49)
('fr', 'content', 0.45, 'personnel'),    -- double n, -el vs -al
('fr', 'content', 0.45, 'particulier'),  -- recognizable
('fr', 'content', 0.45, 'politique'),    -- recognizable
('fr', 'content', 0.45, 'économique'),   -- recognizable
('fr', 'content', 0.45, 'populaire'),    -- recognizable
('fr', 'content', 0.45, 'financier'),    -- recognizable
('fr', 'content', 0.45, 'culturel'),     -- recognizable
('fr', 'content', 0.45, 'scientifique'), -- recognizable
('fr', 'content', 0.35, 'traditionnel'), -- recognizable
('fr', 'content', 0.35, 'moderne'),      -- recognizable
('fr', 'content', 0.3,  'sérieux'),      -- "serious" weakly recognizable

-- Weak cognates (0.1–0.29)
('fr', 'content', 0.25, 'réel'),         -- "real" recognizable but short
('fr', 'content', 0.2,  'complet'),      -- "complete" comp- shared
('fr', 'content', 0.2,  'grave'),        -- identical spelling, similar meaning
('fr', 'content', 0.2,  'facile'),       -- "facile" English loan
('fr', 'content', 0.2,  'long'),         -- identical spelling, same meaning
('fr', 'content', 0.15, 'large'),        -- identical spelling, same meaning
('fr', 'content', 0.15, 'riche'),        -- "rich" r-i-c shared
('fr', 'content', 0.15, 'brave'),        -- identical spelling, same meaning
('fr', 'content', 0.15, 'premier'),      -- "premier" English loan
('fr', 'content', 0.1,  'fort'),         -- "fort" → "forte" English loan
('fr', 'content', 0.1,  'noir'),         -- "film noir" English loan
('fr', 'content', 0.1,  'grand'),        -- "grand" English loan
('fr', 'content', 0.1,  'sûr'),          -- "sure" circumflex + accent
('fr', 'content', 0.1,  'bleu'),         -- "blue" b-l shared

-- Very low / no cognate (0.0–0.09)
('fr', 'content', 0.05, 'jeune'),        -- "junior" shared root
('fr', 'content', 0.05, 'nouveau'),      -- "novel" shared root
('fr', 'content', 0.05, 'beau'),         -- "beautiful" b-e-a shared
('fr', 'content', 0.05, 'clair'),        -- "clear" c-l-a shared
('fr', 'content', 0.05, 'vide'),         -- "void" shared root
('fr', 'content', 0.05, 'petit'),        -- "petite" English loan
('fr', 'content', 0.02, 'blanc'),        -- "blancmange" weak
('fr', 'content', 0.02, 'faible'),       -- "feeble" shared root
('fr', 'content', 0.02, 'entier'),       -- "entire" shared root
('fr', 'content', 0.02, 'difficile'),    -- "difficult" d-i-f-f shared
('fr', 'content', 0.01, 'libre'),        -- "liberty" shared root
('fr', 'content', 0.01, 'rouge'),        -- "red" → no link
('fr', 'content', 0.01, 'chaud'),        -- "calorie" shared root
('fr', 'content', 0.01, 'froid'),        -- "frigid" shared root
('fr', 'content', 0.0,  'bon'),          -- "bonus" shared root
('fr', 'content', 0.0,  'mauvais'),      -- "bad" → no link
('fr', 'content', 0.0,  'vieux'),        -- "old" → no link
('fr', 'content', 0.0,  'seul'),         -- "alone" → "solitary" shared root
('fr', 'content', 0.0,  'vrai'),         -- "true" → "veracity" shared root
('fr', 'content', 0.0,  'faux'),         -- "false" → "fallacy" shared root
('fr', 'content', 0.0,  'propre'),       -- "proper" false friend
('fr', 'content', 0.0,  'haut'),         -- "high" → no link
('fr', 'content', 0.0,  'bas'),          -- "base" misleading
('fr', 'content', 0.0,  'court'),        -- "short" → "court" false friend
('fr', 'content', 0.0,  'étroit'),       -- "narrow" → no link
('fr', 'content', 0.0,  'pauvre'),       -- "poor" → "poverty" shared root
('fr', 'content', 0.0,  'vert'),         -- "green" → "verdure" shared root
('fr', 'content', 0.0,  'doux'),         -- "sweet/soft" → "dulcet" shared root
('fr', 'content', 0.0,  'gentil');       -- "gentle" shared root, misleading


-- CONTENT ADVERBS (20)
INSERT INTO public.preset_lexicons (language_code, preset_type, initial_progression_score, value) VALUES
('fr', 'content', 0.4,  'exactement'),   -- "exactly" recognizable -ment = -ly
('fr', 'content', 0.35, 'probablement'), -- "probably" recognizable
('fr', 'content', 0.35, 'certainement'), -- "certainly" recognizable
('fr', 'content', 0.3,  'évidemment'),   -- "evidently" recognizable
('fr', 'content', 0.3,  'généralement'), -- "generally" recognizable
('fr', 'content', 0.3,  'simplement'),   -- "simply" recognizable
('fr', 'content', 0.3,  'directement'),  -- "directly" recognizable
('fr', 'content', 0.3,  'naturellement'),-- "naturally" recognizable
('fr', 'content', 0.3,  'normalement'),  -- "normally" recognizable
('fr', 'content', 0.25, 'particulièrement'), -- "particularly" recognizable
('fr', 'content', 0.25, 'effectivement'),-- "effectively" recognizable
('fr', 'content', 0.2,  'réellement'),   -- "really" recognizable
('fr', 'content', 0.2,  'absolument'),   -- "absolutely" recognizable
('fr', 'content', 0.15, 'lentement'),    -- "lent" → slow, not obvious
('fr', 'content', 0.1,  'rapidement'),   -- "rapid" recognizable
('fr', 'content', 0.05, 'rarement'),     -- "rare" shared, somewhat recognizable
('fr', 'content', 0.0,  'aussitôt'),     -- "immediately" → no link
('fr', 'content', 0.0,  'désormais'),    -- "from now on" → no link
('fr', 'content', 0.0,  'exprès');       -- "on purpose" → "express" false friend

