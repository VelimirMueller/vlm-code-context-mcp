const Database = require('better-sqlite3');
const db = new Database('context.db');

// Get agents and milestones
const agents = db.prepare('SELECT role FROM agents ORDER BY role').all();
const milestones = db.prepare('SELECT id, name, status FROM milestones ORDER BY id').all();
console.log('Agents:', agents.length, '| Milestones:', milestones.length);

// Create sprints + tickets for each active milestone
const createSprint = db.prepare("INSERT OR IGNORE INTO sprints (name, goal, status, velocity_committed, velocity_completed, milestone_id, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
const createTicket = db.prepare("INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points, milestone_id, assigned_to, qa_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

let totalTickets = 0;
let totalSprints = 0;

for (const m of milestones) {
  const existing = db.prepare("SELECT COUNT(*) as c FROM sprints WHERE milestone_id = ?").get(m.id).c;

  if (m.status === 'active' && existing === 0) {
    const sname = 'Sprint — ' + m.name;
    createSprint.run(sname, 'Deliver ' + m.name, 'implementation', agents.length * 2, 0, m.id, '2026-03-28');
    const sid = db.prepare("SELECT id FROM sprints WHERE name = ?").get(sname);
    if (sid) {
      let n = 1;
      for (const a of agents) {
        createTicket.run(sid.id, m.name.split(' ')[0] + '-' + String(n++).padStart(3,'0'), a.role + ': ' + m.name + ' work', 'P1', 'TODO', 2, m.id, a.role, 0);
        totalTickets++;
      }
      totalSprints++;
    }
  } else if (m.status === 'completed' && existing === 0) {
    const sname = m.name + ' — Completed';
    createSprint.run(sname, 'Completed ' + m.name, 'closed', 19, 19, m.id, '2026-03-26');
    const sid = db.prepare("SELECT id FROM sprints WHERE name = ?").get(sname);
    if (sid) {
      for (let i = 1; i <= 10; i++) {
        createTicket.run(sid.id, m.name.split(' ')[0] + '-C' + i, 'Completed task ' + i, 'P1', 'DONE', 2, m.id, agents[i % agents.length].role, 1);
        totalTickets++;
      }
      totalSprints++;
    }
  }
}

const finalT = db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
const finalS = db.prepare('SELECT COUNT(*) as c FROM sprints').get().c;
console.log('Created', totalSprints, 'sprints,', totalTickets, 'tickets');
console.log('Total: Sprints:', finalS, '| Tickets:', finalT);
