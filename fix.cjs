const fs = require('fs');
let c = fs.readFileSync('src/lib/fsrs/adapter.test.ts', 'utf-8');
c = c.replace(/"correct"/g, '"good"');
c = c.replace(/"incorrect"/g, '"again"');
c = c.replace(/"ambiguous"/g, '"hard"');
c = c.replace(/expect\(outcomeToGrade\("good"\)\).toBe\(Rating.Good\);\n\s*expect\(outcomeToGrade\("again"\)\).toBe\(Rating.Again\);\n\s*expect\(outcomeToGrade\("hard"\)\).toBe\(Rating.Hard\);/g, 
`expect(outcomeToGrade("good")).toBe(Rating.Good);
      expect(outcomeToGrade("again")).toBe(Rating.Again);
      expect(outcomeToGrade("hard")).toBe(Rating.Hard);
      expect(outcomeToGrade("easy")).toBe(Rating.Easy);`);

fs.writeFileSync('src/lib/fsrs/adapter.test.ts', c);
