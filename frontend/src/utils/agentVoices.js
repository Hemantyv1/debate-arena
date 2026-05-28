let voices = typeof window !== 'undefined' && window.speechSynthesis
  ? window.speechSynthesis.getVoices()
  : [];

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
  };
}

export function speakAs(agent, text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  if (agent === 'AXIOM') {
    utterance.voice = voices.find(v => v.name.includes('David') || v.name.includes('UK English Male')) || voices[0];
    utterance.rate = 0.88;
    utterance.pitch = 0.75;
    utterance.volume = 1;
  } else {
    utterance.voice = voices.find(v => v.name.includes('Zira') || v.name.includes('Google UK English Female')) || voices[1];
    utterance.rate = 1.05;
    utterance.pitch = 1.15;
    utterance.volume = 1;
  }

  utterance.text = text.replace(/[*_`#]/g, '');
  window.speechSynthesis.speak(utterance);
}
