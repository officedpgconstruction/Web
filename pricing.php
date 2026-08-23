<?php
// pricing.php — DPG's own rate table. THE AI NEVER INVENTS PRICES.
//
// How the photo estimator works:
//   1. Gemini looks at the photos and identifies WHAT work is visible
//      (trades involved, condition, approximate size, complexity).
//   2. THIS FILE turns that scope into a dollar range, using YOUR numbers.
//
// That split is deliberate. If the AI produced the dollars, DPG would be held to
// numbers nobody at DPG ever set. Here, every number on screen is yours.
//
// ⚠️ THE RATES BELOW ARE PLACEHOLDERS — replace every one with your real
// numbers before this goes live. Until you do, the estimator shows a warning
// instead of a range.
//
// Rates are per square foot of the affected area unless noted. Give a low and a
// high: the low is a clean, straightforward job, the high is one with surprises.

return [

  // Set to true once you have replaced the placeholder rates below.
  'rates_confirmed' => false,

  // How wide to open the range on top of low/high, as a safety margin.
  // 0.15 = widen the range by 15% on each side. Raise it if you'd rather be vague.
  'uncertainty' => 0.15,

  // Finish level multipliers applied to the base rate.
  'finish_multiplier' => [
    'basic'   => 0.80,   // builder-grade materials
    'mid'     => 1.00,   // the baseline your rates below assume
    'premium' => 1.55,   // high-end tile, stone, custom cabinetry
  ],

  // Condition multipliers — the AI reports condition from the photos.
  'condition_multiplier' => [
    'good'  => 1.00,   // cosmetic update, sound underneath
    'fair'  => 1.15,   // some repair expected
    'poor'  => 1.40,   // water damage, rot, structural repair likely
  ],

  // ---- PER-TRADE RATES ($ per square foot of affected area) ----
  // PLACEHOLDER NUMBERS. Replace with your real cost + margin.
  'trades' => [
    'kitchen'    => ['label' => 'Kitchen remodel',        'low' => 0, 'high' => 0, 'min_job' => 0],
    'bathroom'   => ['label' => 'Bathroom remodel',       'low' => 0, 'high' => 0, 'min_job' => 0],
    'flooring'   => ['label' => 'Flooring & interior',    'low' => 0, 'high' => 0, 'min_job' => 0],
    'painting'   => ['label' => 'Painting',               'low' => 0, 'high' => 0, 'min_job' => 0],
    'deck'       => ['label' => 'Deck & outdoor',         'low' => 0, 'high' => 0, 'min_job' => 0],
    'fireplace'  => ['label' => 'Fireplace',              'low' => 0, 'high' => 0, 'min_job' => 0],
    'roofing'    => ['label' => 'Roofing',                'low' => 0, 'high' => 0, 'min_job' => 0],
    'framing'    => ['label' => 'Framing & foundation',   'low' => 0, 'high' => 0, 'min_job' => 0],
    'renovation' => ['label' => 'Full renovation',        'low' => 0, 'high' => 0, 'min_job' => 0],
  ],

  // ---- ROUGH DURATION (crew-days per 100 sq ft) ----
  // Also placeholders. Used only to show a coarse "working days" band.
  'days_per_100sf' => [
    'kitchen'    => 0, 'bathroom' => 0, 'flooring'  => 0,
    'painting'   => 0, 'deck'     => 0, 'fireplace' => 0,
    'roofing'    => 0, 'framing'  => 0, 'renovation'=> 0,
  ],
];
