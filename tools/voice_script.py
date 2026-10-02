"""
The site's three Picsart (Eleven v4) takes: what each voice says, in order.
Numbers and times are spelled out for speech; the page shows the written form.

    python tools/voice_script.py <take>   -> C:/dev/tmp/prompt.txt (then clip-text.ps1)
    python tools/voice_script.py --json   -> every clip and its spoken words
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CASE = json.load(io.open(os.path.join(HERE, '..', 'content', 'demo-case.json'), encoding='utf-8'))

SPEECH = [
    ('νούμερο 44', 'νούμερο σαράντα τέσσερα'),
    ('Στις 04:12', 'Στις τέσσερις και δώδεκα'),
    ('από τις 03:30 ως τις 04:45', 'από τις τρεισήμισι ως τις πέντε παρά τέταρτο'),
    ('τα 8.000', 'τις οκτώ χιλιάδες'),
    # Picsart rejects a threat read aloud: the note keeps it on screen only.
    (' Αλλιώς ξέρεις.', ''),
    ('«', ''), ('»', ''),
]


def spoken(text):
    for a, b in SPEECH:
        text = text.replace(a, b)
    return text


LANDING = ('Μην κλείσετε. Δεν έχω πολύ χρόνο. Απόψε κάποιος πέθανε, και όλοι λένε ότι ήταν ατύχημα. '
           'Δεν ήταν. Μαζέψτε δύο, τρεις φίλους. Αφήστε το τηλέφωνο στο τραπέζι, με την οθόνη προς τα πάνω. '
           'Θα χτυπήσει ξανά. Και την επόμενη φορά, να είστε έτοιμοι.')


def takes():
    tiers = {str(t['minScore']): t for t in CASE['solution']['tiers']}
    audio = CASE['site']['audio']
    narr = [('intro', CASE['briefing'])]
    narr += [(audio['evidence'][e['id']], f"{e['title']}. {e['text']}") for e in CASE['evidence']]
    ends = [(audio['tiers'][k], tiers[k]['text']) for k in ('6', '1', '0')] + [(audio['time'], CASE['site']['timeEnding']['text'])]
    call = CASE['calls'][0]
    return {
        'landing': {'voice': 'Nikos', 'clips': [('landing-call', LANDING)]},
        # Recorded 02/10 in these pieces; a rejection (or a slow reply) shows which piece holds it.
        'intro': {'voice': 'Theos', 'clips': [(i, spoken(t)) for i, t in narr[:1]]},
        'clues': {'voice': 'Theos', 'clips': [(i, spoken(t)) for i, t in narr[1:]]},
        'narration-b': {'voice': 'Theos', 'clips': [(i, spoken(t)) for i, t in ends]},
        # The two hours and the middle ending, re-recorded together when the case went to app minutes.
        'redo': {'voice': 'Theos', 'clips': [('intro', spoken(CASE['briefing'])), (audio['tiers']['1'], spoken(tiers['1']['text']))]},
        'call': {'voice': 'Katerina', 'clips': [(call['audioKey'], spoken(call['transcript']))]},
    }


if __name__ == '__main__':
    if sys.argv[1] == '--json':
        # Every clip and the words it should say, for tools/check-demo.mjs.
        clips = {}
        for name in ('landing', 'intro', 'clues', 'narration-b', 'redo', 'call'):
            clips.update(dict(takes()[name]['clips']))
        sys.stdout.buffer.write(json.dumps(clips, ensure_ascii=False).encode('utf-8'))
        sys.exit(0)
    t = takes()[sys.argv[1]]
    prompt = '\n\n'.join(s for _, s in t['clips'])
    io.open('C:/dev/tmp/prompt.txt', 'w', encoding='utf-8').write(prompt)
    print(t['voice'], len(t['clips']), 'clips', len(prompt), 'chars')
