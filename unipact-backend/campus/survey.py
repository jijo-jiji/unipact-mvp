"""The pilot evaluation survey: UniKLSKILL's user acceptance test (15 Likert questions in three categories), so
the pilot's results compare directly with Ashraf Rahimi's baseline of 30 UniKL MIIT students (FYP2 report, §5.3)."""

SCALE = [(1, 'Strongly disagree'), (2, 'Disagree'), (3, 'Neutral'), (4, 'Agree'), (5, 'Strongly agree')]

CATEGORIES = [
    ('functionality', 'Functionality', [
        ('f1', 'I can sign in and use the features that match my role.'),
        ('f2', 'I can claim GHOCS points easily and without errors.'),
        ('f3', 'Advisors and the high committee can manage their club\'s activities here.'),
        ('f4', 'SDCL can approve and manage new clubs here.'),
        ('f5', 'Clubs, activities and GHOCS points are stored and shown accurately.'),
    ]),
    ('usability', 'Usability', [
        ('u1', 'The screens are consistent and easy to move around.'),
        ('u2', 'Labels, buttons and icons are clear.'),
        ('u3', 'It is easy to find what I need.'),
        ('u4', 'It works well on my phone and other devices.'),
        ('u5', 'The hints and guidance help me fill in forms.'),
    ]),
    ('satisfaction', 'User satisfaction', [
        ('s1', 'It takes less time to claim GHOCS points than before.'),
        ('s2', 'It puts club and GHOCS information in one place.'),
        ('s3', 'It helps me follow my GHOCS points and skills accurately.'),
        ('s4', 'It improves communication between club members.'),
        ('s5', 'Overall, it improves how clubs are run at UniKL MIIT.'),
    ]),
]
QUESTION_IDS = [q for _, _, questions in CATEGORIES for q, _ in questions]

# UniKLSKILL UAT, 30 students (4 of them high committee): share of all answers in each category, in percent
BASELINE = {
    'label': 'UniKLSKILL UAT (FYP2, 30 students)',
    'n': 30,
    'functionality': {5: 61.3, 4: 38.7, 3: 0.0, 2: 0.0, 1: 0.0},
    'usability': {5: 60.7, 4: 35.3, 3: 4.0, 2: 0.0, 1: 0.0},
    'satisfaction': {5: 62.0, 4: 37.3, 3: 0.7, 2: 0.0, 1: 0.0},
}


def questions():
    return [{'key': key, 'label': label, 'questions': [{'id': q, 'text': text} for q, text in qs]}
            for key, label, qs in CATEGORIES]


def results(responses):
    """Per category: the share of all answers at each point of the scale, the response count and the mean;
    per question: the mean."""
    out = {'n': len(responses), 'categories': [], 'baseline': BASELINE}
    for key, label, qs in CATEGORIES:
        counts = {v: 0 for v, _ in SCALE}
        total = 0
        per_question = []
        for q, text in qs:
            values = [r.answers.get(q) for r in responses if isinstance(r.answers.get(q), int)]
            for v in values:
                counts[v] += 1
            total += len(values)
            per_question.append({'id': q, 'text': text, 'mean': round(sum(values) / len(values), 2) if values else None,
                                 'n': len(values)})
        shares = {v: round(c / total * 100, 1) if total else 0.0 for v, c in counts.items()}
        mean = round(sum(v * c for v, c in counts.items()) / total, 2) if total else None
        out['categories'].append({'key': key, 'label': label, 'shares': shares, 'answers': total, 'mean': mean,
                                  'questions': per_question})
    return out
