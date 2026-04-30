# JavaScript for the interactive KM survival curves HTML.  Kept as a plain
# string constant so the Python f-string in _build_tte_html only handles
# the data injection; all JS braces are literal.
_TTE_JS = """\
var NS = 'http://www.w3.org/2000/svg';

/* ── index cohort data by outcome ────────────────────────────────────── */
var cohortNames = DATA.map(function(c){ return c.cohort_name; });
var selected = initCohortSelector(cohortNames, 'controls', render);

/* ── risk-times input ─────────────────────────────────────────────────── */
var riskTimesInput = document.getElementById('risk-times-input');
if(RISK_TIMES && RISK_TIMES.length){ riskTimesInput.value = RISK_TIMES.join(', '); }
riskTimesInput.addEventListener('change', function(){ render(); });

function getActiveTicks(maxT){
  var raw = riskTimesInput.value.trim();
  if(raw){
    var parsed = raw.split(/[\s,]+/).map(Number).filter(function(n){ return isFinite(n) && n>=0; });
    if(parsed.length) return parsed.filter(function(t){ return t<=maxT; });
  }
  return riskTicks(maxT, 6);
}

/* per-cohort, per-outcome sorted row arrays */
var cohortOutcomes = {};   // cohortName -> { outcomeName -> [rows] }
var allOutcomes = [];      // ordered unique outcome names
var outcomeSet = {};
DATA.forEach(function(c){
  var byOc = {};
  c.rows.forEach(function(r){
    if(!byOc[r.Outcome]){ byOc[r.Outcome] = []; }
    byOc[r.Outcome].push(r);
    if(!outcomeSet[r.Outcome]){ outcomeSet[r.Outcome]=1; allOutcomes.push(r.Outcome); }
  });
  Object.keys(byOc).forEach(function(k){ byOc[k].sort(function(a,b){return a.Timeline-b.Timeline;}); });
  cohortOutcomes[c.cohort_name] = byOc;
});

/* ── SVG helpers ─────────────────────────────────────────────────────── */
function el(tag,attrs,parent){
  var e=document.createElementNS(NS,tag);
  if(attrs) Object.keys(attrs).forEach(function(k){e.setAttribute(k,attrs[k]);});
  if(parent) parent.appendChild(e);
  return e;
}
function txt(text,attrs,parent){var e=el('text',attrs,parent);e.textContent=text;return e;}

/* ── step-function path builder ──────────────────────────────────────── */
function stepPath(rows, sx, sy, field){
  var d='';
  for(var i=0;i<rows.length;i++){
    var x=sx(rows[i].Timeline), y=sy(rows[i][field]);
    if(i===0){ d+='M'+sx(0)+','+sy(1)+' L'+x+','+sy(1)+' L'+x+','+y; }
    else { d+=' L'+x+','+sy(rows[i-1][field])+' L'+x+','+y; }
  }
  return d;
}

/* CI band: closed polygon upper-forward then lower-backward */
function ciBand(rows, sx, sy){
  if(!rows.length || rows[0].CI_Lower==null) return '';
  var upper='', lower='';
  for(var i=0;i<rows.length;i++){
    var x=sx(rows[i].Timeline);
    var yu=sy(rows[i].CI_Upper), yl=sy(rows[i].CI_Lower);
    if(i===0){
      upper+='M'+sx(0)+','+sy(1);
      lower='L'+sx(0)+','+sy(1);
      upper+=' L'+x+','+sy(1)+' L'+x+','+yu;
      lower=' L'+x+','+sy(1)+' L'+x+','+yl+lower;
    } else {
      upper+=' L'+x+','+sy(rows[i-1].CI_Upper)+' L'+x+','+yu;
      lower=' L'+x+','+sy(rows[i-1].CI_Lower)+' L'+x+','+yl+lower;
    }
  }
  return upper+lower+'Z';
}

/* ── risk-table tick positions ───────────────────────────────────────── */
function riskTicks(maxT, n){ var a=[]; for(var i=0;i<=n;i++) a.push(Math.round(maxT/n*i)); return a; }
function lookupAtTick(rows, t, field){
  var v=null;
  for(var i=0;i<rows.length;i++){
    if(rows[i].Timeline<=t) v=rows[i][field]; else break;
  }
  return v;
}

/* cumulative events / censored up to tick */
function cumField(rows, t, field){
  var s=0;
  for(var i=0;i<rows.length;i++){
    if(rows[i].Timeline>t) break;
    s+=(rows[i][field]||0);
  }
  return s;
}

/* ── main render ─────────────────────────────────────────────────────── */
var chartsDiv = document.getElementById('charts');
function render(){
  chartsDiv.innerHTML='';
  var sel = Array.from(selected);
  if(!sel.length) return;

  allOutcomes.forEach(function(outcomeName){
    /* collect data series for selected cohorts that have this outcome */
    var series=[];
    sel.forEach(function(cn){
      var oc = cohortOutcomes[cn];
      if(oc && oc[outcomeName] && oc[outcomeName].length){
        series.push({name:cn, rows:oc[outcomeName], ci:cohortNames.indexOf(cn)});
      }
    });
    if(!series.length) return;

    var section = document.createElement('div');
    section.className='outcome-section';
    chartsDiv.appendChild(section);

    var title = document.createElement('p');
    title.className='outcome-title';
    title.textContent = outcomeName;
    section.appendChild(title);

    /* compute shared x-axis max */
    var maxT=1;
    series.forEach(function(s){
      var last=s.rows[s.rows.length-1].Timeline;
      if(last>maxT) maxT=last;
    });

    var ticks = getActiveTicks(maxT);

    var W=780, PAD_L=250, PAD_R=20, PAD_T=20, PAD_B=30;
    var RISK_ROW_H=16, RISK_ROWS=3; /* at_risk, events, censored */
    var RISK_H = series.length * RISK_ROWS * RISK_ROW_H + 20;
    var plotH=250;
    var H = PAD_T + plotH + PAD_B + RISK_H;
    var plotW = W - PAD_L - PAD_R;

    function sx(t){ return PAD_L + (t/maxT)*plotW; }
    function sy(p){ return PAD_T + (1-p)*plotH; }

    var svg = el('svg',{width:W, height:H});
    svg.style.display='block';
    section.appendChild(svg);

    /* grid + axes */
    el('line',{x1:PAD_L,y1:PAD_T,x2:PAD_L,y2:PAD_T+plotH,stroke:'#ccc'},svg);
    el('line',{x1:PAD_L,y1:PAD_T+plotH,x2:PAD_L+plotW,y2:PAD_T+plotH,stroke:'#ccc'},svg);
    [0,0.25,0.5,0.75,1.0].forEach(function(v){
      var y=sy(v);
      el('line',{x1:PAD_L-4,y1:y,x2:PAD_L,y2:y,stroke:'#999'},svg);
      el('line',{x1:PAD_L,y1:y,x2:PAD_L+plotW,y2:y,stroke:'#f0f0f0'},svg);
      txt(v.toFixed(2),{x:PAD_L-8,y:y+4,'text-anchor':'end','font-size':11,fill:'#666'},svg);
    });
    ticks.forEach(function(t){
      var x=sx(t);
      el('line',{x1:x,y1:PAD_T+plotH,x2:x,y2:PAD_T+plotH+4,stroke:'#999'},svg);
      txt(t,{x:x,y:PAD_T+plotH+16,'text-anchor':'middle','font-size':11,fill:'#666'},svg);
    });
    txt('Days',{x:PAD_L+plotW/2,y:PAD_T+plotH+PAD_B-2,'text-anchor':'middle','font-size':12,fill:'#666'},svg);
    var yl=txt('Survival Probability',{x:14,y:PAD_T+plotH/2,'text-anchor':'middle','font-size':12,fill:'#666'},svg);
    yl.setAttribute('transform','rotate(-90,14,'+(PAD_T+plotH/2)+')');

    /* draw each cohort series */
    series.forEach(function(s){
      var color = COLORS[s.ci % COLORS.length];
      /* CI band */
      var ciD = ciBand(s.rows, sx, sy);
      if(ciD) el('path',{d:ciD,fill:color,'fill-opacity':0.12,stroke:'none'},svg);
      /* KM step line */
      el('path',{d:stepPath(s.rows,sx,sy,'Survival_Probability'),fill:'none',stroke:color,'stroke-width':2},svg);
    });

    /* ── risk table below plot ───────────────────────────────────────── */
    var riskTop = PAD_T + plotH + PAD_B + 4;
    /* separator line */

    var labels = ['At risk','Events','Censored'];
    var fields = ['At_Risk','Events','Censored'];
    series.forEach(function(s, si){
      var color = COLORS[s.ci % COLORS.length];
      var baseY = riskTop + si * RISK_ROWS * RISK_ROW_H;

      labels.forEach(function(lbl, li){
        var rowY = baseY + li * RISK_ROW_H + RISK_ROW_H - 2;
        /* label */
        if(si===0){
          /* only the first cohort prints the row labels to avoid overlap;
             when multiple cohorts are shown the cohort name is the label */
        }
        var labelText = (series.length>1 && li===0) ? s.name : (si===0 ? lbl : '');
        if(li===0 && series.length>1){
          txt(s.name,{x:PAD_L-150,y:rowY,'text-anchor':'end','font-size':10,fill:color,'font-weight':'bold'},svg);
        } else if(series.length===1){
          txt(lbl,{x:PAD_L-150,y:rowY,'text-anchor':'end','font-size':10,fill:'#666'},svg);
        }

        /* values at each tick */
        ticks.forEach(function(t){
          var val;
          if(fields[li]==='At_Risk'){
            val = lookupAtTick(s.rows, t, 'At_Risk');
          } else {
            val = cumField(s.rows, t, fields[li]);
          }
          if(val==null) val='';
          txt(val,{x:sx(t),y:rowY,'text-anchor':'middle','font-size':10,fill:li===0?color:'#999'},svg);
        });
      });
    });
  });
}
render();
"""
