const fs = require('fs');
const pako = require('pako');
const initSqlJs = require('sql.js');
const AnkiExport = require('anki-apkg-export').default;

(async () => {
    console.log("🗜 Reading and decompressing .gz...");
  const compressed = fs.readFileSync('migaku.db.gz');
  const decompressed = pako.inflate(compressed);

  console.log("📄 Initializing SQL.js...");
  const SQL = await initSqlJs();
  const db = new SQL.Database(decompressed);

  const deckId = 1741881835590; // ← replace with your actual deck ID
  const createdAfter = 0; // ← or a number like 1500 (Migaku "days")

  console.log("📊 Preparing SQL query...");

  const testCards = db.exec(`SELECT id, deckId, created FROM card WHERE deckId = ${deckId}`);
console.log(`🧪 Raw cards in deck ${deckId}:`, testCards[0]?.values?.length || 0);


  const decks = db.exec("SELECT id, name FROM deck");
 // console.log("📚 Available decks:");
  //for (const row of decks[0]?.values || []) {
    //console.log(`🟢 Deck ID: ${row[0]} → ${row[1]}`);
  //}

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("📋 All tables in DB:", tables[0]?.values.map(v => v[0]));
  
  const cardCols = db.exec("PRAGMA table_info(card)");
  console.log("📋 Columns in card table:", cardCols[0]?.values.map(v => v[1]));
  

  console.log("🎯 Running query...");

  const noteFields = [
    "Target Word",
    "Sentence",
    "Sentence Translation",
    "Definition",
    "Sentence Audio",
    "Word Audio",
    "Image",
    "Example Sentences",
    "Notes"
  ];
  
  const noteType = {
    name: "Migaku Note",
    fields: noteFields,
    templates: [{
      name: "Card 1",
      qfmt: "{{Target Word}}<br>{{Sentence}}",
      afmt: `
        {{FrontSide}}<hr id="answer">
        <b>{{Sentence Translation}}</b><br>
        {{Definition}}<br>
        {{Example Sentences}}<br>
        <i>{{Notes}}</i>
      `
    }]
  };
  
  console.log("📦 Creating full Migaku-style Anki deck...");
  const apkg = new AnkiExport("Migaku Export", noteType);
  
  const stmt = db.prepare(`
    SELECT id, deckId, created, primaryField, secondaryField, fields, notes
    FROM card
    WHERE deckId = $deck AND created >= $created
  `);
  stmt.bind({ $deck: deckId, $created: createdAfter });
  
  let added = 0;
  while (stmt.step()) {
    const row = stmt.getAsObject();
    apkg.addCard([
      row.primaryField || '',
      row.secondaryField || '',
      '', // Sentence Translation — placeholder
      row.fields || '',
      '', // Sentence Audio — placeholder
      '', // Word Audio — placeholder
      '', // Image — placeholder
      '', // Example Sentences — placeholder
      row.notes || ''
    ]);
    added++;
  }
  console.log(`✅ Added ${added} cards`);
  
  console.log(`✅ Added ${added} cards`);
  

  console.log("💾 Saving .apkg...");
  const zip = await apkg.save();
  fs.writeFileSync('Migaku_Export.apkg', zip);
  console.log('✅ Export complete: Migaku_Export.apkg');
})();
