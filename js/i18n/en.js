export default {
  app: { name: 'Mess Hishab' },
  common: {
    back: 'Back', cancel: 'Cancel', close: 'Close', save: 'Save', saved: 'Saved', delete: 'Delete', add: 'Add',
    copy: 'Copy', copied: 'Code {code} copied', optional: 'optional', you: 'you', meals: 'meals', loading: 'Loading…',
    error: 'Something went wrong. Please try again.', offline: 'Offline · will sync',
    offlineChart: 'Needs an internet connection the first time.', skip: 'Skip to content'
  },
  nav: { label: 'Main', today: 'Today', hishab: 'Hishab', mess: 'Mess', manager: 'Manager', settings: 'Settings', bazar: 'Bazar' },
  meal: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' },

  welcome: {
    title: 'Mess accounts, one tap a day.',
    subtitle: 'Tap the meals you eat. Mess Hishab works out the meal rate, your share and who owes whom — no notebook, no arguments.',
    create: 'Create account', login: 'Log in', demo: 'Try the demo mess', chip: 'Meal rate {rate} · auto'
  },
  auth: {
    google: 'Continue with Google', or: 'or', name: 'Your name', email: 'Email', password: 'Password',
    showPassword: 'Show password', hidePassword: 'Hide password',
    strength: { 0: 'At least {n} characters', 1: 'Weak — add numbers or symbols', 2: 'Good', 3: 'Strong password' },
    v: { name: 'Please enter your name.', email: 'Enter a valid email address.', password: 'Use at least {n} characters.', required: 'This field is required.' },
    err: {
      invalid: 'Email or password is incorrect.', emailInUse: 'An account already exists with this email. Try logging in.',
      weakPassword: 'That password is too weak.', invalidEmail: 'That email address doesn’t look right.',
      network: 'No internet connection. Check your network and try again.', tooMany: 'Too many attempts. Wait a minute and try again.',
      recentLogin: 'For your safety, log in again before doing this.', cancelled: 'Sign-in was cancelled.', unknown: 'Something went wrong. Please try again.'
    }
  },
  signup: { title: 'Create your account', subtitle: 'Takes less than a minute.', submit: 'Create account', haveAccount: 'Already have an account?' },
  login: {
    title: 'Welcome back', subtitle: 'Log in to see today’s meals and your hishab.', forgot: 'Forgot password?',
    submit: 'Log in', noAccount: 'New here?', demoHint: 'Demo login: {email} · {password}'
  },
  forgot: {
    title: 'Reset your password', subtitle: 'We’ll email you a link to set a new password.', submit: 'Send reset link',
    sentTitle: 'Check your inbox', sentBody: 'If an account exists for {email}, a reset link is on its way. Check the spam folder too.', back: 'Back to log in'
  },
  verify: {
    text: 'Verify {email} to keep your account safe.', resend: 'Resend email', demo: 'Verify now (demo)',
    sent: 'Verification email sent.', done: 'Email verified. Thank you!'
  },

  onboarding: {
    step: 'Step {n} of {total}', hello: 'Hi {name}!', subtitle: 'Start a new mess or join the one you live in.',
    create: 'Create a new mess', createHint: 'You’ll be the manager this month', join: 'Join with a code', joinHint: 'Ask your manager for the 6-letter code',
    createTitle: 'Name your mess', createSubtitle: 'Something everyone will recognise.', messName: 'Mess name',
    messNamePlaceholder: 'e.g. Green House Mess, Mohammadpur', messNameRequired: 'Please enter a name.', createSubmit: 'Create mess',
    joinTitle: 'Enter invite code', joinSubtitle: 'Six letters and numbers — you can paste it.', codeLabel: 'Invite code', joinSubmit: 'Join mess',
    invalidCode: 'That code doesn’t match any mess. Check it with your manager.',
    createdTitle: 'Your mess is ready', createdBody: 'Share this code so your messmates can join.', inviteCode: 'Invite code',
    joinedTitle: 'Welcome to {mess}', joinedBody: 'Tap your meals each day — the hishab takes care of itself.', start: 'Go to today'
  },

  today: {
    title: 'Today’s meals', morning: 'Good morning, {name}', afternoon: 'Good afternoon, {name}', evening: 'Good evening, {name}',
    today: 'Today', tomorrow: 'Tomorrow', whichDay: 'Which day', messTotal: 'Mess meals today', myBalance: 'My balance',
    mealsLabel: 'Your meals', tapHint: 'Tap the meals you’ll eat.', until: 'Until {time}', forTomorrow: 'For tomorrow',
    locked: 'Time’s up — ask the manager', lockedManager: 'Past cutoff · manager edit',
    guests: 'Guests', guestsHint: 'Each guest counts as one meal', whoEats: 'Who’s eating',
    otherMonth: 'That day belongs to another month.',
    monthNotStarted: 'This month is closed. {month} starts on the 1st — mark your meals from then.'
  },
  hishab: {
    title: 'My hishab', youOwe: 'You owe', youGet: 'You get back', settled: 'All settled',
    covered: '{pct}% covered', pending: '{amount} waiting for manager', pay: 'Add a deposit',
    meals: 'My meals', mealRate: 'Meal rate', mealCost: 'Meal cost', fixedShare: 'Fixed share', paid: 'Paid', balance: 'Balance',
    last30: 'Last 30 days', last30Hint: 'Saved daily, kept for 30 days', chartEmpty: 'Your chart appears after a couple of days.',
    pastMonths: 'Saved months', noPast: 'No closed months yet', noPastHint: 'When the manager closes a month, your result is saved here.'
  },
  retention: {
    keptUntil: 'Kept until {date}', expiresIn: 'Deleted in {n} days — download it',
    warn: 'This month will be deleted in {n} days. Download the PDF or CSV if you want to keep it.'
  },
  pay: {
    title: 'Add deposit', subtitle: 'Send the money to your manager, then record it here. It counts once they confirm.',
    subtitleManager: 'You hold the mess fund, so your own deposit counts straight away.',
    amount: 'Amount', method: 'Paid with', cash: 'Cash', trx: 'Transaction ID', submit: 'Enter an amount',
    submitAmount: 'Record {amount}', doneTitle: '{amount} sent for confirmation', doneBody: 'Your manager will confirm it. You’ll see it in your hishab right after.',
    doneTitleManager: '{amount} added', doneBodyManager: 'It’s already counted in your balance.', backToHishab: 'Back to my hishab'
  },
  mess: {
    fund: 'Bazar fund', fundHint: 'Deposits collected vs. this month’s projected cost', totalMeals: 'Total meals', totalBazar: 'Total bazar',
    members: 'Members', manager: 'Manager', owes: 'owes', gets: 'gets back', recentBazar: 'Recent bazar', addBazar: 'Add bazar',
    noBazar: 'No bazar this month yet.', copyCode: 'Copy invite code'
  },
  bazar: {
    title: 'Add bazar', amount: 'Bazar amount', shopper: 'Who shopped', paidFrom: 'Paid from', fromFund: 'Mess fund', fromPocket: 'Own pocket',
    fundHint: 'Paid with money from the mess fund.', pocketHint: 'The shopper paid — it counts as their deposit.',
    note: 'What was bought', date: 'Date', save: 'Enter an amount', saveAmount: 'Save {amount}', saved: 'Bazar of {amount} saved',
    defaultNote: 'Bazar', pocketShort: 'own pocket', suggestions: 'Rice, dal, oil|Fish & vegetables|Chicken|Eggs & bread|Spices'
  },
  manager: {
    pending: 'Waiting for you', noPending: 'No deposits waiting. All caught up!', confirm: 'Confirm', reject: 'Reject',
    confirmed: 'Deposit confirmed', rejected: 'Deposit rejected',
    fixedCosts: 'Fixed costs', fixedLabel: 'e.g. Bua', fixedAmount: 'Amount', noFixed: 'No fixed costs yet.',
    fixedSuggestions: 'Bua (cook)|Gas|Wi-Fi|Electricity|Water', perHead: 'Per head ({n} members)', deleteFixed: 'Delete this cost?',
    editMeals: 'Edit anyone’s meals', member: 'Member', editHint: 'As manager you can edit past days and after the cutoff.',
    closeTitle: 'Close the month', closeBody: 'Finish {month} and settle up', closePreview: 'Meal rate {rate} · {n} payments to settle · saved {days} days',
    closeButton: 'Close month', closeConfirmTitle: 'Close {month}?',
    closeConfirmBody: 'Meals and costs get locked and everyone’s result is saved for {days} days. These payments settle the month:'
  },
  settle: {
    title: 'Month settlement', closed: '{month} closed', yourResult: 'Your result', transfers: 'Who pays whom',
    fund: 'Mess fund (manager)', nothing: 'Everyone is even — nothing to pay.', saved: 'Saved for {n} days · until {date}',
    share: 'Share', downloaded: 'Image saved', startNext: 'Start {month}',
    notFound: 'This month isn’t available', notFoundHint: 'It may still be open, or it was deleted after the retention period.'
  },
  settings: {
    verified: 'Verified', unverified: 'Not verified', language: 'Language',
    messRules: 'Mess rules', managerOnly: 'Manager only', cutoffs: 'Meal cutoff times',
    breakfastWeight: 'Breakfast counts as', fullMeal: '1 meal', halfMeal: '½ meal',
    retention: 'Keep calculation data for', days: '{n} days', retentionHint: 'Minimum 30 days. Results and daily snapshots are deleted automatically after this.',
    handover: 'Hand over manager role', handoverButton: 'Hand over', handoverConfirm: 'Make {name} the manager?',
    handoverBody: 'They will confirm deposits and close the month. You become a member.',
    handoverFirst: 'Hand the manager role to someone else first.',
    data: 'Your data', dataHint: 'Your monthly results and daily snapshots are kept for at least {n} days.',
    downloadAll: 'Download all my data', resetDemo: 'Reset demo mess', resetDemoBody: 'Rebuilds the demo mess with fresh sample data.',
    resetDone: 'Demo mess reset', logout: 'Log out', leave: 'Leave this mess', leaveBody: 'You will stop seeing this mess. Saved results stay until they expire.',
    deleteAccount: 'Delete account', deleteBody: 'This permanently deletes your account and profile. It cannot be undone.'
  },
  invite: { message: 'Join our mess "{mess}" on Mess Hishab 🍛\nInvite code: {code}\n{url}' },
  csv: { date: 'Date' }
};
