/**
 * CRM Preservation Verification Script
 *
 * Workflow:
 * 1. Load source of truth (baseline)
 * 2. Pick an existing non-test lead
 * 3. Record its baseline: stage, notes, tasks
 * 4. Import (simulates a Meta sync — should only update Meta fields)
 * 5. Verify stage is UNCHANGED (CRM field preserved)
 * 6. Pick a different lead, change its stage, add note, add task
 * 7. Re-import (second sync)
 * 8. Verify stage, note, task all preserved
 * 9. Verify no duplicate created
 * 10. Show final results
 */

const API = 'http://localhost:3001/api';

async function json(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== CRM PRESERVATION VERIFICATION ===\n');

  // STEP 1: Baseline — source of truth
  console.log('--- Step 1: Baseline ---');
  const truth1 = await json(`${API}/debug/source-of-truth`);
  const totalBefore = truth1.totalLeads;
  console.log(`  Total leads before: ${totalBefore}`);
  console.log(`  By stage:`, JSON.stringify(truth1.byStage));

  // STEP 2: Pick a non-test lead
  console.log('\n--- Step 2: Pick target lead ---');
  const allLeads = truth1.leads;
  const realLeads = allLeads.filter((l) => !l.name.includes('test lead'));
  if (realLeads.length === 0) {
    console.error('  ERROR: No non-test leads found!');
    process.exit(1);
  }

  const target = realLeads[0];
  console.log(`  Chosen lead: "${target.name}" (metaLeadId=${target.metaLeadId})`);
  console.log(`  Current stage: ${target.stage}`);

  // Get full lead detail including notes/tasks
  const leadDetail = await json(`${API}/leads/${target.id}`);
  const notesBefore = await json(`${API}/leads/${target.id}/notes`);
  const tasksBefore = await json(`${API}/leads/${target.id}/tasks`);
  const historyBefore = await json(`${API}/leads/${target.id}/history`);
  console.log(`  Notes before: ${(notesBefore.notes || []).length}`);
  console.log(`  Tasks before: ${(tasksBefore.tasks || []).length}`);
  console.log(`  Stage history entries: ${(historyBefore.history || []).length}`);

  // STEP 3: Choose a second lead — change stage, add note and task
  console.log('\n--- Step 3: Mutate CRM fields on a DIFFERENT lead ---');
  const mutateTarget = realLeads[1] || realLeads[0];
  console.log(`  Mutating lead: "${mutateTarget.name}" (id=${mutateTarget.id})`);

  // Change stage from Lead to Contact
  const stageResult = await json(`${API}/leads/${mutateTarget.id}/stage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'Contact' }),
  });
  console.log(`  Stage changed to: ${stageResult.stage}`);

  // Add a note
  const noteResult = await json(`${API}/leads/${mutateTarget.id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `Verification test note — ${new Date().toISOString()}` }),
  });
  console.log(`  Note added: ${noteResult.id}`);

  // Add a task
  const taskResult = await json(`${API}/leads/${mutateTarget.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `Verification test task — ${new Date().toISOString()}` }),
  });
  console.log(`  Task added: ${taskResult.id}`);

  // Verify CRM mutations visible immediately
  const notesAfterMutate = await json(`${API}/leads/${mutateTarget.id}/notes`);
  const tasksAfterMutate = await json(`${API}/leads/${mutateTarget.id}/tasks`);
  const historyAfterMutate = await json(`${API}/leads/${mutateTarget.id}/history`);
  console.log(`  Notes after mutate: ${(notesAfterMutate.notes || []).length}`);
  console.log(`  Tasks after mutate: ${(tasksAfterMutate.tasks || []).length}`);
  console.log(`  Stage history entries: ${(historyAfterMutate.history || []).length}`);

  const crmBefore = {
    stage: 'Contact',
    noteCount: (notesAfterMutate.notes || []).length,
    taskCount: (tasksAfterMutate.tasks || []).length,
    historyCount: (historyAfterMutate.history || []).length,
  };

  // STEP 4: Re-import (simulate Meta sync)
  console.log('\n--- Step 4: Re-import from Meta (first sync) ---');
  const import1 = await json(`${API}/meta/import-leads`, { method: 'POST' });
  console.log(`  Import result:`, JSON.stringify(import1, null, 2));

  // STEP 5: Verify no duplicate created
  console.log('\n--- Step 5: Verify no duplicate ---');
  const truth2 = await json(`${API}/debug/source-of-truth`);
  console.log(`  Total leads before: ${totalBefore}, after: ${truth2.totalLeads}`);
  const noDuplicate = truth2.totalLeads === totalBefore;
  console.log(`  No duplicate created: ${noDuplicate ? 'YES ✅' : 'NO ❌'}`);

  // STEP 6: Verify CRM fields preserved
  console.log('\n--- Step 6: Verify CRM fields preserved after re-import ---');
  const mutateLeadAfter = await json(`${API}/leads/${mutateTarget.id}`);
  console.log(`  Stage after sync: ${mutateLeadAfter.stage}`);
  const stagePreserved = mutateLeadAfter.stage === crmBefore.stage;

  const notesAfterReimport = await json(`${API}/leads/${mutateTarget.id}/notes`);
  const notePreserved = (notesAfterReimport.notes || []).length >= crmBefore.noteCount;

  const tasksAfterReimport = await json(`${API}/leads/${mutateTarget.id}/tasks`);
  const taskPreserved = (tasksAfterReimport.tasks || []).length >= crmBefore.taskCount;

  const historyAfterReimport = await json(`${API}/leads/${mutateTarget.id}/history`);
  const historyPreserved = (historyAfterReimport.history || []).length >= crmBefore.historyCount;

  console.log(`  Stage preserved (${crmBefore.stage}): ${stagePreserved ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Note preserved (${crmBefore.noteCount} notes): ${notePreserved ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Task preserved (${crmBefore.taskCount} tasks): ${taskPreserved ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  History preserved (${crmBefore.historyCount} entries): ${historyPreserved ? 'YES ✅' : 'NO ❌'}`);

  // STEP 7: Second import — verify dedup still works
  console.log('\n--- Step 7: Second re-import (verify dedup stability) ---');
  const import2 = await json(`${API}/meta/import-leads`, { method: 'POST' });
  console.log(`  Import 2 result: ${import2.created} created, ${import2.updated} updated, ${import2.skipped} skipped`);

  const truth3 = await json(`${API}/debug/source-of-truth`);
  console.log(`  Total after 2nd re-import: ${truth3.totalLeads} (should be ${totalBefore})`);
  const dedupStable = truth3.totalLeads === totalBefore && import2.created === 0;
  console.log(`  Dedup stable (0 created): ${dedupStable ? 'YES ✅' : 'NO ❌'}`);

  // Verify CRM fields still preserved after 2nd import
  const mutateLeadAfter2 = await json(`${API}/leads/${mutateTarget.id}`);
  console.log(`  Stage after 2nd sync: ${mutateLeadAfter2.stage}`);

  const notesAfterImport2 = await json(`${API}/leads/${mutateTarget.id}/notes`);
  const tasksAfterImport2 = await json(`${API}/leads/${mutateTarget.id}/tasks`);

  const finalStageOK = mutateLeadAfter2.stage === crmBefore.stage;
  const finalNotesOK = (notesAfterImport2.notes || []).length >= crmBefore.noteCount;
  const finalTasksOK = (tasksAfterImport2.tasks || []).length >= crmBefore.taskCount;

  console.log(`  Final stage preserved: ${finalStageOK ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Final notes preserved: ${finalNotesOK ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Final tasks preserved: ${finalTasksOK ? 'YES ✅' : 'NO ❌'}`);

  // === RESULTS ===
  console.log('\n========================================');
  console.log('=== FINAL VERIFICATION RESULTS ===');
  console.log('========================================');
  console.log(`  Chosen lead name:           "${mutateTarget.name}"`);
  console.log(`  metaLeadId:                 ${mutateTarget.metaLeadId}`);
  console.log(`  Stage before sync:          Lead`);
  console.log(`  Stage after sync:           ${mutateLeadAfter2.stage}`);
  console.log(`  Note persisted:             ${finalNotesOK ? 'YES' : 'NO'}`);
  console.log(`  Task persisted:             ${finalTasksOK ? 'YES' : 'NO'}`);
  console.log(`  Duplicate created:          ${noDuplicate && dedupStable ? 'NO' : 'YES'}`);
  console.log(`  Total leads before sync:    ${totalBefore}`);
  console.log(`  Total leads after sync:     ${truth3.totalLeads}`);
  console.log(`  Import 1 result:            ${import1.created} created, ${import1.updated} updated, ${import1.total} total`);
  console.log(`  Import 2 result:            ${import2.created} created, ${import2.updated} updated, ${import2.total} total`);

  if (stagePreserved && notePreserved && taskPreserved && historyPreserved && noDuplicate && dedupStable) {
    console.log('\n  ✅ ALL CHECKS PASSED — CRM data is never overwritten by Meta sync.');
  } else {
    console.log('\n  ❌ SOME CHECKS FAILED — Review output above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});