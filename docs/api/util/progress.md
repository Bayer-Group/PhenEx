# Progress display

A long run prints thousands of log lines, and it is hard to tell what is
happening or how much is left. The progress display replaces that with one
line per stage and a bar showing the work in flight.

## Turn it on

Add `verbosity="debug"` when you execute:

```python
study.execute(verbosity="debug")     # a whole study
cohort.execute(verbosity="debug")    # a single cohort
```

Leave it out and nothing changes: you get the plain text log PhenEx has always
printed. Your study definition stays the same either way.

## What you see

While a stage is running, this moves on screen:

```
● Entry stage ━━━━━━━━━━━━━━━━━━           9/14 0:00:03
    ● age_at_index  running 2s
```

When the stage finishes, that is replaced by a single line, which stays:

```
✓ Entry stage        14 nodes · 9 cached · 3.2s
```

A whole study run reads like this:

```
Results folder: results/my_study/2026-08-17_14-32-05
Progress bars are on · the full text log is saved live to analysis.log in the
results folder · to see plain text logs here instead, run without verbosity='debug'

Cohort 'treated patients'
✓ Entry stage        14 nodes · 9 cached · 3.2s
✓ Index stage        21 nodes · 21 cached · 1.0s
✓ Reporting stage    7 nodes · 0 cached · 52.8s
Cohort 'treated patients' completed in 1m 05s (42 node executions, 30 cached)

Saving reports for cohort 'treated patients' ...
Combining all reports into the study results file ...
Study 'my_study' done · results: results/my_study/... · full text log: analysis.log
```

How to read it:

- `Cohort '...'` marks the start of a cohort.
- A `●` line is happening right now. It moves while you watch and disappears
  when that piece of work is done.
- A `✓` line is finished work that will not change again: the stage name, how
  many steps it ran, how many of those were reused from an earlier run
  (`cached`), and how long it took.
- The last line of each cohort gives that cohort's totals.

## Where did the detailed log go?

Nothing is lost. The full text log, including the timing of every single step,
is written to `analysis.log` in your results folder while the run happens. You
can open it at any time, during or after the run.

Warnings and errors are never hidden. They appear on screen as soon as they
happen, above the bars.

To read the plain text log on screen instead, run without `verbosity`.
