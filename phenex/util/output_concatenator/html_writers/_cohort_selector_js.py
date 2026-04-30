# Shared cohort-selector toggle buttons.  Each HTML writer includes this
# before its own JS.  Call ``initCohortSelector(cohortNames, containerId,
# onRender)`` to create the buttons; it returns the ``selected`` Set.

_COHORT_SELECTOR_JS = """\
var COLORS = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
              '#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab'];

function initCohortSelector(cohortNames, containerId, onRender) {
  var selected = new Set(cohortNames.length ? [cohortNames[0]] : []);
  var controls = document.getElementById(containerId);

  cohortNames.forEach(function(name, ci) {
    var btn = document.createElement('button');
    btn.className = 'cohort-btn';
    btn.textContent = name;
    btn.dataset.cohort = name;
    btn.dataset.ci = ci;
    btn.addEventListener('click', function() {
      if (selected.has(name)) selected.delete(name); else selected.add(name);
      updateButtons();
      onRender();
    });
    controls.appendChild(btn);
  });

  function updateButtons() {
    var btns = controls.querySelectorAll('.cohort-btn');
    btns.forEach(function(b) {
      var ci = +b.dataset.ci;
      var col = COLORS[ci % COLORS.length];
      if (selected.has(b.dataset.cohort)) {
        b.classList.add('active');
        b.style.borderColor = col; b.style.background = col; b.style.color = '#fff';
      } else {
        b.classList.remove('active');
        b.style.borderColor = '#ccc'; b.style.background = '#fff'; b.style.color = '#333';
      }
    });
  }

  updateButtons();
  return selected;
}
"""
