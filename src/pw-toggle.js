// Show/hide ("eye") button for every password field, including fields the page creates later.
// UI only: it changes the input type in the browser and never reads, stores or sends the value.
const ICON_SHOW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
const ICON_HIDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18.4 18.4 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.1 9.1 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>'
const AUTO_HIDE_MS = 15000 // the password hides itself again after 15 s

function addToggle(input) {
  if (input.dataset.eye || !input.parentNode) return
  input.dataset.eye = '1'
  const wrap = document.createElement('div')
  wrap.className = 'pw'
  input.parentNode.insertBefore(wrap, input)
  wrap.appendChild(input)
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'pw-eye'
  wrap.appendChild(btn)
  let timer
  const set = (show) => {
    input.type = show ? 'text' : 'password'
    btn.innerHTML = show ? ICON_HIDE : ICON_SHOW
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password')
    btn.setAttribute('aria-pressed', show ? 'true' : 'false')
    clearTimeout(timer)
    if (show) timer = setTimeout(() => set(false), AUTO_HIDE_MS)
  }
  btn.addEventListener('click', () => set(input.type === 'password'))
  set(false)
}

const scan = () => document.querySelectorAll('input[type="password"]:not([data-eye])').forEach(addToggle)
scan()
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
