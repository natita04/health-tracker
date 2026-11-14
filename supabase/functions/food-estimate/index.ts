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
- For every item give "count" and "unit_grams", and the nutrition PER 100 g of that food ("per100_kcal", "per100_protein"). The item's weight is count x unit_grams. Do NOT multiply anything yourself: the server computes the weight, calories and protein.
- "count" is how many units the user wrote ("2 meatballs" -> count 2, "3 eggs" -> 3, "half a pita" -> 0.5). It is EXACT: never drop it, round it or fold it into unit_grams. Use count 1 when no number is written, or when the user gave a total weight or volume (then unit_grams is that whole weight). "unit_grams" is the weight of ONE unit as eaten.
- A weight the user writes is EXACT. Use it as the total (count 1, unit_grams = that weight) and never swap it for a typical portion. Units: g, gr, gram, grams, גרם, גר', ג' are grams; kg / ק"ג is 1000 g; ml / מ"ל is about 1 g per ml (use the drink's real density if it is clearly different, e.g. oil, honey). "Cup", "tbsp", "tsp" and the like are not weights, so convert them to grams for that food.
- Weights are for the food as eaten: cooked or ready to eat (cooked rice, grilled chicken, boiled pasta), never raw or dry, unless the text says otherwise (e.g. "raw", "dry", "לא מבושל", "יבש", "נא", "לפני בישול"). Take per-100 g values for that same state.
- When the amount is vague or counted (e.g. "a small potato", "2 eggs", "a slice of bread"), estimate unit_grams (the weight of one unit) from typical Israeli sizes (a slice of bread ~30 g, a pita ~80 g, a tub of cottage ~250 g, a medium egg ~55 g, a small potato ~100 g). This is the only case where you may be approximate.
- When no amount is given at all, assume a typical single portion as served in Israel.
- Use typical home or cafe preparation, including the usual oil, unless the text says otherwise. Reflect it in the per-100 g values.
- Per-100 g values must be realistic for the specific food and variant named (e.g. cottage 5% vs 3%, chicken breast vs thigh, Greek vs regular yogurt). Prefer standard published values (USDA, Israeli Ministry of Health tables, or the package label if the brand is named).
- "name" is a short label for the whole meal in the user's own language and wording, at most 60 characters. Item names also stay in the user's language, and keep the quantity the user wrote (e.g. "2 כדורי בשר").
- If the text isn't food at all, return an empty items list.
- If there's a photo, identify the foods in it and estimate portions from what you see (plate size, utensils, packaging). Any text is extra context, like the portion eaten. With no text, write names in Hebrew.`

const IDEAS_SYSTEM = `You help someone close today's protein gap in their food diary. You get how much protein they still want (grams), how many calories they have left, and a list of their own saved meals (most eaten first), usually named in Hebrew.

- Suggest 4 options, each a single thing to eat, that add a good share of the missing protein while staying within the calories left. If almost no calories are left, pick the leanest high-protein options.
- Prefer their own saved meals when one fits: copy its name, kcal and protein exactly and set mine to true.
- Otherwise suggest everyday foods easy to get in Israel (cottage, yogurt, eggs, tuna, chicken, tofu, protein shake...), with a typical portion in the name, written in Hebrew, and set mine to false.
- kcal is a whole number; protein is grams, rounded to 0.5. Order from best fit to least.`

// What the model returns for text/photo: per-100 g values and a weight. The server does the multiplication
// (models are unreliable at it), so the totals are always the exact sum of the items.
const RAW_ITEM = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    count: { type: 'number' },
    unit_grams: { type: 'number' },
    per100_kcal: { type: 'number' },
    per100_protein: { type: 'number' },
  },
  required: ['name', 'count', 'unit_grams', 'per100_kcal', 'per100_protein'],
  additionalProperties: false,
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    items: { type: 'array' as const, items: RAW_ITEM },
  },
  required: ['name', 'items'],
  additionalProperties: false,
}

type RawEstimate = { name: string; items: { name: string; count: number; unit_grams: number; per100_kcal: number; per100_protein: number }[] }

/** grams x per-100 g -> the { name, kcal, protein, items } shape the app expects. kcal whole, protein to 0.5. */
function compute(raw: RawEstimate) {
  const items = raw.items.map((i) => {
    const count = Math.max(0, Number(i.count) || 0) || 1
    const unit = Math.max(0, Number(i.unit_grams) || 0)
    const grams = Math.round(count * unit)
    const f = grams / 100
    // Shown in the app so the user can see exactly what was multiplied.
    const basis = count === 1 ? `${grams} g` : `${count} × ${Math.round(unit)} g = ${grams} g`
    return {
      name: i.name,
      basis,
      kcal: Math.round(f * Math.max(0, Number(i.per100_kcal) || 0)),
      protein: Math.round(f * Math.max(0, Number(i.per100_protein) || 0) * 2) / 2,
    }
  })
  return {
    name: raw.name,
    kcal: items.reduce((s, i) => s + i.kcal, 0),
    protein: items.reduce((s, i) => s + i.protein, 0),
    basis: items.length === 1 ? items[0].basis : undefined,
    items,
  }
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
      // Medium effort: low made per-100 g recall sloppy; high isn't needed for a lookup-style task.
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'Could not estimate this one' }, 422)
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return json({ error: 'No estimate came back' }, 502)
    const parsed = JSON.parse(block.text)
    return json(body.mode === 'ideas' ? parsed : compute(parsed as RawEstimate))
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key is missing or wrong' }, 500)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many requests, try again in a moment' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic API error ${e.status}: ${e.message}` }, 502)
    return json({ error: String(e) }, 500)
  }
})
