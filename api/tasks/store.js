/**
 * POST /api/tasks/store
 * Stocke une tâche dans Upstash Redis
 */

import { Redis } from '@upstash/redis';

// Client Redis initialisé à la demande
let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vérifier le secret
  const secret = req.headers['x-internal-secret'];
  if (secret !== (process.env.POLLING_SECRET || 'dev-secret')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const task = req.body;

  if (!task || !task.id) {
    return res.status(400).json({ error: 'Invalid task' });
  }

  try {
    const client = getRedis();

    // Récupérer les tâches existantes
    let tasks = await client.get('pending_tasks') || [];

    // Ajouter la nouvelle tâche
    tasks.push(task);

    // Sauvegarder
    await client.set('pending_tasks', tasks);

    console.log(`Task stored: ${task.id} (total: ${tasks.length})`);

    res.json({ success: true, taskId: task.id, total: tasks.length });
  } catch (error) {
    console.error('Store error:', error);
    res.status(500).json({ error: error.message });
  }
}
