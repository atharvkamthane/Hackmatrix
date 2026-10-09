import { formatAggregateValue, isSuppressed, safeUnsuppressedCount, AggregateValue } from '../types/privacy';

function runPrivacyTests() {
  console.log('Running HackMatrix Privacy & Suppression Verification Suite...');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ PASS: ${testName}`);
    } else {
      console.error(`✗ FAIL: ${testName}`);
    }
  }

  // Test 1: Suppressed Aggregate Value Formatter
  const suppressedVal: AggregateValue = { suppressed: true, reason: 'BELOW_K_THRESHOLD' };
  assert(isSuppressed(suppressedVal) === true, 'isSuppressed identifies suppressed aggregate');
  assert(formatAggregateValue(suppressedVal) === 'Suppressed for privacy', 'formatAggregateValue renders privacy message');
  assert(safeUnsuppressedCount(suppressedVal) === null, 'safeUnsuppressedCount returns null for suppressed aggregate');

  // Test 2: Unsuppressed Aggregate Value Formatter
  const unsuppressedVal: AggregateValue = { suppressed: false, count: 27 };
  assert(isSuppressed(unsuppressedVal) === false, 'isSuppressed identifies unsuppressed aggregate');
  assert(formatAggregateValue(unsuppressedVal) === '27', 'formatAggregateValue formats number correctly');
  assert(safeUnsuppressedCount(unsuppressedVal) === 27, 'safeUnsuppressedCount returns valid count');

  // Test 3: Null/Undefined Safety
  assert(isSuppressed(null) === true, 'Null aggregate treated as suppressed');
  assert(formatAggregateValue(undefined) === 'Suppressed for privacy', 'Undefined aggregate fallback to privacy message');

  console.log(`\nPrivacy Test Results: ${passed}/${total} assertions passed successfully.`);
  if (passed !== total) {
    throw new Error('Privacy Test Suite Failed!');
  }
}

runPrivacyTests();
