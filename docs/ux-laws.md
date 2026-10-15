# UX laws → decisions

Each law below maps to something concrete in the product, with the file that implements it.

| Law | Where | What it changed | Implementation |
|---|---|---|---|
| **Hick's Law** — more choices, slower decisions | Welcome, Today | Welcome offers two actions (create / log in). Today offers three meal toggles and a guest stepper — nothing else to decide. Onboarding asks one question per step. | `AuthViews.js` (WelcomeView), `TodayView.js`, `OnboardingView.js` |
| **Fitts's Law** — big, close targets are faster | Today, Pay, Bazar | Meal toggles are 76 px tall and full width, pushed into the bottom thumb zone on phones (`.today__meals { margin-top: auto }`). Keypad keys are 58 px; primary buttons 56 px; bottom navigation instead of a hamburger. | `app.css` (`.meal-toggle`, `.keypad__key`, `.btn-xl`, `.today__main`) |
| **Tesler's Law** — complexity has to live somewhere | Whole app | Members only enter facts (meals, amounts). Meal rate, balances, fixed-cost split, fund cash and settlement are all computed. Bazar defaults to today, "you" as shopper and "paid from fund". Firebase handles password resets. | `HishabCalculator.js`, `BazarView.js` |
| **Zeigarnik Effect** — unfinished tasks stay on our mind | My Hishab, shell | The dues ring stays open (and red) until the balance is cleared. The email-verification banner persists until verified. Saved months show "kept until <date>", and a warning appears three days before deletion. | `HishabView.js`, `App.verifyBanner()`, `RetentionPolicy.isExpiringSoon` |
| **Goal-Gradient Effect** — effort rises near the goal | Onboarding, Mess | Step dots grow as you progress through onboarding. The bazar-fund bar shows deposits collected against the projected month cost. | `.step-dots`, `MessView.js`, `HishabCalculator.projectedMonthCost` |
| **Peak-End Rule** — people judge by the peak and the end | Month close | The month ends on a calm, branded settlement card: one clear list of who pays whom, your own result highlighted, "saved for N days", shareable as an image or PDF. | `SettlementView.js`, `.settle-card`, `StatementExporter.js` |
| **Jakob's Law** — users expect what they already know | Pay, Auth | The deposit screen copies the bKash/Nagad send-money pattern: big amount, numeric keypad, method chips, TrxID. Auth screens follow standard conventions (Google first, "Forgot password?" under the field). | `PayView.js`, `AmountKeypad` |
| **Miller's Law** — chunk information | Hishab, Mess | Five stat cards on My Hishab; three summary chips on Mess; sign-up has three fields; settlement uses three headline numbers. | `HishabView.js`, `MessView.js` |
| **Doherty Threshold** — responses under 400 ms keep flow | Today | Meal taps flip instantly (optimistic UI) and persist in the background, with rollback on failure. Skeletons instead of spinners; numbers count up. | `App.saveMeal`, `TodayView.onDataChange`, `countUp` |
| **Von Restorff Effect** — the different thing gets noticed | Manager, money | Pending deposit confirmations are the only tinted block on the manager screen, with a red badge on the tab. Red is reserved for "you owe". | `.attention-card`, `.nav-badge`, `.money-neg` |
| **Law of Common Region / Similarity** | Mess, Settings | Each member is one card with a stable avatar colour (hashed from their id) wherever they appear; owes/gets colours are consistent everywhere. Settings are grouped into cards. | `hueFor()`, `.member-card`, `SettingsView.js` |
| **Postel's Law** — be liberal in what you accept | Amounts, codes, email | Amounts accept "৳1,250", "1250", "১২৫০", "১,২৫০ টাকা"; invite codes accept lowercase and paste; emails are trimmed and lower-cased. | `Money.parse`, `OnboardingView.bindCodeBoxes`, `AuthRules.normalizeEmail` |
| **Aesthetic-Usability Effect** | Everywhere | A calm teal fintech palette, tuned Bangla typography (Hind Siliguri, 1.6 line height), tabular numerals and a careful dark theme — trust matters when the app handles money. | `app.css` tokens |

## Accessibility

- WCAG AA contrast in both themes (dark mode uses dark text on the brand colour for primary buttons).
- Visible focus rings, skip link, `aria-pressed` on toggles, `role="radiogroup"` on segmented controls, live regions for amounts and toasts.
- Touch targets ≥ 44 px; hover styles only on hover-capable pointers; `prefers-reduced-motion` respected.
- `lang` switches between `bn` and `en` so screen readers pronounce text correctly.
