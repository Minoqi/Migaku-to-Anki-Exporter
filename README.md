# Migaku to Anki Exporter

## Features
- Can export single card to anki
- Can export whole deck to anki

## Limitations/Bugs
- Does not export audio
- Does not save interval/learning status

## TODO
- [ ] Add support to export audio
- [ ] Add support to include card learning status/intervals/history
- [ ] Make proper documentation/set-up guide once fully featured

## Tutorial
1. Make sure the fields in your card in Anki match these names
(Lines 97 - 108)
```
    const fields = {
      "Target Word": clean(word),
      "Sentence": clean(sentence),
      "Sentence Translation": clean(translation),
      "Definitions": clean(definition),
      "Sentence Audio": sentenceAudioTag,
      "Word Audio": "",
      "Images": imageTag,
      "Example Sentences": "",
      "Notes": clean(notes),
      "Is Vocabulary Card": "1",
    };
```

2. Make sure the `deckName` matches the name of the deck in Anki and the `modelName` matches the note type name
(Lines)
```
    const payload = {
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: "Migaku",
          modelName: "Migaku Korean CUSTOM",
          fields,
          tags: ["migaku"],
          options: { allowDuplicate: true }
        }
      }
    };
```

3. Make sure to have anki connect installed (should be already from migaku) and anki open when using
4. Reload the migaku webpage, go to a deck and select a card from it, the button to export the whole deck or single card will appear at the top right, if exporting the whole deck it'll start from that card and go down the list until it reaches the end, please do not leave the site while it does this as I don't know if it would break
