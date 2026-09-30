import { ALL_DAYS, type Category, type Task, type Video } from './types'

/**
 * The built-in plan, copied into your account the first time you sign in.
 *
 * To add a new default item later: give it `since: VERSION + 1` and bump VERSION.
 * Only items newer than what your account already has get added, so your own edits,
 * removed items and history are never touched. (Or just add items in the Plan tab.)
 */
export const VERSION = 1

// Monday = bit 0 ... Sunday = bit 6
const MON = 1, WED = 4, THU = 8, FRI = 16, SAT = 32, SUN = 64

const yt = (title: string, id: string): Video => ({ title, url: `https://www.youtube.com/watch?v=${id}` })
const hm = (h: number, m = 0) => h * 60 + m

export const BASIC_WORKOUT: string[] = [
  '# Warm-up (2 min)',
  '30s march in place',
  '30s arm circles, forward and back',
  '30s hip circles',
  '30s bodyweight good mornings',
  '# 3 rounds, rest 45s between rounds (~12 min)',
  '15 squats',
  '10 reverse lunges per leg',
  '15 glute bridges',
  '10 push-ups (on your knees is fine)',
  '10 bird dogs per side',
  '10 dead bugs per side',
  '# Cool-down (1 min)',
  '20s hamstring stretch',
  '20s quad stretch per leg',
  "20s child's pose",
]

type Item = Omit<Task, 'sort_order' | 'archived'> & { since: number }

let order = 0
const t = (
  id: string, category: Category, title: string,
  o: Partial<Pick<Task, 'details' | 'duration_min' | 'days_mask' | 'time_minutes' | 'videos' | 'steps'>> = {},
): Item & { sort_order: number } => ({
  since: 1, id, category, title, details: '', duration_min: null, days_mask: ALL_DAYS,
  time_minutes: null, videos: null, steps: null, ...o, sort_order: order++,
})

const ITEMS = [
  t('weigh_in', 'WEIGH', 'Weigh yourself', { details: 'Morning, after the bathroom, before eating or drinking.', days_mask: THU }),

  t('walk_10k', 'WALK', 'Walk 10,000 steps', { details: 'Spread across the day.' }),

  // Eltroxin needs a 4h gap from iron, multivitamin and magnesium. Iron and coffee/tea don't mix,
  // and iron is best kept ~2h away from the multivitamin (calcium) too.
  t('med_eltroxin', 'MEDS', 'Eltroxin', { details: 'First thing, empty stomach, water only. Wait 30-60 min before breakfast or coffee.', time_minutes: hm(5) }),
  t('med_iron', 'MEDS', 'Iron', { details: 'Keep 1-2h away from coffee and tea. Best with vitamin C (e.g. orange juice), no dairy around it.', time_minutes: hm(11, 30) }),
  t('med_multivitamin', 'MEDS', 'Multivitamin', { details: 'With lunch.', time_minutes: hm(13, 30) }),
  t('med_omega3', 'MEDS', 'Omega 3', { details: 'With lunch, fat in the meal helps absorption.', time_minutes: hm(13, 30) }),
  t('med_magnesium', 'MEDS', 'Magnesium', { details: 'Evening, helps you wind down.', time_minutes: hm(21) }),

  t('basic_daily', 'WORKOUT', 'Basic daily workout', { details: '15 min · bodyweight, no equipment', duration_min: 15, steps: BASIC_WORKOUT }),

  // 45 min: Sun lower, Mon upper, Wed lower, Fri full body. 3 Heather Robertson options each.
  t('full_sun_lower', 'WORKOUT', 'Lower body strength', { details: '~45 min · Heather Robertson · dumbbells', duration_min: 45, days_mask: SUN, videos: [
    yt('Fierce Day 2: Lower Body Strength (45 min)', 'C6MyDJMddYE'),
    yt('Fierce 2.0 Day 2: Unilateral Leg Workout', '7QLEmnP9VyI'),
    yt('Fierce 3.0 Day 2: Lower Body Strength', 'EexpjrAPvj4'),
  ] }),
  t('full_mon_upper', 'WORKOUT', 'Upper body strength', { details: '~45 min · Heather Robertson · dumbbells', duration_min: 45, days_mask: MON, videos: [
    yt('Fierce Day 1: Arms & Shoulders (49 min)', 'LF-fA0g9KNg'),
    yt('HR12WEEK 2.0: Upper Body Push (40 min)', 'sa8RJQy8kps'),
    yt('HR12WEEK 2.0: Upper Body Pull (40 min)', 'R1HR5_KK5ac'),
  ] }),
  t('full_wed_lower', 'WORKOUT', 'Leg day', { details: '~45 min · Heather Robertson · dumbbells', duration_min: 45, days_mask: WED, videos: [
    yt('Killer Leg Day // Lower Body Strength (41 min)', 'eemRXHKsGIc'),
    yt('Fierce 2.0 Day 8: Powerful Lean Legs', 'BcnFHqyfVq4'),
    yt('Fierce 2.0 Day 12: Booty & Thigh', 'PFxRdrY6KWQ'),
  ] }),
  t('full_fri_full', 'WORKOUT', 'Full body strength', { details: '~45 min · Heather Robertson · dumbbells', duration_min: 45, days_mask: FRI, videos: [
    yt('Fierce Day 14: Total Body Strength & Cardio (43 min)', 'HpKRKd3R8A0'),
    yt('Fierce 2.0 Day 14: Full Body MetCon', '0H7s_KF9a3A'),
    yt('Fierce 3.0 Day 14: Full Body Strength & Power', '8Lre3HGIAjs'),
  ] }),

  t('beauty_vibration', 'BEAUTY', 'Vibration plate', { details: '10 min', duration_min: 10 }),
  t('beauty_red_light', 'BEAUTY', 'Red light', { details: '10 min', duration_min: 10 }),
  t('beauty_legs_wall', 'BEAUTY', 'Legs up the wall', { details: '10 min', duration_min: 10 }),
  t('beauty_dry_brush', 'BEAUTY', 'Dry brushing', { details: '10 min', duration_min: 10 }),
  t('beauty_face', 'BEAUTY', 'Face therapy', { details: 'Weekly', days_mask: FRI }),
  t('beauty_hair', 'BEAUTY', 'Hair therapy', { details: 'Weekly', days_mask: SAT }),
]

export const newSince = (version: number): Omit<Task, 'archived'>[] =>
  ITEMS.filter((i) => i.since > version).map(({ since: _since, ...task }) => task)

export const MORE_WORKOUTS_URL = 'https://www.youtube.com/@Heatherrobertsoncom/videos'
