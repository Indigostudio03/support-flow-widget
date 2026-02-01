/**
 * POST /api/chat/message
 * Traite un message de conversation
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `Tu es un assistant de support technique amical et efficace pour l'application VigiTask. Ton rôle est de comprendre précisément les bugs signalés par les utilisateurs.

PROCESSUS:
1. L'utilisateur décrit un problème
2. Tu poses MAXIMUM 2 questions de clarification (une seule si possible!)
3. Une fois le bug clair, tu génères un rapport structuré

RÈGLES STRICTES:
- Sois concis et amical (tutoie l'utilisateur)
- MAXIMUM 2 questions de clarification, pas plus!
- Compte tes questions - après 2 questions, tu DOIS générer le rapport
- Si l'utilisateur fournit une capture d'écran, analyse-la attentivement
- Si le bug est déjà clair dès le premier message, ne pose PAS de questions

QUAND TU AS ASSEZ D'INFOS (ou après 2 questions max), réponds avec ce JSON (et UNIQUEMENT ce JSON):
{
  "ready": true,
  "title": "Titre court du bug",
  "description": "Description détaillée",
  "steps": ["Étape 1", "Étape 2"],
  "priority": "high|medium|low",
  "category": "crash|ui|performance|feature|other",
  "component": "Composant probable (ex: attendance, clients, reports, auth, etc.)"
}

SINON, réponds normalement en texte pour poser ta question (UNE SEULE à la fois).`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, message, images = [], history = [] } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID requis' });
  }

  if (!message && images.length === 0) {
    return res.status(400).json({ error: 'Message ou image requis' });
  }

  try {
    // Construire le contenu utilisateur
    const userContent = buildUserContent(message, images);

    // Construire les messages pour OpenAI
    const questionCount = history.filter(m => m.role === 'assistant').length;
    let systemPrompt = SYSTEM_PROMPT;

    if (questionCount >= 2) {
      systemPrompt += `\n\nATTENTION: Tu as déjà posé ${questionCount} questions. Tu DOIS maintenant générer le rapport JSON final.`;
    } else if (questionCount === 1) {
      systemPrompt += `\n\nNote: Tu as déjà posé 1 question. Tu peux poser UNE dernière question si vraiment nécessaire, sinon génère le rapport.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userContent }
    ];

    // Appeler OpenAI
    const hasImages = images.length > 0;
    const model = hasImages ? 'gpt-4o' : 'gpt-4o-mini';

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = response.choices[0].message.content;

    // Vérifier si c'est un rapport final
    const jsonMatch = aiResponse.match(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const bugReport = JSON.parse(jsonMatch[0]);
        if (bugReport.ready === true) {
          // Analyser le bug
          const analysis = await analyzeInCodebase(bugReport);

          // Créer la tâche pour le polling
          const task = createTask(bugReport, analysis, images);

          // Stocker la tâche (via API interne)
          await storeTask(task, req);

          return res.json({
            type: 'complete',
            message: analysis.identified
              ? `✅ **Problème identifié!**\n\nMerci pour ton signalement. Un agent s'en occupe dès maintenant!`
              : `📝 **Bien reçu!**\n\nMerci pour ton signalement. Un agent va analyser et s'en occuper rapidement!`,
            taskId: task.id
          });
        }
      } catch (e) {
        // JSON mal formé, continuer comme message normal
      }
    }

    // Réponse normale (question de clarification)
    res.json({
      type: 'message',
      message: aiResponse,
      history: [
        ...history,
        { role: 'user', content: typeof userContent === 'string' ? userContent : message },
        { role: 'assistant', content: aiResponse }
      ]
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Erreur lors du traitement',
      details: error.message
    });
  }
}

function buildUserContent(message, images) {
  if (images.length === 0) {
    return message || '';
  }

  const content = [];
  if (message) {
    content.push({ type: 'text', text: message });
  }
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: img.data, detail: 'high' }
    });
  }
  return content;
}

async function analyzeInCodebase(bugReport) {
  const analysisPrompt = `Tu es un expert développeur analysant un bug report pour l'application VigiTask (Next.js/React).

## Bug Report
**Titre:** ${bugReport.title}
**Description:** ${bugReport.description}
**Catégorie:** ${bugReport.category}
**Composant probable:** ${bugReport.component || 'non spécifié'}

## Étapes de reproduction
${bugReport.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Non spécifiées'}

Basé sur cette description, identifie:
1. Le composant/fichier probable concerné
2. La cause probable du bug
3. Une suggestion de correction

Réponds en JSON:
{
  "identified": true/false,
  "confidence": "high|medium|low",
  "probable_file": "chemin/probable/fichier.tsx",
  "probable_cause": "Description courte de la cause",
  "suggestion": "Suggestion de correction"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Tu es un expert en debugging Next.js/React. Réponds uniquement en JSON valide.' },
        { role: 'user', content: analysisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    return {
      identified: false,
      confidence: 'low',
      probable_file: null,
      probable_cause: 'Analyse automatique non disponible',
      suggestion: 'Analyser manuellement'
    };
  }
}

function createTask(bugReport, analysis, images) {
  const id = 'task-' + Date.now();

  return {
    id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    synced: false,
    priority: bugReport.priority,
    title: bugReport.title,
    description: bugReport.description,
    category: bugReport.category,
    component: bugReport.component,
    steps: bugReport.steps,
    analysis: {
      identified: analysis.identified,
      confidence: analysis.confidence,
      probable_file: analysis.probable_file,
      probable_cause: analysis.probable_cause,
      suggestion: analysis.suggestion
    },
    screenshots: images.map((img, i) => ({
      index: i,
      data: img.data // Base64 data
    }))
  };
}

async function storeTask(task, req) {
  // Appeler l'API interne de stockage
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  try {
    await fetch(`${baseUrl}/api/tasks/store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.POLLING_SECRET || 'dev-secret'
      },
      body: JSON.stringify(task)
    });
  } catch (error) {
    console.error('Failed to store task:', error);
    // Ne pas bloquer - le polling récupérera peut-être la tâche autrement
  }
}
