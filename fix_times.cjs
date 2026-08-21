const fs = require('fs');
let c = fs.readFileSync('src/lib/fsrs/adapter.test.ts', 'utf-8');

c = c.replace(/it\("correct → outcome 'good'", \(\) => \{\n      const result = assess\(\{\n        validationResult: \{ correct: true \},\n        attemptNumber: 1,\n        hintsUsed: 0,\n        responseMs: 2000,/g,
    `it("correct → outcome 'good'", () => {\n      const result = assess({\n        validationResult: { correct: true },\n        attemptNumber: 1,\n        hintsUsed: 0,\n        responseMs: 10000,`);

c = c.replace(/it\("hints used DOES downgrade outcome to hard", \(\) => \{\n      const result = assess\(\{\n        validationResult: \{ correct: true \},\n        attemptNumber: 1,\n        hintsUsed: 1,\n        responseMs: 2000,/g,
    `it("hints used DOES downgrade outcome to hard", () => {\n      const result = assess({\n        validationResult: { correct: true },\n        attemptNumber: 1,\n        hintsUsed: 1,\n        responseMs: 10000,`);

c = c.replace(/it\("Easy mode correct → same outcome as Hard mode correct", \(\) => \{\n      const easy = assess\(\{\n        validationResult: \{ correct: true \},\n        attemptNumber: 1,\n        hintsUsed: 0,\n        responseMs: 2000,/g,
    `it("Easy mode correct → same outcome as Hard mode correct", () => {\n      const easy = assess({\n        validationResult: { correct: true },\n        attemptNumber: 1,\n        hintsUsed: 0,\n        responseMs: 10000,`);

c = c.replace(/const hard = assess\(\{\n        validationResult: \{ correct: true \},\n        attemptNumber: 1,\n        hintsUsed: 0,\n        responseMs: 2000,/g,
    `const hard = assess({\n        validationResult: { correct: true },\n        attemptNumber: 1,\n        hintsUsed: 0,\n        responseMs: 10000,`);

fs.writeFileSync('src/lib/fsrs/adapter.test.ts', c);
