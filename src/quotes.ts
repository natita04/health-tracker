const QUOTES: [string, string][] = [
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Habits are the compound interest of self-improvement.', 'James Clear'],
  ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Fall seven times, stand up eight.', 'Japanese proverb'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Proverb'],
  ['Hard choices, easy life. Easy choices, hard life.', 'Jerzy Gregorek'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ["You miss 100% of the shots you don't take.", 'Wayne Gretzky'],
  ['I am not a product of my circumstances. I am a product of my decisions.', 'Stephen Covey'],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
  ["Take care of your body. It's the only place you have to live.", 'Jim Rohn'],
  ['Our bodies are our gardens, to the which our wills are gardeners.', 'William Shakespeare, Othello'],
  ['Caring for myself is not self-indulgence, it is self-preservation.', 'Audre Lorde'],
  ['Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott'],
  ['Motivation is what gets you started. Habit is what keeps you going.', 'Jim Ryun'],
  ['The groundwork for all happiness is good health.', 'Leigh Hunt'],
  ["Don't count the days, make the days count.", 'Muhammad Ali'],
  ['The man who moves a mountain begins by carrying away small stones.', 'Proverb'],
  ['Consistency beats intensity.', 'Unknown'],
  ['Small steps every day add up to big results.', 'Unknown'],
  ["You don't have to be extreme, just consistent.", 'Unknown'],
  ['Be stronger than your excuses.', 'Unknown'],
  ['Progress, not perfection.', 'Unknown'],
  ["The only bad workout is the one that didn't happen.", 'Unknown'],
  ['Every day is a fresh start.', 'Unknown'],
]

export const quoteFor = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const day = Date.UTC(y, m - 1, d) / 86_400_000
  const [text, author] = QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length]
  return { text, author }
}
