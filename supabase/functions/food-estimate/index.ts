// food-estimate: turns "what I ate" free text into calories and protein, using Claude Haiku.
// Called from the Food tab with the user's login, so JWT verification stays ON for this function:
// only signed-in users can spend the API key.
//
// Secret it needs (Supabase > Edge Functions > Secrets): ANTHROPIC_API_KEY.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const MAX_TEXT = 300

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM = `You estimate calories and protein for a food diary. The user writes what they ate, usually in Hebrew, sometimes in English, often informally.

- Split the text into separate foods or drinks and estimate each one.
- When no amount is given, assume a typical single portion as served in Israel (e.g. a slice of bread ~30 g, a tub of cottage ~250 g, a pita ~80 g).
- Use typical home or cafe preparation, including the usual oil, unless the text says otherwise.
- kcal is a whole number; protein is grams, rounded to 0.5.
- "name" is a short label for the whole meal in the user's own language and wording, at most 60 characters. Item names also stay in the user's language.
- The totals must equal the sum of the items.
- If the text isn't food at all, return an empty items list and zeros.`

const ITEM = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    kcal: { type: 'integer' },
    protein: { type: 'number' },
  },
  required: ['name', 'kcal', 'protein'],
  additionalProperties: false,
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    kcal: { type: 'integer' },
    protein: { type: 'number' },
    items: { type: 'array' as const, items: ITEM },
  },
  required: ['name', 'kcal', 'protein', 'items'],
  additionalProperties: false,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let text = ''
  try {
    text = String((await req.json())?.text ?? '').trim().slice(0, MAX_TEXT)
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (!text) return json({ error: 'Nothing to estimate' }, 400)

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      system: SYSTEM,
      // A quick lookup-style task: low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: text }],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'Could not estimate this one' }, 422)
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return json({ error: 'No estimate came back' }, 502)
    return json(JSON.parse(block.text))
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key is missing or wrong' }, 500)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many requests, try again in a moment' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic API error ${e.status}: ${e.message}` }, 502)
    return json({ error: String(e) }, 500)
  }
})
