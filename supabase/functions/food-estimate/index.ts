// food-estimate: turns "what I ate" (free text and/or a photo) into calories and protein, using Claude Haiku.
// With { mode: 'ideas' } it instead suggests foods that close the day's protein gap within the calories left.
// Called from the Food tab with the user's login, so JWT verification stays ON for this function:
// only signed-in users can spend the API key.
//
// Secret it needs (Supabase > Edge Functions > Secrets): ANTHROPIC_API_KEY.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const MAX_TEXT = 300
const MAX_PHOTO_B64 = 4_000_000 // the app sends ~1280px JPEGs, well under this
const MAX_MEALS = 40

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
- If the text isn't food at all, return an empty items list and zeros.
- If there's a photo, identify the foods in it and estimate portions from what you see (plate size, utensils, packaging). Any text is extra context, like the portion eaten. With no text, write names in Hebrew.`

const IDEAS_SYSTEM = `You help someone close today's protein gap in their food diary. You get how much protein they still want (grams), how many calories they have left, and a list of their own saved meals (most eaten first), usually named in Hebrew.

- Suggest 4 options, each a single thing to eat, that add a good share of the missing protein while staying within the calories left. If almost no calories are left, pick the leanest high-protein options.
- Prefer their own saved meals when one fits: copy its name, kcal and protein exactly and set mine to true.
- Otherwise suggest everyday foods easy to get in Israel (cottage, yogurt, eggs, tuna, chicken, tofu, protein shake...), with a typical portion in the name, written in Hebrew, and set mine to false.
- kcal is a whole number; protein is grams, rounded to 0.5. Order from best fit to least.`

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

const IDEAS_SCHEMA = {
  type: 'object' as const,
  properties: {
    ideas: {
      type: 'array' as const,
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, kcal: { type: 'integer' }, protein: { type: 'number' }, mine: { type: 'boolean' } },
        required: ['name', 'kcal', 'protein', 'mine'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }

  let system = SYSTEM
  let schema: Record<string, unknown> = SCHEMA
  let content: Anthropic.ContentBlockParam[]
  if (body.mode === 'ideas') {
    const meals = (Array.isArray(body.meals) ? body.meals : []).slice(0, MAX_MEALS).map((m) => ({
      name: String(m?.name ?? '').slice(0, 200), kcal: Number(m?.kcal) || 0, protein: Number(m?.protein) || 0,
    }))
    system = IDEAS_SYSTEM
    schema = IDEAS_SCHEMA
    content = [{
      type: 'text',
      text: JSON.stringify({ protein_left_g: Number(body.proteinLeft) || 0, kcal_left: Number(body.kcalLeft) || 0, my_meals: meals }),
    }]
  } else {
    const text = String(body.text ?? '').trim().slice(0, MAX_TEXT)
    const photo = body.photo as { data?: unknown; media_type?: unknown } | undefined
    const hasPhoto = typeof photo?.data === 'string' && photo.data.length > 0
    if (hasPhoto && (photo!.media_type !== 'image/jpeg' || (photo!.data as string).length > MAX_PHOTO_B64)) {
      return json({ error: 'The photo is too big or not a JPEG' }, 400)
    }
    if (!text && !hasPhoto) return json({ error: 'Nothing to estimate' }, 400)
    content = [
      ...(hasPhoto ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: photo!.data as string } }] : []),
      { type: 'text', text: text || 'What did I eat? (photo)' },
    ]
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      system,
      // A quick lookup-style task: low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
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
