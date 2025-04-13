const fs = require('fs');
const pako = require('pako');
const initSqlJs = require('sql.js');
const axios = require('axios');

(async () => {
  const compressed = fs.readFileSync('migaku.db.gz');
  const decompressed = pako.inflate(compressed);
  const SQL = await initSqlJs();
  const db = new SQL.Database(decompressed);

  const deckId = 1741704907384; // ← Update to your deck
  const createdAfter = 0;       // ← Or use a specific "day" threshold

  console.log("🎯 Using deckId:", deckId);
  console.log("🎯 Using createdAfter:", createdAfter);

  const mediaRelatedTables = db.exec(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (
      name LIKE '%media%' OR
      name LIKE '%audio%' OR
      name LIKE '%image%' OR
      name LIKE '%resource%' OR
      name LIKE '%file%'
    );
  `);
  
  console.log("🔍 Possible media tables:", mediaRelatedTables[0]?.values.map(v => v[0]));

  const cols = db.exec("PRAGMA table_info(langResourceInfo)");
  console.log("📋 Columns in langResourceInfo:", cols[0]?.values.map(v => v[1]));
  
  const sample = db.exec("SELECT * FROM langResourceInfo LIMIT 3");
  console.log("🧪 Sample rows from langResourceInfo:", sample[0]?.values);
  


  const stmt = db.prepare(`
    SELECT id, deckId, created, primaryField, secondaryField, fields, notes
    FROM card
    WHERE deckId = $deck AND created >= $created
  `);
  stmt.bind({ $deck: deckId, $created: createdAfter });

  let added = 0;
  while (stmt.step()) {
    const row = stmt.getAsObject();

    // 💡 Customize these field mappings based on your note type fields
    const fields = {
      "Target Word": row.primaryField || '',
      "Sentence": row.secondaryField || '',
      "Translation": '',     // You could parse this from row.fields if it’s in there
      "Definitions": row.fields || '',
      "Sentence Audio": '',
      "Word Audio": '',
      "Images": '',
      "Example Sentences": ''
    };

    const payload = {
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: "Migaku",
          modelName: "Migaku Korean CUSTOM",
          fields,
          options: { allowDuplicate: true },
          tags: ["migaku"],
        }
      }
    };

    try {
      const res = await axios.post("http://localhost:8765", payload);
      if (res.data?.error) {
        console.error("❌ Anki error:", res.data.error);
      } else {
        console.log(`✅ Card added [ID ${row.id}]`);
        added++;
      }
    } catch (err) {
      console.error("❌ Failed to send card:", err.message);
    }

    await new Promise((res) => setTimeout(res, 300)); // 500ms delay between cards
  }

  console.log(`✅ Done! ${added} cards sent to Anki.`);
})();
