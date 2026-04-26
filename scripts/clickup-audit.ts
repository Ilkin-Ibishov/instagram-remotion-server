#!/usr/bin/env tsx
import 'dotenv/config';
import client from '../src/automation/clickupClient';

function usage() {
  console.log('Usage: tsx scripts/clickup-audit.ts --list <LIST_ID> [--apply] [--complete]');
  console.log('--apply    : actually post comments to ClickUp (default is dry-run)');
  console.log('--complete : when used with --apply, attempt to set task status to `complete` after commenting');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = { apply: false, complete: false, listId: process.env.CLICKUP_LIST_ID || null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--list' && args[i+1]) { out.listId = args[++i]; }
    else if (a === '--apply') { out.apply = true; }
    else if (a === '--complete') { out.complete = true; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

function isActionableTask(task: any) {
  const text = `${task.name || ''}\n${task.description || ''}`.toLowerCase();
  const keywords = ['gnews', 'news', 'retry', '429', 'quota', 'scheduler', 'render', 'remotion', 'gemini', 'ai'];
  return keywords.some(k => text.includes(k));
}

function buildCommentForTask(task: any) {
  const lines = [];
  lines.push(`Automated audit performed on this task.`);
  lines.push('Summary:');
  lines.push(`- Task: ${task.name || '(no title)'} (id: ${task.id})`);
  lines.push('Findings & Suggested changes:');
  lines.push(`- Consider using the improved news service: see [src/pipeline/newsService.ts](src/pipeline/newsService.ts#L1) for status-aware retries and search merging.`);
  lines.push(`- Add/verify tests under [__tests__/newsService.test.ts](__tests__/newsService.test.ts#L1).`);
  lines.push(`- Configurable env vars: see .env.example for GNEWS_* variables.`);
  lines.push('If you want me to implement these changes automatically, re-run this script with `--apply` and set `CLICKUP_TOKEN` in the environment.');
  return lines.join('\n');
}

async function main() {
  const opts = parseArgs();
  if (opts.help) { usage(); return; }
  if (!opts.listId) { console.error('Error: list id is required.'); usage(); process.exit(1); }

  console.log(`Fetching tasks from ClickUp list ${opts.listId} (dry-run=${!opts.apply})...`);
  const res = await client.fetchTasksInList(opts.listId).catch((e: any) => { console.error('Failed to fetch tasks:', e); process.exit(2); });
  const tasks: any[] = Array.isArray(res.tasks) ? res.tasks : res.tasks ?? [];

  console.log(`Found ${tasks.length} tasks. Scanning for actionable items...`);

  let actionableCount = 0;
  for (const t of tasks) {
    const actionable = isActionableTask(t);
    if (!actionable) continue;
    actionableCount++;
    console.log(`- Actionable: ${t.id} ${t.name || ''}`);
    const comment = buildCommentForTask(t);
    if (opts.apply) {
      try {
        console.log(`  Posting comment to ${t.id}...`);
        await client.addComment(t.id, comment);
        if (opts.complete) {
          console.log(`  Setting task ${t.id} status to complete (best-effort)...`);
          try { await client.setTaskStatus(t.id, 'complete'); } catch (e) { console.warn('    Could not set task to complete:', e.message || e); }
        } else {
          console.log(`  (Not completing task; --complete not set)`);
        }
      } catch (err) {
        console.error('  Failed to post comment/update task:', err);
      }
    } else {
      console.log('  Dry-run comment preview:');
      console.log('-------------------------------------');
      console.log(comment);
      console.log('-------------------------------------');
    }
  }

  console.log(`Scan complete. ${actionableCount} actionable task(s) found.`);
  if (!opts.apply) {
    console.log('Run with --apply and set CLICKUP_TOKEN to post comments and update tasks.');
  }
}

main().catch(err => {
  console.error('Error running clickup-audit:', err);
  process.exit(3);
});
