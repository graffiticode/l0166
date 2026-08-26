// Ported from learnosity-integrations/sharedAssessmentScript.js.
(() => {
  const redirectSection = document.querySelector('#redirect_response');
  const requestJsonTextarea = document.querySelector('.client-request-json > textarea');

  if (requestJsonTextarea) {
    requestJsonTextarea.value = JSON.stringify(window.activity, null, 2);
  }

  if (!redirectSection) {
    return;
  }

  const reload = (state) => {
    window.location.href = `?state=${state}&session_id=${window.activity.session_id}`;
  };

  redirectSection
    .querySelector('button[data-action="resume"]')
    .addEventListener('click', () => reload('resume'));

  redirectSection
    .querySelector('button[data-action="review"]')
    .addEventListener('click', () => reload('review'));

  window.__onSaveSuccess = () => {
    redirectSection.classList.remove('client-hidden');
  };
})();
