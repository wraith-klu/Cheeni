import 'dotenv/config';
import { generateCheeniResponse, detectLocalAction, validateAction } from '../services/ai.service.js';

async function run() {
  console.log('=== TEST 1: Exact phrasing ("check battery") ===');
  const res1 = await generateCheeniResponse({ prompt: 'check battery' });
  console.log('Test 1 Action:', res1.action);

  console.log('=== TEST 2: Rephrased intent ("how much charge is left on my laptop?") ===');
  const res2 = await generateCheeniResponse({ prompt: 'how much charge is left on my laptop?' });
  console.log('Test 2 Action:', res2.action);

  console.log('=== TEST 3: Plain conversational message ("what is binary search?") ===');
  const res3 = await generateCheeniResponse({ prompt: 'what is binary search?' });
  console.log('Test 3 Action:', res3.action);

  console.log('=== TEST 4: Fallback test with simulate failure ===');
  const fallback = detectLocalAction('check battery');
  console.log('Fallback action:', fallback);

  console.log('=== TEST 5: Defensive validation ===');
  console.log('Invalid action:', validateAction({ type: 'hack_laptop' }));
  console.log('Valid action:', validateAction({ type: 'launch_app', app: 'calculator' }));
}

run().catch(console.error);
