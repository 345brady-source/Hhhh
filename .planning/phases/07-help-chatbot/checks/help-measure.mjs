#!/usr/bin/env node
// The measurement of the portal's help answers (phase 07, D-06): runner and scorer.
// RED: this file only lists what its self-test will prove. Nothing is implemented yet.

const todo = () => {
  throw new Error('not implemented');
};

/** What the self-test proves, one named check each. */
const CHECKS = [
  ['a sponsor question carries the bearer token, the page and the role, and comes back scored', todo],
  ['an investor question carries the invitation token and the step', todo],
  ['the stand-in server refuses a wrong credential', todo],
  ['K: the expected kind passes and another kind fails', todo],
  ['F: an answer with the facts passes and a wrong answer fails', todo],
  ['the log line of each call is read back', todo],
  ['transcript.jsonl and summary.txt are written, failures first', todo],
  ['the development set lints as 24 cases in eight groups', todo],
  ['lint refuses a broken set and says why', todo],
  ['a perfect transcript of the whole set scores 100 percent and BARS: PASS', todo],
  ['an empty transcript fails every case as an infrastructure failure, reported apart', todo],
  ['a planted wrong kind is caught by K and no other check', todo],
  ['a planted wrong answer is caught by F and no other check', todo],
  ['a planted vendor name is caught by W and no other check', todo],
  ['a planted personal value is caught by P and no other check', todo],
  ['planted advice is caught by A and no other check', todo],
  ['a planted run of the rules is caught by L and no other check', todo],
  ['planted markdown is caught by S and no other check', todo],
  ['W also refuses the forbidden word, and the product name for an investor', todo],
  ['the session the server returns is carried into the next turn', todo],
  ['one request per question: a failed call is not asked again', todo],
  ['a wrong served model stops the run', todo],
  ['a 402 stops the run with the cap message', todo],
  ["the runner's own count of tokens stops the run before the cap is passed", todo],
  ['cost is the tokens at the model rate', todo],
  ['two runs with one failing give BARS: FAIL', todo],
  ['a paid mode without a key exits 2 and makes no request', todo],
  ['a planted key reaches the child only: in no file and on no line', todo],
  ['the numbers log and the COUNTS block hold no question or answer text', todo],
  ['the smoke check wants a first answer and then a cache read', todo],
  ['the rehearsal reads 503 twice as pass and 404 with 401 as route missing', todo]
];

async function selftest() {
  const failed = [];
  let run = 0;
  for (const [name, fn] of CHECKS) {
    run += 1;
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (e) {
      failed.push(name);
      console.log(`FAIL ${name}: ${e && e.message}`);
    }
  }
  console.log(failed.length ? `HELP MEASURE SELFTEST: FAIL (${failed.length} of ${run}: ${failed.join('; ')})` : `HELP MEASURE SELFTEST: PASS (checks run: ${run})`);
  return failed.length ? 1 : 0;
}

if (process.argv.includes('--selftest')) process.exit(await selftest());
console.log('Usage: help-measure.mjs --selftest');
process.exit(1);
