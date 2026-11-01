/* SEPTLION smart need: contextual interpretation, preserve original UI and legacy fallback. */
const SMART_NEED_V1 = true;
const SMART_ENDPOINT = 'https://septlion-web-production.up.railway.app/api/interpret-requirement';
let smartHistory = [], smartBusy = false;
async function send(text){
  const t = (text ?? input.value).trim();
  if(!t || smartBusy) return;
  smartBusy = true;
  const button = $('#chatSend');
  button.disabled = true;
  const pending = document.createElement('div');
  pending.className = 'typing';
  pending.innerHTML = '<i></i><i></i><i></i>';
  feedEl.append(pending);
  feedEl.scrollTop = feedEl.scrollHeight;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    let response;
    try {
      response = await fetch(SMART_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ text: [...smartHistory, t].join('\n') })
      });
    } finally { clearTimeout(timeout); }
    if(!response.ok) throw Error('guidance unavailable');
    const result = await response.json();
    if(!result || typeof result.result !== 'string' || !result.result.trim() || typeof result.ready !== 'boolean')
      throw Error('invalid guidance');
    pending.remove();
    input.value = '';
    input.style.height = '';
    $('#welcome')?.remove();
    $('#samples')?.remove();
    feedEl.querySelectorAll('.proceed').forEach(el => el.remove());
    addMsg(t, 'user');
    smartHistory.push(t);
    topic = smartHistory.join('\n');
    extra = '';
    stage = result.ready ? 'ready' : 'details';
    botSay(result.result.slice(0, 1000), result.ready ? proceedCard : undefined);
  } catch(err) {
    pending.remove();
    // Never prevent the visitor from using the original deterministic composer.
    legacySend(t);
    if(t.length > 4) smartHistory.push(t);
  } finally {
    smartBusy = false;
    button.disabled = false;
  }
}
